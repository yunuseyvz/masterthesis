import { z } from "zod";
import { Confidence, Style, UNDERSTANDING_ITEMS, type Decision } from "./schema.js";

/** What the client may see. Never contains variant, ground truth, or regime. */

/**
 * plan: the agent's plan is shown, the participant approves it. working: the agent is running (or finishing after the
 * decision). stage1/stage2: the scored review. reviewing: the feature is finished, the participant confirms they are
 * done looking before the code is hidden for the understanding questions.
 */
export type Phase =
  | "intro" | "presurvey" | "plan" | "working" | "stage1" | "stage2" | "reviewing" | "understanding" | "postsurvey" | "debrief" | "finished";

export interface ViewState {
  phase: Phase;
  /** Demo deployment: Finish starts a fresh session, so the last screen offers to start again. */
  demo?: boolean;
  participantId: string;
  /** 1-based position in the session (the practice trial is 1); 0 before the first trial. */
  trial: number;
  /** Number of measured trials (excludes practice). */
  nTrials: number;
  practice: boolean;
  /** Session recording (rrweb) is on: the agent UI records the screen and sends it to the server. */
  recording?: boolean;
  /** Experimenter aid, only set when the server runs with SHOW_CONDITION=1: regime letter (B/M/N) and variant letter (C/F). */
  debugTag?: string;
  /** Features started so far (the sidebar). */
  sessions: { trial: number; title: string; project: string }[];
  story?: { title: string; brief: string; project: string; plan: { n: number; summary: string }[] };
  /** This trial's session in opencode; the agent UI opens it (the study page and opencode share one origin). */
  agentSessionId?: string;
  /** True once the agent has written the whole feature (after the scored review, or at the review for BATCH). */
  finished?: boolean;
  initialDecision?: Decision;
  probe?: { question: string; options: string[] };
  understanding?: { items: { question: string; options: string[] }[] };
}

export const Demographics = z.object({
  ageGroup: z.enum(["18-24", "25-34", "35-44", "45-54", "55+", "no-answer"]),
  programmingYears: z.enum(["<1", "1-3", "3-5", "5-10", "10+"]),
  aiAssistantUse: z.enum(["never", "rarely", "monthly", "weekly", "daily"]),
  codeReviewFrequency: z.enum(["never", "rarely", "monthly", "weekly", "daily"]),
  tsFamiliarity: z.number().int().min(1).max(5),
});
export type Demographics = z.infer<typeof Demographics>;

const Scale = (max: number) => z.number().int().min(1).max(max);

export const Action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("begin") }),
  /** The participant read the agent's plan and lets it start. */
  z.object({ type: z.literal("approvePlan") }),
  /** The participant is done looking at the finished feature; the code is hidden from here on. */
  z.object({ type: z.literal("reviewed") }),
  z.object({
    type: z.literal("presurvey"),
    consent: z.literal(true),
    demographics: Demographics,
    /** NCS-6 items in presented order, 1-5 (items 3 and 4 are reverse-keyed on the server). */
    ncs: z.array(z.number().int().min(1).max(5)).length(6),
    /** Instructed-response attention check, 1-5. */
    attention: z.number().int().min(1).max(5),
    /** S-TIAS items in presented order, 1-7. */
    stias: z.array(z.number().int().min(1).max(7)).length(3),
  }),
  z.object({ type: z.literal("stage1"), decision: z.enum(["accept", "reject"]) }),
  z.object({
    type: z.literal("postsurvey"),
    /** Preferred oversight style, best first. */
    ranking: z.array(Style).length(2).refine((r) => new Set(r).size === 2, "each style once"),
    comment: z.string().max(2000).optional(),
  }),
  z.object({
    type: z.literal("stage2"),
    /** Index into the displayed options, or -1 for "I don't know". */
    probeAnswer: z.number().int().min(-1).max(3),
    final: z.enum(["confirm", "reverse"]),
  }),
  z.object({
    type: z.literal("understanding"),
    /** Index into the displayed options, one entry per item. */
    answers: z.array(z.number().int().min(0).max(3)).length(UNDERSTANDING_ITEMS),
    /** Confidence in each answer, 50-100 %. */
    confidences: z.array(Confidence).length(UNDERSTANDING_ITEMS),
    /** Paas mental-effort scale for this feature, 1-9. */
    paas: Scale(9),
    /** Time spent on each question's screen (summed over visits, including after going back), ms. */
    itemMs: z.array(z.number().nonnegative()).length(UNDERSTANDING_ITEMS),
    /** How often each answer was changed after the first pick. */
    answerChanges: z.array(z.number().int().nonnegative()).length(UNDERSTANDING_ITEMS),
  }),
]);
export type Action = z.infer<typeof Action>;

/** What the participant does inside opencode, reported by the study build of its web app. */
export const UiEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), data: z.object({ label: z.string().max(200), area: z.string().max(40).optional() }) }),
  z.object({ type: z.literal("review"), data: z.object({ open: z.boolean() }) }),
  z.object({ type: z.literal("diff_scroll"), data: z.object({ coverage: z.number().min(0).max(1) }) }),
  z.object({ type: z.literal("file"), data: z.object({ name: z.string().max(300) }) }),
  z.object({ type: z.literal("terminal"), data: z.object({ open: z.boolean() }) }),
  z.object({ type: z.literal("terminal_command"), data: z.object({ line: z.string().max(1000) }) }),
  /** Result of a test run seen in the terminal (node --test summary). */
  z.object({ type: z.literal("test_result"), data: z.object({ pass: z.number().int().nonnegative(), fail: z.number().int().nonnegative() }) }),
  /** Code lines on screen right now, per file (new-file line numbers); sent whenever this changes, [] when none. */
  z.object({
    type: z.literal("diff_view"),
    data: z.object({ views: z.array(z.object({ file: z.string().max(300), from: z.number().int().min(1), to: z.number().int().min(1) })).max(10) }),
  }),
  /** The study window gained or lost focus (another window or tab in front, or minimised). */
  z.object({ type: z.literal("focus"), data: z.object({ focused: z.boolean() }) }),
  /** No mouse, keyboard or scroll input for 30 s (idle: true), or input again (idle: false). */
  z.object({ type: z.literal("idle"), data: z.object({ idle: z.boolean() }) }),
  /** The chat was scrolled back from its end (back: true) or returned to it (back: false). */
  z.object({ type: z.literal("chat_scroll"), data: z.object({ back: z.boolean() }) }),
  /** A collapsed tool call in the chat ("Used 2 Write, Shell") was expanded. */
  z.object({ type: z.literal("tool_expand"), data: z.object({ label: z.string().max(200) }) }),
]);
export type UiEvent = z.infer<typeof UiEvent>;
