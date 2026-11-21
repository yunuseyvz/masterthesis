import { createSignal } from "solid-js"

/** The study server's view (see beacon shared/src/view.ts). Variant, regime and answers never reach the browser. */
export type StudyPhase =
  | "intro"
  | "presurvey"
  | "plan"
  | "working"
  | "stage1"
  | "stage2"
  | "feedback"
  | "reviewing"
  | "understanding"
  | "postsurvey"
  | "debrief"
  | "finished"
  | "abandoned"

export interface StudyView {
  phase: StudyPhase
  demo?: boolean
  participantId: string
  trial: number
  nTrials: number
  practice: boolean
  debugTag?: string
  recording?: boolean
  completionUrl?: string
  story?: { title: string; brief: string; project: string }
  agentSessionId?: string
  finished?: boolean
  initialDecision?: "accept" | "reject"
  probe?: { question: string; options: string[] }
  understanding?: { items: { question: string; options: string[] }[] }
}

/** Phases where opencode itself is on screen (with the study prompt in place of the composer). */
export const AGENT_PHASES: StudyPhase[] = ["plan", "working", "stage1", "stage2", "feedback", "reviewing"]

// opencode asks for system notification permission when the agent finishes; a browser popup has no place in the
// study. Its own completion sound stays (the same in every condition).
if (typeof Notification !== "undefined") {
  try {
    Object.defineProperty(Notification, "requestPermission", { value: async () => "denied", configurable: true })
  } catch {
    /* read-only in this browser: the popup may appear */
  }
}

const [view, setView] = createSignal<StudyView | undefined>()
const [busy, setBusy] = createSignal(false)
const [error, setError] = createSignal<string | undefined>()
export { view, busy, error }

async function call<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(`/_study/${path}`, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`)
  return res.json() as Promise<T>
}

const PARTICIPANT_KEY = "beacon.participant"

/**
 * opencode remembers open tabs, drafts and layout in the browser. A new participant (or a restarted container,
 * whose sessions are gone) must not inherit them: clear opencode's storage once and reload.
 */
function resetForParticipant(id: string) {
  try {
    if (localStorage.getItem(PARTICIPANT_KEY) === id) return false
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem(PARTICIPANT_KEY, id)
    location.reload()
    return true
  } catch {
    return false
  }
}

let loading: Promise<void> | undefined
export function load() {
  loading ??= call<StudyView>("state", undefined, "GET").then(
    (v) => void (resetForParticipant(v.participantId) || setView(v)),
    (e) => void setError(String(e)),
  )
  return loading
}

/** Sends one study action; actions that start an agent turn resolve once the agent has stopped. */
export async function act(action: Record<string, unknown>) {
  if (busy()) return
  setBusy(true)
  // Show the agent as working right away, without waiting for the server's answer.
  if (action.type === "approvePlan" || (action.type === "stage2" && !view()?.finished)) setView((v) => v && { ...v, phase: "working" })
  try {
    setView(await call<StudyView>("action", action))
  } catch (e) {
    setError(String(e))
  } finally {
    setBusy(false)
  }
}

export async function finish() {
  setBusy(true)
  try {
    await call("finish", {})
  } catch (e) {
    // The server shuts down right after answering, so the connection may close mid-response.
    if (!(e instanceof TypeError)) setError(String(e))
  } finally {
    setBusy(false)
  }
  // Behind a study platform: back to it, which records the completion.
  const completion = view()?.completionUrl
  if (completion && !error()) location.assign(completion)
}

/** Live, after a rejection: the agent has asked what to change, and opencode's own composer is the participant's answer. */
export const composerOpen = () => view()?.phase === "feedback"

// The participant's answer goes straight to opencode (not through a study action), so while the agent asks or works
// on after it, the study state is fetched until it moves on.
setInterval(() => {
  const v = view()
  if (!v || busy() || (v.phase !== "feedback" && v.phase !== "working")) return
  call<StudyView>("state", undefined, "GET").then((next) => setView(next), () => {})
}, 1500)

// Presence (StudySession.watch on the server): the last mouse, keyboard, scroll or touch input, reported every 30 s.
// After a long stretch without input the server asks "Are you still there?"; without an answer the session ends.
let lastInput = Date.now()
for (const type of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"])
  document.addEventListener(type, () => (lastInput = Date.now()), { capture: true, passive: true })
const [afk, setAfk] = createSignal(false)
export { afk }

async function reportPresence(confirm = false) {
  const v = view()
  if (!v || v.phase === "finished" || v.phase === "abandoned") return
  try {
    const r = await call<{ prompt: boolean; ended: boolean }>("presence", { inputAgoMs: Math.max(0, Date.now() - lastInput), confirm })
    setAfk(r.prompt)
    if (r.ended) setView(await call<StudyView>("state", undefined, "GET"))
  } catch {
    /* the server may be gone after the session ended; the page stays as it is */
  }
}
setInterval(() => void reportPresence(), 30_000)

/** The participant answered "Are you still there?". */
export function stillHere() {
  lastInput = Date.now()
  setAfk(false)
  void reportPresence(true)
}

export const active = () => {
  const v = view()
  return !!v && AGENT_PHASES.includes(v.phase)
}
