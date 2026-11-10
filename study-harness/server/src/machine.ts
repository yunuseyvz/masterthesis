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
import { threadKey } from "./calls.js";
import { CONTINUE, type CheckpointServer } from "./checkpoint.js";
import type { LiveEndpoint } from "./live.js";
import type { Story } from "./trial.js";
import { changedLines, overlaps, toRanges, type Region } from "./lines.js";
import { runProbe } from "./runner.js";
import type { SandboxOptions } from "./sandbox.js";
import { commitWorkspace, createTrialWorkspace, readWorkspace, uncommitted } from "./workspace.js";

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

/** The participant's approval of the plan, sent for them; the agent then builds (opencode's build agent). */
export const APPROVE = "The plan looks good. Go ahead.";

/**
 * A question's options for the code as played. The question and its options are fixed; when the code does
 * something none of them says (the printed outcome is not an option), that outcome replaces a distractor: the last
 * option that is neither variant's answer. An outcome the script cannot describe ("?...", or no output) leaves them.
 */
export function adaptOptions(options: readonly string[], answers: readonly number[], outcome: string | null): string[] {
  const out = [...options];
  if (outcome === null || outcome.startsWith("?") || out.includes(outcome)) return out;
  const slot = [...out.keys()].reverse().find((i) => !answers.includes(i));
  if (slot !== undefined) out[slot] = outcome;
  return out;
}

/** An outcome that can be graded (the script ran and described it). */
const gradeable = (outcome: string | null | undefined): outcome is string => typeof outcome === "string" && !outcome.startsWith("?");

/** The held checkpoint's answer once the participant has reviewed and accepted. */
const RESUME = "The user has reviewed this step. Continue with the next step.";
/** The held checkpoint's answer after a rejection: the agent asks, the participant answers in the composer. */
const RESUME_REJECTED = "The user has rejected this step. Ask them in one short sentence what they want changed, then end your turn and wait for their answer.";
/** Hidden from the participant: sent when the agent ended its turn with files of the feature still unwritten. */
const GO_ON = "The feature is not finished yet. Do not ask anything: continue with the remaining steps as planned, then end your turn as usual.";
/** Hidden from the participant: sent when the agent ended its turn before the step the review pauses at was done. */
const GO_ON_TO_PAUSE = "You stopped before the feature is finished. Do not ask anything: go on where you stopped, with the review_checkpoint call after each of steps 1 to 3 as planned.";
/** How often the agent is sent one of the two for one trial before the review shows the feature as it is. */
const GO_ON_TRIES = 2;
/** When the agent has already finished (BATCH): the participant's rejection, sent for them like the approval. */
const REJECT_MESSAGE = "I'm rejecting this.";

export interface AgentDeps {
  agent: AgentHost;
  /** Where the per-trial project folders are created. */
  workRoot: string;
  sandbox: SandboxOptions;
  /** The model endpoint (it adds each trial's Drehbuch) and the agent's checkpoint tool. */
  endpoint: Pick<LiveEndpoint, "load" | "endPlanning">;
  checkpoints: Pick<CheckpointServer, "setHandler">;
}

interface CurrentTrial {
  sessionId: string;
  dir: string;
  pauseStep: number;
  planMs: number;
  finished: boolean;
  /** The plan is approved, so checkpoint calls are the agent's steps. */
  building?: boolean;
  /** The agent's turn that is still running while the scored checkpoint holds it. */
  running?: Promise<void>;
  /** Answers the held checkpoint, and so lets the agent go on. */
  release?: (text: string) => void;
  /** Called when the agent reaches the scored checkpoint. */
  onPause?: () => void;
  /** Lines under review in the scored review, measured when it opens. */
  reviewedLines?: number;
  /** The true option text of every understanding item, from running the code as the agent left it. */
  understandingKey?: (string | null)[];
  /** Every understanding item's options for this code (see adaptOptions), in their canonical order. */
  understandingOptions?: string[][];
  /** What the behaviour question's script printed for the code under review, and the options for it. */
  probeOutcome?: string | null;
  probeOptions?: string[];
  /** The scored step has been reviewed (a later checkpoint call for it is the agent's fix after feedback). */
  reviewed?: boolean;
  /** The agent is fixing the scored step after feedback; its next checkpoint call for that step ends the fix. */
  fixing?: boolean;
  /** Whether the agent wrote every file of the feature (see complete); false: the trial is flagged. */
  complete?: boolean;
  /** The agent ended its turn before the pause the regime asks for (see approvePlan). */
  pauseMissed?: boolean;
  /** Feedback phase: the one composer message has been sent. */
  answered?: boolean;
  /** The project at the last accepted checkpoint (at first: as the trial started); a step's changes are measured from it. */
  lastStep?: Map<string, string>;
  /** Failed step checks so far, per step. */
  stepFails?: Map<number, number>;
}

