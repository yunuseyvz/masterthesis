import {
  Action,
  SessionBundle,
  UiEvent,
  type Decision,
  type SessionPlan,
  type TrialPlan,
  type TrialResult,
  type ViewState,
} from "@beacon/shared";
import type { AgentHost } from "./agent.js";
import type { Story } from "./trial.js";
import { overlaps, type Region } from "./lines.js";
import type { ReplayEndpoint } from "./replay.js";
import { runProbe } from "./runner.js";
import type { SandboxOptions } from "./sandbox.js";
import { commitWorkspace, createTrialWorkspace } from "./workspace.js";

export interface StudyEvent {
  t: number;
  type: string;
  data: unknown;
}

export class ConflictError extends Error {}

type Phase = ViewState["phase"];

const TEST_COMMAND = /\b(npm\s+(run\s+)?test|npm\s+t\b|node\s+(--\S+\s+)*--test|node\s+.*\.test\.ts)/;

/** Code on screen for at least this long counts as seen. */
const SEEN_MS = 1000;

/** Participant states the client reports as on/off; the server times them. */
type State = "review" | "unfocused" | "idle";

/**
 * What happened inside opencode during one stretch of reviewing (before the decision, during the probe, at the end).
 * `hunks` and `flaw` are the regions of code this stretch is about; their time on screen comes from `diff_view` events.
 */
class Window {
  ms: Record<State, number> = { review: 0, unfocused: 0, idle: 0 };
  coverage = 0;
  files = new Set<string>();
  commands = 0;
  tests = 0;
  testFails = 0;
  chatBacks = 0;
  toolExpands = 0;
  fileMs = new Map<string, number>();
  flawMs = 0;
  readonly hunks: (Region & { ms: number })[];
  constructor(
    readonly name: string,
    readonly start: number,
    hunks: Region[] = [],
    readonly flaw: Region[] = [],
  ) {
    this.hunks = hunks.map((h) => ({ ...h, ms: 0 }));
  }

  summary() {
    return {
      changesMs: this.ms.review,
      coverage: this.coverage,
      files: this.files.size,
      commands: this.commands,
      tests: this.tests,
      testFails: this.testFails,
      hunks: this.hunks.length,
      hunksViewed: this.hunks.filter((h) => h.ms >= SEEN_MS).length,
      flawMs: this.flawMs,
      flawSeen: this.flawMs >= SEEN_MS,
      unfocusedMs: this.ms.unfocused,
      idleMs: this.ms.idle,
      chatBacks: this.chatBacks,
      toolExpands: this.toolExpands,
    };
  }
}
type WindowSummary = ReturnType<Window["summary"]>;

const REGIME_LETTER = { BATCH: "B", MILESTONE: "M", NON_MILESTONE: "N" } as const;

/**
 * What the participant "says" to the agent after a checkpoint; the study panel sends it, the participant never types.
 * Everything else the participant says (the request, the plan approval) is the captured session's own turns.
 */
const RESUME = "Thanks, I've reviewed it. Please continue.";

export interface AgentDeps {
  agent: AgentHost;
  replay: ReplayEndpoint;
  /** Where the per-trial project folders are created. */
  workRoot: string;
  sandbox: SandboxOptions;
}

interface CurrentTrial {
  sessionId: string;
  dir: string;
  pauseStep: number;
  planMs: number;
  finished: boolean;
}

/**
 * Server-authoritative study flow. The client renders `view()` and posts actions; variant, regime and ground truth
 * never leave this class. Each trial is a replayed opencode session: the server starts every agent turn (plan, run
 * to the review, finish) and an action that starts one resolves once the agent is done.
 */
export class StudySession {
  private phase: Phase = "intro";
  private trialIdx = 0;
  private shownAt = 0;
  private current: CurrentTrial | null = null;
  private stage1: { decision: Decision; dwellMs: number; ui: WindowSummary } | null = null;
  private pending: Partial<TrialResult> | null = null;
  private results: TrialResult[] = [];
  private practiceResult: TrialResult | null = null;
  private preSurvey: Record<string, unknown> | null = null;
  /** Telemetry: the stretch being measured, since when each state is on (null: off), and the code on screen. */
  private window: Window | null = null;
  private since: Record<State, number | null> = { review: null, unfocused: null, idle: null };
  private onScreen: { views: Region[]; since: number } | null = null;
  private postSurvey: Record<string, unknown> | null = null;
  /** Practice trial first, then the six measured trials. */
  private readonly allTrials: TrialPlan[];
  readonly events: StudyEvent[] = [];

