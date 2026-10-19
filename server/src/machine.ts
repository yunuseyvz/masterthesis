import {
  Action,
  SessionBundle,
  type Decision,
  type SessionPlan,
  type TrialPlan,
  type TrialResult,
  type ViewState,
} from "@beacon/shared";
import { checkpointsFor, stepsOf, type CheckpointSpec } from "./checkpoints.js";
import type { Story } from "./corpus.js";
import { runProbe } from "./runner.js";

export interface StudyEvent {
  t: number;
  type: string;
  data: unknown;
}

export class ConflictError extends Error {}

const TEST_COMMAND = /\b(npm\s+(run\s+)?test|npm\s+t\b|node\s+(--\S+\s+)*--test|node\s+.*\.test\.ts)/;

type Phase = ViewState["phase"];

const REGIME_LETTER = { BATCH: "B", CHECKPOINT: "K" } as const;

interface Stage1Record {
  decision: Decision;
  dwellMs: number;
  scrollCoverage: number;
  testRuns: number;
}

/**
 * Server-authoritative study flow. The client only renders `view()` and posts actions;
 * variant, regime and ground truth never leave this class.
 */
export class StudySession {
  private phase: Phase = "intro";
  private trialIdx = 0;
  private cpIdx = 0;
  private shownAt = 0;
  private ready = false;
  private testRuns = 0;
  private stage1: Stage1Record | null = null;
  private pending: Partial<TrialResult> | null = null;
  private results: TrialResult[] = [];
  private practiceResult: TrialResult | null = null;
  private preSurvey: Record<string, unknown> | null = null;
  private postSurvey: Record<string, unknown> | null = null;
  /** Practice trial first, then the six measured trials. */
  private readonly allTrials: TrialPlan[];
  readonly events: StudyEvent[] = [];

  constructor(
    private readonly plan: SessionPlan,
    private readonly loadStory: (id: string) => Story,
    private readonly sink: (e: StudyEvent) => void = () => {},
    private readonly now: () => number = Date.now,
    private readonly onTransition: () => void = () => {},
    /** Experimenter aid: expose a "B·F"-style condition tag in the view. Off in real sessions. */
    private readonly showCondition = false,
  ) {
    this.allTrials = [plan.practice, ...plan.trials];
    this.log("session_start", { participantId: plan.participantId, studySeed: plan.studySeed, group: plan.group, plan });
  }