/** Failed step checks after which a step is accepted anyway, so that a session never hangs on it. */
const STEP_CHECK_TRIES = 2;

/**
 * Server-authoritative study flow. The client renders `view()` and posts actions; variant, regime and ground truth
 * never leave this class. In each trial a real model plays the agent in opencode from the trial's Drehbuch; the
 * server sends the participant's request and approval, and holds the agent at the scored checkpoint (see checkpoint).
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
  /** The next trial, being set up while the participant is on a full-screen page. */
  private prepared: { idx: number; ready: Promise<CurrentTrial> } | null = null;
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
   * Starts measuring a stretch of reviewing, about the code under review (`withCode`) or none of its own (the probe).
   * A state that is already on (changes view open, window unfocused) counts from now.
   */
  private openWindow(name: string, withCode: boolean) {
    if (!withCode) {
      this.window = new Window(name, this.now());
      return;
    }
    // The code under review is what is not committed yet. Where the flaw is in the agent's code is not known, so
    // the flaw region stays empty.
    const diff = uncommitted(this.current!.dir, this.deps.sandbox);
    const hunks = diff.flatMap((d) => toRanges(changedLines(d.before, d.after), 6).map((r) => ({ file: d.path, ...r })));
    if (name === "stage1") this.current!.reviewedLines = diff.reduce((n, d) => n + changedLines(d.before, d.after).length, 0);
    this.window = new Window(name, this.now(), hunks);
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

  /**
   * One agent turn: the agent works until its turn ends or it reaches the scored checkpoint (then the turn stays open
   * in `running`); then `after` sets the next phase. `hidden`: the message that starts the turn is one the participant
   * does not see (AgentHost.nudge).
   */
  private async turn(text: string, agent: string | undefined, after: () => void, hidden = false) {
    const c = this.current!;
    this.phase = "working";
    const started = this.now();
    // Listening for the pause before the turn starts: the agent may reach the checkpoint right away.
    const paused = new Promise<"paused">((resolve) => (c.onPause = () => resolve("paused")));
    const run = hidden ? this.deps.agent.nudge(c.sessionId, text) : this.deps.agent.runTurn(c.sessionId, text, agent);
    const outcome = await Promise.race([run.then(() => "done" as const), paused]);
    c.onPause = undefined;
    c.running = outcome === "paused" ? run : undefined;
    this.log("agent_turn", { trial: this.trial.position, text, ms: this.now() - started, outcome });
    after();
  }

  /** Answers the held checkpoint and waits until the agent's turn is over. */
  private async resume(answer: string) {
    const c = this.current!;
    this.phase = "working";
    const started = this.now();
    const run = c.running!;
    c.reviewed = true;
    c.release!(answer);
    c.release = undefined;
    await run;
    c.running = undefined;
    this.log("agent_turn", { trial: this.trial.position, text: answer, ms: this.now() - started, outcome: "done" });
  }

  /**
   * What the agent's checkpoint call does. Steps before the scored review are committed (so the changes view
   * shows only the step under review); the scored step's call is held until the participant has reviewed it.
   */
  private async checkpoint(c: CurrentTrial, step: number): Promise<string> {
    // A step must be complete before it counts (see checkStep). Not the fix after a rejection: it changes what the
    // participant asked for, not the step's files.
    if (this.current === c && c.building === true && this.phase === "working" && step >= 1 && step <= 3 && !(c.reviewed && step === c.pauseStep)) {
      const failed = await this.checkStep(c, step);
      if (failed) return failed;
    }
    const ok = this.current === c && c.building === true && this.phase === "working";
    this.log("live_checkpoint", { trial: ok ? this.trial.position : null, step, pauseStep: c.pauseStep, held: ok && this.trial.regime !== "BATCH" && step === c.pauseStep && !c.reviewed && c.release === undefined && !c.finished });
    if (!ok || this.trial.regime === "BATCH") return CONTINUE;
    if (step > c.pauseStep) {
      if (c.fixing) this.log("live_fix_unmarked", { trial: this.trial.position, step }); // the fix went on without its checkpoint call
      c.fixing = false;
      return CONTINUE;
    }
    if (step < c.pauseStep) {
      commitWorkspace(c.dir, this.story.def.steps[step - 1]!.summary, this.deps.sandbox);
      return CONTINUE;
    }
    if (c.reviewed) {
      // The fix after feedback is done: it is committed with the step, so the final look shows what comes after.
      if (c.fixing) commitWorkspace(c.dir, this.story.def.steps[step - 1]!.summary, this.deps.sandbox);
      c.fixing = false;
      return CONTINUE;
    }
    if (c.release || c.finished) return CONTINUE;
    return new Promise<string>((resolve) => {
      c.release = resolve;
      c.onPause?.();
    });
  }

  /**
   * Checks the step the agent reports as done, so that the step the review pauses at holds what the step outline puts
   * there: every file that first appears in this step's reference implementation has changed since the last step,
   * no file of a later step has changed yet, and the step's behaviour question can be answered on the code (its script
   * describes what the code does). Which variant the code implements is never checked: the answer is shown in the chat.
   * Returns the message for the agent if the step is not complete, null if it is (or is accepted after
   * STEP_CHECK_TRIES failures).
   */
  private async checkStep(c: CurrentTrial, step: number): Promise<string | null> {
    const story = this.story;
    const now = readWorkspace(c.dir, this.deps.sandbox);
    const before = c.lastStep ?? story.files();
    const changed = (f: string) => now.get(f) !== before.get(f);
    const owners = story.fileSteps();
    const missing = [...owners].filter(([f, n]) => n === step && !changed(f)).map(([f]) => f);
    const early = [...owners].filter(([f, n]) => n > step && now.get(f) !== story.files().get(f)).map(([f]) => f);
    const outcome = await runProbe(now, story.probeScript(story.def.probes[step - 1]!), undefined, this.deps.sandbox);
    const runs = gradeable(outcome);
    const passed = missing.length === 0 && early.length === 0 && runs;
    const fails = (c.stepFails ??= new Map()).get(step) ?? 0;
    const accepted = !passed && fails + 1 >= STEP_CHECK_TRIES;
    this.log("live_step_check", { trial: this.trial.position, step, attempt: fails + 1, passed, accepted, missing, early, runs });
    if (passed || accepted) {
      c.lastStep = now;
      return null;
    }
    c.stepFails.set(step, fails + 1);
    const problems = [
      ...missing.map((f) => `\`${f}\` was not changed`),
      ...early.map((f) => `\`${f}\` belongs to a later step`),
      ...(runs || missing.length > 0 ? [] : ["the step's code does not run yet"]),
    ];
    return `Step ${step} check failed: ${problems.join("; ")}. Complete step ${step} as planned, then call review_checkpoint for step ${step} again.`;
  }

  /**
   * A pause regime whose agent ended its turn before the scored checkpoint (it stopped between two steps, or did not
   * call the checkpoint): as long as no later step has been written, the pause can still happen where it belongs, so
   * the agent is sent GO_ON_TO_PAUSE, which the participant does not see, up to GO_ON_TRIES times. Otherwise, and if
   * that does not help, the pause is missed (`pauseMissed`).
   */
  private async toPause(c: CurrentTrial) {
    const story = this.story;
    for (let tries = 0; !c.running && tries < GO_ON_TRIES; tries++) {
      const now = readWorkspace(c.dir, this.deps.sandbox);
      const later = [...story.fileSteps()].filter(([f, n]) => n > c.pauseStep && now.get(f) !== story.files().get(f)).map(([f]) => f);
      if (later.length > 0) return;
      this.log("live_pause_go_on", { trial: this.trial.position, pauseStep: c.pauseStep, attempt: tries + 1 });
      await this.turn(GO_ON_TO_PAUSE, undefined, () => {}, true);
    }
  }

  /**
   * Makes sure the agent finished the feature before it is shown as finished: every file the reference
   * implementation writes has changed. An agent that stopped early (for example by asking again after the
   * participant's one answer) is sent GO_ON, which the participant does not see, up to GO_ON_TRIES times; if files
   * are still missing, the trial is flagged (`featureComplete` false, `live_incomplete`).
   */
  private async complete(c: CurrentTrial) {
    const original = this.story.files();
    for (let tries = 0; ; tries++) {
      const now = readWorkspace(c.dir, this.deps.sandbox);
      const missing = [...this.story.fileSteps().keys()].filter((f) => now.get(f) === undefined || now.get(f) === original.get(f));
      if (missing.length === 0) {
        c.complete = true;
        return;
      }
      if (tries >= GO_ON_TRIES) {
        c.complete = false;
        this.log("live_incomplete", { trial: this.trial.position, missing });
        return;
      }
      this.log("live_go_on", { trial: this.trial.position, missing, attempt: tries + 1 });
      this.phase = "working";
      const started = this.now();
      await this.deps.agent.nudge(c.sessionId, GO_ON);
      this.log("agent_turn", { trial: this.trial.position, text: GO_ON, ms: this.now() - started, outcome: "done" });
    }
  }

  /**
   * The understanding items' answer key, from running their script on the code as the agent finished it (fix
   * included); the items are answered about that code.
   */
  private async key() {
    const c = this.current!;
    // Some items run the agent's own tests (twice), hence the longer limit.
    const raw = await runProbe(readWorkspace(c.dir, this.deps.sandbox), this.story.understandingScript(), 60_000, this.deps.sandbox);
    let key: (string | null)[] = [];
    try {
      key = raw === null ? [] : (JSON.parse(raw) as (string | null)[]);
    } catch { /* the script failed on this code */ }
    const items = this.story.def.understanding.items;
    c.understandingKey = items.map((_, k) => key[k] ?? null);
    c.understandingOptions = items.map((it, k) => adaptOptions(it.options, [it.correct.Correct, it.correct.Flawed], c.understandingKey![k]!));
    this.log("live_key", { trial: this.trial.position, understanding: c.understandingKey, options: c.understandingOptions });
  }

  /** The finished feature is on screen until the participant is done looking. */
  private toReviewing() {
    const c = this.current!;
    c.finished = true;
    this.phase = "reviewing";
    this.shownAt = this.now();
    this.log("final_review_shown", { trial: this.trial.position });
    // The changes view now shows what is not committed yet: everything for BATCH, the steps after the pause otherwise.
    this.openWindow("final", true);
  }

  /**
   * Sets up trial `idx` and lets the agent explore and plan, in the background. It runs while the participant
   * is on a full-screen page (the questionnaire, or the previous trial's understanding questions), so the plan is
   * usually ready when the trial starts. The previous trial's agent has finished by then.
   */
  private prepare(idx: number) {
    if (idx >= this.allTrials.length || this.prepared?.idx === idx) return;
    const ready = this.setUp(idx);
    ready.catch(() => {}); // reported when the trial starts and awaits it
    this.prepared = { idx, ready };
  }

  private async setUp(idx: number): Promise<CurrentTrial> {
    const t = this.allTrials[idx]!;
    const story = this.loadStory(t.story);
    const dir = createTrialWorkspace(this.deps.workRoot, `${String(t.position).padStart(2, "0")}-${t.story}`, story.files(), this.deps.sandbox);
    // The real model plays the agent from the Drehbuch; its checkpoint calls make the steps and the pause.
    const c: CurrentTrial = { sessionId: "", dir, pauseStep: story.pauseStep(t.regime, t.pauseDraw), planMs: 0, finished: false };
    const mainThread = threadKey({ messages: [{ role: "user", content: story.brief }], tools: [{}] }, dir);
    this.deps.endpoint.load({ workspaceDir: dir, mainThread, drehbuch: story.drehbuch(t.variant), publicPlan: story.publicPlan, leaks: story.def.planLeaks, steps: story.def.steps.map((s) => s.summary), trial: t.position });
    this.deps.checkpoints.setHandler((step) => this.checkpoint(c, step));
    const started = this.now();
    this.log("trial_prepare", { position: t.position, story: t.story });
    c.sessionId = (await this.deps.agent.startSession({ dir, title: story.def.title, agent: "plan" })).id;
    // The participant's request, as if already sent; the agent looks through the project in plan mode, and the plan it
    // answers with is the story's public plan (see LiveEndpoint).
    await this.deps.agent.runTurn(c.sessionId, story.brief, "plan");
    this.log("agent_turn", { trial: t.position, text: story.brief, ms: this.now() - started, outcome: "done", prepared: true });
    return c;
  }

  private async startTrial() {
    const t = this.trial;
    const story = this.story;
    // Prepared in the background (see prepare); if not started yet, now, and the participant waits for it.
    this.prepare(this.trialIdx);
    const waitFrom = this.now();
    const c = await this.prepared!.ready;
    this.prepared = null;
    this.current = c;
    this.stage1 = null;
    this.pending = null;
    this.log("trial_start", { practice: this.trialIdx === 0, position: t.position, story: t.story, regime: t.regime, variant: t.variant, milestoneStep: story.milestoneStep, flawStep: story.flawStep, pauseStep: c.pauseStep, sessionId: c.sessionId, waitedForPlanMs: this.now() - waitFrom });
    this.phase = "plan";
    this.shownAt = this.now();
    this.log("plan_shown", { trial: t.position });
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
    base.story = { title: story.def.title, brief: story.brief, project: story.def.project };
    base.agentSessionId = this.current.sessionId;
    base.finished = this.current.finished;

    if (this.phase === "understanding") {
      base.understanding = {
        items: story.def.understanding.items.map((item, k) => ({
          question: item.question,
          options: this.trial.understandingOptionOrders[k]!.map((i) => (this.current!.understandingOptions?.[k] ?? item.options)[i]!),
        })),
      };
    }
    if (this.phase === "stage2") {
      const probe = this.probe;
      base.initialDecision = this.stage1!.decision;
      base.probe = { question: probe.question, options: this.trial.probeOptionOrder.map((i) => (this.current!.probeOptions ?? probe.options)[i]!) };
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
        this.prepare(0);
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
        c.building = true;
        this.deps.endpoint.endPlanning();
        await this.turn(APPROVE, "build", () => {});
        if (this.trial.regime !== "BATCH") await this.toPause(c);
        c.finished = this.trial.regime === "BATCH" || !c.running;
        // The agent ended its turn without reaching the scored checkpoint; the review shows what it did.
        c.pauseMissed = !c.running && this.trial.regime !== "BATCH";
        if (c.pauseMissed) this.log("live_pause_missed", { trial: this.trial.position, pauseStep: c.pauseStep });
        // BATCH reviews the finished feature, so it must be finished.
        if (this.trial.regime === "BATCH") await this.complete(c);
        this.phase = "stage1";
        this.shownAt = this.now();
        this.log("review_shown", { trial: this.trial.position, pauseStep: c.pauseStep });
        this.openWindow("stage1", true);
        break;
      }

      case "stage1": {
        this.require("stage1");
        this.stage1 = { decision: action.decision, dwellMs: this.now() - this.shownAt, ui: this.closeWindow() };
        this.log("stage1_submit", this.stage1);
        const c = this.current!;
        // The behaviour question is about the code under review as it is now; its options must contain what this
        // code does, so the outcome is computed before the question is shown.
        const probe = this.probe;
        c.probeOutcome = await runProbe(readWorkspace(c.dir, this.deps.sandbox), this.story.probeScript(probe), undefined, this.deps.sandbox);
        c.probeOptions = adaptOptions(probe.options, [probe.options.indexOf(probe.expected.Correct), probe.options.indexOf(probe.expected.Flawed)], c.probeOutcome);
        this.log("live_probe", { trial: this.trial.position, outcome: c.probeOutcome, options: c.probeOptions });
        this.openWindow("probe", false); // the behaviour question: running the code to check is expected here
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
        // Graded by what the code under review did when the question was shown (a fix after feedback must not change
        // the answer).
        const executed = c.probeOutcome ?? null;
        const probeCorrect = canonical !== -1 && gradeable(executed) && c.probeOptions![canonical] === executed;
        const finalDecision: Decision = action.final === "confirm" ? s1.decision : s1.decision === "accept" ? "reject" : "accept";
        const reviewed = this.trial.regime === "BATCH" ? [1, 4] : [c.pauseStep, c.pauseStep];
        this.pending = {
          position: this.trial.position,
          story: this.trial.story,
          regime: this.trial.regime,
          variant: this.trial.variant,
          milestoneStep: story.milestoneStep,
          flawStep: story.flawStep,
          pauseStep: c.pauseStep,
          flawStepReviewed: story.flawStep !== null && story.flawStep >= reviewed[0]! && story.flawStep <= reviewed[1]!,
          probeStep: probe.step,
          initialDecision: s1.decision,
          finalDecision,
          decisionReversed: finalDecision !== s1.decision,
          // Lines the review changes (added or changed in the diff), not the size of the files it touches.
          reviewedLines: c.reviewedLines ?? 0,
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
        if (finalDecision === "reject") {
          // The agent asks what to change and ends its turn; the participant answers in opencode's composer (one
          // message, see composerMessage); then the agent fixes it and finishes.
          if (c.running) await this.resume(RESUME_REJECTED);
          else await this.turn(REJECT_MESSAGE, undefined, () => {});
          c.fixing = c.reviewed === true;
          this.phase = "feedback";
          this.shownAt = this.now();
          this.log("feedback_shown", { trial: this.trial.position });
        } else {
          if (!c.finished) {
            // The reviewed step is committed, so the final look shows what the agent does after the checkpoint.
            commitWorkspace(c.dir, story.def.steps[c.pauseStep - 1]!.summary, this.deps.sandbox);
            await this.resume(RESUME);
          }
          await this.complete(c);
          await this.key();
          this.toReviewing();
        }
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
        this.prepare(this.trialIdx + 1);
        break;
      }

      case "understanding": {
        this.require("understanding");
        const canonical = action.answers.map((a, k) => this.trial.understandingOptionOrders[k]![a]!);
        const key = this.current!.understandingKey;
        // Correct is the option the code as played makes true (an item whose script failed counts as wrong; see live_key).
        const options = this.current!.understandingOptions!;
        const corrects = canonical.map((c, k) => gradeable(key![k]) && options[k]![c] === key![k]);
        const result: TrialResult = {
          ...(this.pending as Omit<TrialResult, "featureComplete" | "understandingRoles" | "understandingSteps" | "understandingAnswers" | "understandingCorrects" | "understandingConfidences" | "understandingScore" | "paas" | "understandingItemMs" | "understandingAnswerChanges">),
          featureComplete: this.current!.complete !== false,
          pauseMissed: this.current!.pauseMissed === true,
          understandingRoles: this.story.def.understanding.items.map((it) => it.role),
          understandingSteps: this.story.def.understanding.items.map((it) => it.step),
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

  /**
   * Feedback phase: whether a request from the participant's browser is their one answer to the agent (the
   * proxy blocks every other prompt).
   */
  acceptsComposerMessage(method: string, url: string): boolean {
    const c = this.current;
    if (this.phase !== "feedback" || !c || c.answered || method !== "POST") return false;
    return new RegExp(`^/api/session/${c.sessionId}/prompt(\\?|$)`).test(url);
  }

  /**
   * The participant's answer from opencode's composer. It goes to opencode as sent; the agent fixes the step (or
   * the feature) and finishes, then the final review opens. Resolves with opencode's answer to the request.
   */
  async composerMessage(url: string, body: string): Promise<{ status: number; body: string }> {
    this.require("feedback");
    const c = this.current!;
    c.answered = true;
    let text = "";
    try {
      text = String((JSON.parse(body) as { text?: unknown }).text ?? "");
    } catch { /* not JSON: opencode will refuse it */ }
    Object.assign(this.pending!, { feedback: text, feedbackMs: this.now() - this.shownAt } satisfies Partial<TrialResult>);
    this.log("feedback_submit", { trial: this.trial.position, text, ms: this.pending!.feedbackMs });
    this.phase = "working";
    const started = this.now();
    const res = await this.deps.agent.forwardPrompt(c.sessionId, url.includes("?") ? url.slice(url.indexOf("?")) : "", body);
    if (res.status >= 300) {
      // opencode refused it: the composer stays open for another try.
      c.answered = false;
      this.phase = "feedback";
      this.log("feedback_refused", { trial: this.trial.position, status: res.status });
      return res;
    }
    void (async () => {
      await this.deps.agent.waitIdle(c.sessionId);
      this.log("agent_turn", { trial: this.trial.position, text, ms: this.now() - started, outcome: "done" });
      await this.complete(c);
      await this.key();
      this.toReviewing();
    })().catch((err) => this.log("server_error", { message: String(err) }));
    return res;
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