  constructor(
    private readonly plan: SessionPlan,
    private readonly loadStory: (id: string) => Story,
    private readonly deps: AgentDeps,
    private readonly sink: (e: StudyEvent) => void = () => {},
    private readonly now: () => number = Date.now,
    /** Experimenter aid: expose a "B·F"-style condition tag in the view. Off in real sessions. */
    private readonly showCondition = false,
  ) {
    this.allTrials = [plan.practice, ...plan.trials];
    this.log("session_start", { participantId: plan.participantId, studySeed: plan.studySeed, group: plan.group, plan });
  }

  log(type: string, data: unknown) {
    const e = { t: this.now(), type, data };
    this.events.push(e);
    this.sink(e);
  }

  private get trial(): TrialPlan {
    return this.allTrials[this.trialIdx]!;
  }
  private get story(): Story {
    return this.loadStory(this.trial.story);
  }
  private get probe() {
    return this.story.probeFor(this.trial.regime, this.current!.pauseStep);
  }

  /**
   * Starts measuring a stretch of reviewing about agent steps from..to (null: no code of its own, e.g. the probe).
   * A state that is already on (changes view open, window unfocused) counts from now.
   */
  private openWindow(name: string, steps: [number, number] | null) {
    const story = this.story;
    const v = this.trial.variant;
    this.window = steps ? new Window(name, this.now(), story.hunks(v, steps[0], steps[1]), story.flawRegion(v, steps[1])) : new Window(name, this.now());
  }

  /** Time since `since` that falls into window `w`. */
  private credit(w: Window, since: number) {
    return this.now() - Math.max(since, w.start);
  }

  /** Credits the code on screen since the last change to the window's files, hunks and flaw region. */
  private flushScreen(w: Window | null) {
    if (!w || !this.onScreen) return;
    const dt = this.credit(w, this.onScreen.since);
    const views = this.onScreen.views;
    for (const v of views) w.fileMs.set(v.file, (w.fileMs.get(v.file) ?? 0) + dt);
    for (const h of w.hunks) if (views.some((v) => overlaps(h, v))) h.ms += dt;
    if (w.flaw.some((r) => views.some((v) => overlaps(r, v)))) w.flawMs += dt;
  }

  private setState(key: State, on: boolean) {
    const since = this.since[key];
    if (on) this.since[key] ??= this.now();
    else if (since !== null) {
      if (this.window) this.window.ms[key] += this.credit(this.window, since);
      this.since[key] = null;
    }
  }

  /** Ends the current stretch, counting states and code still on screen up to now, and logs its details. */
  private closeWindow(): WindowSummary {
    const w = this.window ?? new Window("none", this.now());
    for (const key of Object.keys(this.since) as State[]) {
      const since = this.since[key];
      if (since !== null) w.ms[key] += this.credit(w, since);
    }
    this.flushScreen(w);
    this.window = null;
    const summary = w.summary();
    this.log("review_window", {
      trial: this.current ? this.trial.position : null,
      window: w.name,
      ms: this.now() - w.start,
      ...summary,
      fileMs: Object.fromEntries(w.fileMs),
      hunkMs: w.hunks,
      flawRegion: w.flaw,
    });
    return summary;
  }

  /** One event from the participant's opencode UI. */
  recordUi(raw: unknown) {
    const e = UiEvent.parse(raw);
    this.log(`ui_${e.type}`, { phase: this.phase, trial: this.current ? this.trial.position : null, ...e.data });
    const w = this.window;
    switch (e.type) {
      case "review":
        this.setState("review", e.data.open);
        break;
      case "focus":
        this.setState("unfocused", !e.data.focused);
        break;
      case "idle":
        this.setState("idle", e.data.idle);
        break;
      case "diff_view":
        this.flushScreen(w);
        this.onScreen = { views: e.data.views, since: this.now() };
        break;
      case "test_result":
        if (w && e.data.fail > 0) w.testFails++;
        break;
      case "chat_scroll":
        if (w && e.data.back) w.chatBacks++;
        break;
      case "tool_expand":
        if (w) w.toolExpands++;
        break;
      case "diff_scroll":
        if (w) w.coverage = Math.max(w.coverage, e.data.coverage);
        break;
      case "file":
        w?.files.add(e.data.name);
        break;
      case "terminal_command":
        if (w) {
          w.commands++;
          if (TEST_COMMAND.test(e.data.line)) w.tests++;
        }
        break;
    }
  }