  private log(type: string, data: unknown) {
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
  private get checkpoints(): CheckpointSpec[] {
    return checkpointsFor(this.trial.regime, this.story.milestoneStep);
  }
  private get checkpoint(): CheckpointSpec {
    return this.checkpoints[this.cpIdx]!;
  }

  private require(...allowed: Phase[]) {
    if (!allowed.includes(this.phase)) throw new ConflictError(`action not allowed in phase "${this.phase}"`);
  }

  private showCheckpoint() {
    const cp = this.checkpoint;
    this.phase = cp.scored ? "stage1" : "unscored";
    this.shownAt = this.now();
    this.ready = false;
    this.testRuns = 0;
    this.log("checkpoint_shown", { trial: this.trial.position, checkpoint: cp.id, scored: cp.scored });
  }

  /** After a checkpoint: show the next one (the unscored wrap-up) or move on to the understanding questions. */
  private afterCheckpoint() {
    if (this.cpIdx + 1 < this.checkpoints.length) {
      this.cpIdx++;
      this.showCheckpoint();
    } else {
      this.phase = "understanding";
      this.shownAt = this.now();
    }
  }

  private startTrial() {
    this.cpIdx = 0;
    this.stage1 = null;
    this.pending = null;
    this.log("trial_start", { practice: this.trialIdx === 0, position: this.trial.position, story: this.trial.story, regime: this.trial.regime, variant: this.trial.variant });
    this.showCheckpoint();
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
    if (this.phase === "intro" || this.phase === "presurvey" || this.phase === "postsurvey" || this.phase === "debrief" || this.phase === "finished") return base;

    const story = this.story;
    const cp = this.checkpoint;
    const variant = this.trial.variant;
    if (this.showCondition) base.debugTag = `${REGIME_LETTER[this.trial.regime]}·${variant === "Flawed" ? "F" : "C"}`;
    base.story = { title: story.def.title, brief: story.def.brief, project: story.def.project, plan: story.def.steps.map((s) => ({ n: s.n, summary: s.summary })) };

    if (this.phase === "understanding") {
      base.understanding = {
        items: story.def.understanding.items.map((item, k) => ({
          question: item.question,
          options: this.trial.understandingOptionOrders[k]!.map((i) => item.options[i]!),
        })),
      };
      return base;
    }

    const shown = stepsOf(cp);
    base.agentSteps = story.def.steps
      .filter((s) => shown.includes(s.n))
      .map((s) => ({ n: s.n, summary: s.summary, narration: s.narration, files: s.files.map((f) => f.path) }));
    base.checkpoint = {
      id: cp.id,
      scored: cp.scored,
      diffs: cp.steps ? cp.steps.flatMap((n) => story.diff(variant, n, n)) : story.diff(variant, cp.fromStep, cp.toStep),
      workspace: [...story.projectWorkspace(variant, cp.toStep)].map(([path, content]) => ({ path, content })),
    };
    if (this.phase === "stage2") {
      base.initialDecision = this.stage1!.decision;
      base.probe = {
        question: story.def.probe.question,
        options: this.trial.probeOptionOrder.map((i) => story.def.probe.options[i]!),
      };
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
        this.startTrial();
        break;
      }

      case "ready":
        this.require("stage1", "unscored");
        if (!this.ready) {
          // Dwell is measured from here, so the client-side replay of the agent's work is excluded.
          this.log("checkpoint_ready", { replayMs: this.now() - this.shownAt });
          this.ready = true;
          this.shownAt = this.now();
        }
        break;

      case "postsurvey": {
        this.require("postsurvey");
        const { type: _t, ...answers } = action;
        const t = answers.tlx;
        this.postSurvey = {
          ...answers,
          durationMs: this.now() - this.shownAt,
          scores: { rawTlx: (t.mental + t.physical + t.temporal + t.performance + t.effort + t.frustration) / 6 },
        };
        this.log("postsurvey_submit", this.postSurvey);
        this.phase = "debrief";
        this.log("debrief_shown", {});
        break;
      }

      case "advance":
        this.require("unscored");
        this.log("unscored_advance", { checkpoint: this.checkpoint.id, dwellMs: this.now() - this.shownAt });
        this.afterCheckpoint();
        break;

      case "stage1": {
        this.require("stage1");
        this.stage1 = {
          decision: action.decision,
          dwellMs: this.now() - this.shownAt,
          scrollCoverage: action.scrollCoverage,
          testRuns: this.testRuns,
        };
        this.log("stage1_submit", this.stage1);
        this.phase = "stage2";
        this.shownAt = this.now();
        this.log("probe_shown", { trial: this.trial.position });
        break;
      }

      case "stage2": {
        this.require("stage2");
        const story = this.story;
        const s1 = this.stage1!;
        const latency = this.now() - this.shownAt;
        const canonical = action.probeAnswer === -1 ? -1 : this.trial.probeOptionOrder[action.probeAnswer]!;
        const executed = await runProbe(story.testWorkspace(this.trial.variant), story.probeScript());
        const probeCorrect = canonical !== -1 && executed !== null && story.def.probe.options[canonical] === executed;
        const finalDecision: Decision =
          action.final === "confirm" ? s1.decision : s1.decision === "accept" ? "reject" : "accept";
        this.pending = {
          position: this.trial.position,
          story: this.trial.story,
          regime: this.trial.regime,
          variant: this.trial.variant,
          initialDecision: s1.decision,
          finalDecision,
          decisionReversed: finalDecision !== s1.decision,
          stage1DwellMs: s1.dwellMs,
          diffScrollCoverage: s1.scrollCoverage,
          testRunsStage1: s1.testRuns,
          stage2ProbeLatencyMs: latency,
          probeAnswer: canonical,
          probeCorrect,
        };
        this.log("stage2_submit", { ...this.pending, probeExecuted: executed, displayedAnswer: action.probeAnswer });
        this.afterCheckpoint();
        break;
      }

      case "understanding": {
        this.require("understanding");
        const story = this.story;
        const items = story.def.understanding.items;
        const canonical = action.answers.map((a, k) => this.trial.understandingOptionOrders[k]![a]!);
        const corrects = canonical.map((c, k) => c === items[k]!.correct[this.trial.variant]);
        const result: TrialResult = {
          ...(this.pending as Omit<TrialResult, "understandingAnswers" | "understandingCorrects" | "understandingScore" | "confidence" | "mentalDemand" | "frustration">),
          understandingAnswers: canonical,
          understandingCorrects: corrects,
          understandingScore: corrects.filter(Boolean).length,
          confidence: action.confidence,
          mentalDemand: action.mentalDemand,
          frustration: action.frustration,
        };
        if (this.trialIdx === 0) this.practiceResult = result;
        else this.results.push(result);
        this.log("trial_end", { practice: this.trialIdx === 0, ...result });
        this.trialIdx++;
        if (this.trialIdx >= this.allTrials.length) {
          this.phase = "postsurvey";
          this.shownAt = this.now();
          this.log("postsurvey_shown", {});
        } else {
          this.startTrial();
        }
        break;
      }
    }
    this.onTransition();
    return this.view();
  }

  /** Terminal sandbox contents for the current checkpoint, or null when no checkpoint is on screen. */
  terminalContext(): { key: string; project: string; files: Map<string, string> } | null {
    if (this.phase !== "stage1" && this.phase !== "unscored" && this.phase !== "stage2") return null;
    return {
      key: `${this.trialIdx}-${this.cpIdx}`,
      project: this.story.def.project,
      files: this.story.projectWorkspace(this.trial.variant, this.checkpoint.toStep),
    };
  }

  /** Logs a command typed in the terminal; test-like commands before the first decision count as stage-1 test runs. */
  recordTerminalCommand(line: string) {
    this.log("terminal_command", { phase: this.phase, line });
    if (this.phase === "stage1" && TEST_COMMAND.test(line)) this.testRuns++;
  }

  /** UI telemetry (file opened, tab switched) while a checkpoint is on screen. */
  recordUi(type: string, data: unknown) {
    if (this.terminalContext()) this.log(`ui_${type}`, { phase: this.phase, ...(data as object) });
  }

  recordTerminalOpen() {
    this.log("terminal_open", { phase: this.phase });
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
