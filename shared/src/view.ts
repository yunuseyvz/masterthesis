import { z } from "zod";
import { Confidence, Style, UNDERSTANDING_ITEMS, type Decision } from "./schema.js";

export type Phase =
  | "presurvey" | "intro" | "plan" | "working" | "stage1" | "stage2" | "feedback" | "reviewing" | "understanding" | "ready" | "postsurvey" | "debrief" | "finished" | "abandoned";

export const Presence = z.object({
  inputAgoMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
  confirm: z.boolean().optional(),
});
export type Presence = z.infer<typeof Presence>;

export interface ViewState {
  phase: Phase;
  demo?: boolean;
  participantId: string;
  trial: number;
  nTrials: number;
  practice: boolean;
  recording?: boolean;
  // consent was given on Conditioner's entry page, so the questionnaire does not ask again
  externalConsent?: boolean;
  // the session ended in an earlier run of the pod; this one only shows that end
  earlier?: boolean;
  debugTag?: string;
  sessions: { trial: number; title: string; project: string }[];
  story?: { title: string; brief: string; project: string };
  agentSessionId?: string;
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
  // from the "You're ready" page after the practice to the first measured feature
  z.object({ type: z.literal("continue") }),
  z.object({ type: z.literal("approvePlan") }),
  z.object({ type: z.literal("reviewed") }),
  z.object({
    type: z.literal("presurvey"),
    consent: z.literal(true),
    demographics: Demographics,
    // items 3 and 4 are reverse-keyed on the server
    ncs: z.array(z.number().int().min(1).max(5)).length(6),
    attention: z.number().int().min(1).max(5),
    stias: z.array(z.number().int().min(1).max(7)).length(3),
  }),
  z.object({ type: z.literal("stage1"), decision: z.enum(["accept", "reject"]) }),
  z.object({
    type: z.literal("postsurvey"),
    // favourite first
    ranking: z.array(Style).length(2).refine((r) => new Set(r).size === 2, "each style once"),
    // how strongly: 1 slightly, 2 clearly, 3 strongly
    strength: z.number().int().min(1).max(3),
    // the order the two were shown in, left first
    shown: z.array(Style).length(2).optional(),
    comment: z.string().max(2000).optional(),
  }),
  z.object({
    type: z.literal("stage2"),
    // -1 = "I don't know"
    probeAnswer: z.number().int().min(-1).max(3),
    final: z.enum(["confirm", "reverse"]),
  }),
  z.object({
    type: z.literal("understanding"),
    answers: z.array(z.number().int().min(0).max(3)).length(UNDERSTANDING_ITEMS),
    confidences: z.array(Confidence).length(UNDERSTANDING_ITEMS),
    paas: Scale(9),
    review: z.object({ timing: Scale(7), helped: Scale(7), disrupted: Scale(7) }),
    itemMs: z.array(z.number().nonnegative()).length(UNDERSTANDING_ITEMS),
    answerChanges: z.array(z.number().int().nonnegative()).length(UNDERSTANDING_ITEMS),
  }),
]);
export type Action = z.infer<typeof Action>;

export const UiEvent = z.discriminatedUnion("type", [
  z.object({ type: z.literal("click"), data: z.object({ label: z.string().max(200), area: z.string().max(40).optional() }) }),
  z.object({ type: z.literal("review"), data: z.object({ open: z.boolean() }) }),
  z.object({ type: z.literal("diff_scroll"), data: z.object({ coverage: z.number().min(0).max(1) }) }),
  z.object({ type: z.literal("file"), data: z.object({ name: z.string().max(300) }) }),
  z.object({ type: z.literal("terminal"), data: z.object({ open: z.boolean() }) }),
  z.object({ type: z.literal("terminal_command"), data: z.object({ line: z.string().max(1000) }) }),
  z.object({ type: z.literal("test_result"), data: z.object({ pass: z.number().int().nonnegative(), fail: z.number().int().nonnegative() }) }),
  // new-file line numbers
  z.object({
    type: z.literal("diff_view"),
    data: z.object({ views: z.array(z.object({ file: z.string().max(300), from: z.number().int().min(1), to: z.number().int().min(1) })).max(10) }),
  }),
  z.object({ type: z.literal("focus"), data: z.object({ focused: z.boolean() }) }),
  z.object({ type: z.literal("idle"), data: z.object({ idle: z.boolean() }) }),
  z.object({ type: z.literal("chat_scroll"), data: z.object({ back: z.boolean() }) }),
  z.object({ type: z.literal("tool_expand"), data: z.object({ label: z.string().max(200) }) }),
]);
export type UiEvent = z.infer<typeof UiEvent>;