  private require(...allowed: Phase[]) {
    if (!allowed.includes(this.phase)) throw new ConflictError(`action not allowed in phase "${this.phase}"`);
  }

  /** One agent turn: the replay plays until its next stop, then `after` sets the next phase. */
  private async turn(text: string, agent: string | undefined, after: () => void) {
    const c = this.current!;
    this.phase = "working";
    const started = this.now();
    this.deps.replay.arm();
    await this.deps.agent.runTurn(c.sessionId, text, agent);
    this.log("agent_turn", { trial: this.trial.position, text, ms: this.now() - started });
    after();
  }

  private async startTrial() {
    const t = this.trial;
    const story = this.story;
    const pauseStep = story.pauseStep(t.regime, t.pauseDraw);
    const key = `${String(t.position).padStart(2, "0")}-${t.story}`;
    const { capture } = story.capture;
    const dir = createTrialWorkspace(this.deps.workRoot, key, story.capture.files(capture.workspace.initial), this.deps.sandbox);
    // BATCH plays the capture through; a pause stops before the first response of the step after the paused one.
    // Steps before the paused one are committed as the replay passes their end, so the changes view at the
    // checkpoint shows exactly the paused step.
    const stop = t.regime === "BATCH" ? null : story.boundary(pauseStep);
    const commits = new Map(t.regime === "BATCH" ? [] : story.def.steps.filter((s) => s.n < pauseStep).map((s) => [story.boundary(s.n)!, s.summary] as const));
    this.deps.replay.load({
      capture: story.capture,
      workspaceDir: dir,
      patches: story.patches(t.variant),
      stops: stop === null ? [] : [stop],
      onServe: (position) => {
        const summary = commits.get(position);
        if (summary) commitWorkspace(dir, summary, this.deps.sandbox);
      },
      filesAfter: (position) => story.filesAfter(t.variant, position),
    });
    const { id } = await this.deps.agent.startSession({ dir, title: story.def.title, agent: capture.turns[0]!.agent ?? "plan" });
    this.current = { sessionId: id, dir, pauseStep, planMs: 0, finished: false };
    this.stage1 = null;
    this.pending = null;
    this.log("trial_start", { practice: this.trialIdx === 0, position: t.position, story: t.story, regime: t.regime, variant: t.variant, milestoneStep: story.milestoneStep, flawStep: story.flawStep, pauseStep, sessionId: id });
    // The participant's request, as if already sent; the agent answers in plan mode with its plan.
    await this.turn(story.brief, capture.turns[0]!.agent, () => {
      this.phase = "plan";
      this.shownAt = this.now();
      this.log("plan_shown", { trial: t.position });
    });
  }

  private sessionsSoFar(): ViewState["sessions"] {
    if (this.phase === "intro" || this.phase === "presurvey") return [];
    return this.allTrials.slice(0, this.trialIdx + 1).map((t, i) => {
      const def = this.loadStory(t.story).def;
      return { trial: i + 1, title: def.title, project: def.project };
    });
  }

  view(): ViewState {
    const base: ViewState = {
      phase: this.phase,
      participantId: this.plan.participantId,
      trial: this.phase === "intro" || this.phase === "presurvey" ? 0 : Math.min(this.trialIdx, this.allTrials.length - 1) + 1,
      nTrials: this.plan.trials.length,
      practice: this.trialIdx === 0,
      sessions: this.sessionsSoFar(),
    };
    if (!this.current || ["intro", "presurvey", "postsurvey", "debrief", "finished"].includes(this.phase)) return base;

    const story = this.story;
    if (this.showCondition) base.debugTag = `${REGIME_LETTER[this.trial.regime]}·${this.trial.variant === "Flawed" ? "F" : "C"}`;
    base.story = { title: story.def.title, brief: story.brief, project: story.def.project, plan: story.def.steps.map((s) => ({ n: s.n, summary: s.summary })) };
    base.agentSessionId = this.current.sessionId;
    base.finished = this.current.finished;

    if (this.phase === "understanding") {
      base.understanding = {
        items: story.def.understanding.items.map((item, k) => ({
          question: item.question,
          options: this.trial.understandingOptionOrders[k]!.map((i) => item.options[i]!),
        })),
      };
    }
    if (this.phase === "stage2") {
      const probe = this.probe;
      base.initialDecision = this.stage1!.decision;
      base.probe = { question: probe.question, options: this.trial.probeOptionOrder.map((i) => probe.options[i]!) };
    }
    return base;
  }

  async act(raw: unknown): Promise<ViewState> {
    const action = Action.parse(raw);
    switch (action.type) {
      case "begin":
        this.require("intro");
        this.phase = "presurvey";
        this.shownAt = this.now();
        this.log("presurvey_shown", {});
        break;

      case "presurvey": {
        this.require("presurvey");
        const { type: _t, ...answers } = action;
        // NCS-6: items 3 and 4 are reverse-keyed. S-TIAS: mean of three items.
        const ncsScored = answers.ncs.map((v, i) => (i === 2 || i === 3 ? 6 - v : v));
        const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
        this.preSurvey = {
          ...answers,
          durationMs: this.now() - this.shownAt,
          scores: { ncs6: mean(ncsScored), stias: mean(answers.stias) },
          attentionCheckPassed: answers.attention === 4, // item instructs "select Agree (4)"
        };
        this.log("presurvey_submit", this.preSurvey);
        await this.startTrial();
        break;
      }

      case "approvePlan": {
        this.require("plan");
        const c = this.current!;
        c.planMs = this.now() - this.shownAt;
        this.log("plan_approved", { trial: this.trial.position, ms: c.planMs });
        const approve = this.story.capture.capture.turns[this.story.def.approveTurn]!;
        await this.turn(approve.text, approve.agent, () => {
          c.finished = this.trial.regime === "BATCH";
          this.phase = "stage1";
          this.shownAt = this.now();
          this.log("review_shown", { trial: this.trial.position, pauseStep: c.pauseStep });
          this.openWindow("stage1", this.trial.regime === "BATCH" ? [1, 4] : [c.pauseStep, c.pauseStep]);
        });
        break;
      }

      case "stage1": {
        this.require("stage1");
        this.stage1 = { decision: action.decision, dwellMs: this.now() - this.shownAt, ui: this.closeWindow() };
        this.log("stage1_submit", this.stage1);
        this.openWindow("probe", null); // the behaviour question: running the code to check is expected here
        this.phase = "stage2";
        this.shownAt = this.now();
        this.log("probe_shown", { trial: this.trial.position, probeStep: this.probe.step });
        break;
      }

      case "stage2": {
        this.require("stage2");
        const story = this.story;
        const c = this.current!;
        const s1 = this.stage1!;
        const latency = this.now() - this.shownAt;
        const probeWindow = this.closeWindow();
        const probe = this.probe;
        const canonical = action.probeAnswer === -1 ? -1 : this.trial.probeOptionOrder[action.probeAnswer]!;
        // Graded by running the trial's code (never the participant's copy), against the finished feature.
        const executed = await runProbe(story.workspaceAt(this.trial.variant, 4), story.probeScript(probe));
        const probeCorrect = canonical !== -1 && executed !== null && probe.options[canonical] === executed;
        const finalDecision: Decision = action.final === "confirm" ? s1.decision : s1.decision === "accept" ? "reject" : "accept";
        const reviewed = this.trial.regime === "BATCH" ? [1, 4] : [c.pauseStep, c.pauseStep];
        const reviewedLines = story.diff(this.trial.variant, reviewed[0]!, reviewed[1]!).reduce((n, d) => n + d.after.split("\n").length, 0);
        this.pending = {
          position: this.trial.position,
          story: this.trial.story,
          regime: this.trial.regime,
          variant: this.trial.variant,
          milestoneStep: story.milestoneStep,
          flawStep: story.flawStep,
          pauseStep: c.pauseStep,
          probeStep: probe.step,
          initialDecision: s1.decision,
          finalDecision,
          decisionReversed: finalDecision !== s1.decision,
          reviewedLines,
          planMs: c.planMs,
          stage1DwellMs: s1.dwellMs,
          changesViewMsStage1: s1.ui.changesMs,
          diffCoverageStage1: s1.ui.coverage,
          filesOpenedStage1: s1.ui.files,
          terminalCommandsStage1: s1.ui.commands,
          testRunsStage1: s1.ui.tests,
          testFailRunsStage1: s1.ui.testFails,
          hunksStage1: s1.ui.hunks,
          hunksViewedStage1: s1.ui.hunksViewed,
          flawRegionMsStage1: s1.ui.flawMs,
          flawRegionSeenStage1: s1.ui.flawSeen,
          unfocusedMsStage1: s1.ui.unfocusedMs,
          idleMsStage1: s1.ui.idleMs,
          chatScrollBacksStage1: s1.ui.chatBacks,
          toolExpandsStage1: s1.ui.toolExpands,
          terminalCommandsProbe: probeWindow.commands,
          stage2ProbeLatencyMs: latency,
          probeAnswer: canonical,
          probeCorrect,
        };
        this.log("stage2_submit", { ...this.pending, probeExecuted: executed, displayedAnswer: action.probeAnswer });
        const toReviewing = () => {
          c.finished = true;
          this.phase = "reviewing";
          this.shownAt = this.now();
          this.log("final_review_shown", { trial: this.trial.position });
          // The changes view now shows what is not committed yet: everything for BATCH, the steps after the pause otherwise.
          this.openWindow("final", this.trial.regime === "BATCH" ? [1, 4] : [c.pauseStep + 1, 4]);
        };
        if (!c.finished) {
          // The reviewed step is committed, so the final look shows what the agent does after the checkpoint.
          commitWorkspace(c.dir, story.def.steps[c.pauseStep - 1]!.summary, this.deps.sandbox);
          await this.turn(RESUME, undefined, toReviewing);
        } else toReviewing();
        break;
      }

      case "reviewed": {
        this.require("reviewing");
        const fw = this.closeWindow();
        Object.assign(this.pending!, {
          finalReviewMs: this.now() - this.shownAt,
          changesViewMsFinal: fw.changesMs,
          hunksFinal: fw.hunks,
          hunksViewedFinal: fw.hunksViewed,
          flawRegionMsFinal: fw.flawMs,
          flawRegionSeenFinal: fw.flawSeen,
          unfocusedMsFinal: fw.unfocusedMs,
          idleMsFinal: fw.idleMs,
        } satisfies Partial<TrialResult>);
        this.log("reviewed", { trial: this.trial.position, ms: this.pending!.finalReviewMs });
        this.phase = "understanding";
        this.shownAt = this.now();
        break;
      }

      case "understanding": {
        this.require("understanding");
        const items = this.story.def.understanding.items;
        const canonical = action.answers.map((a, k) => this.trial.understandingOptionOrders[k]![a]!);
        const corrects = canonical.map((c, k) => c === items[k]!.correct[this.trial.variant]);
        const result: TrialResult = {
          ...(this.pending as Omit<TrialResult, "understandingAnswers" | "understandingCorrects" | "understandingConfidences" | "understandingScore" | "paas" | "understandingItemMs" | "understandingAnswerChanges">),
          understandingAnswers: canonical,
          understandingCorrects: corrects,
          understandingConfidences: action.confidences,
          understandingScore: corrects.filter(Boolean).length,
          paas: action.paas,
          understandingItemMs: action.itemMs,
          understandingAnswerChanges: action.answerChanges,
        };
        if (this.trialIdx === 0) this.practiceResult = result;
        else this.results.push(result);
        this.log("trial_end", { practice: this.trialIdx === 0, ...result });
        this.trialIdx++;
        if (this.trialIdx >= this.allTrials.length) {
          this.current = null;
          this.phase = "postsurvey";
          this.shownAt = this.now();
          this.log("postsurvey_shown", {});
        } else {
          await this.startTrial();
        }
        break;
      }

      case "postsurvey": {
        this.require("postsurvey");
        const { type: _t, ...answers } = action;
        this.postSurvey = { ...answers, durationMs: this.now() - this.shownAt };
        this.log("postsurvey_submit", this.postSurvey);
        this.phase = "debrief";
        this.log("debrief_shown", {});
        break;
      }
    }
    return this.view();
  }

  /** Builds and validates the bundle. Only valid once the debrief is reached. */
  finish() {
    this.require("debrief");
    this.log("finish", {});
    const bundle = SessionBundle.parse({
      plan: this.plan,
      trials: this.results,
      practice: this.practiceResult ?? undefined,
      events: this.events,
      survey: { pre: this.preSurvey, post: this.postSurvey },
    });
    this.phase = "finished";
    return bundle;
  }
}
