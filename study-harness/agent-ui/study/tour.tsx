import { For, Show, createEffect, createSignal, onCleanup, onMount, type JSX } from "solid-js"
import { Button } from "@opencode/ui/button"
import { view, type StudyPhase } from "./store"

// The practice feature's guide: a spotlight on one part of the screen at a time, with a card that explains it.
// Only in the practice; the measured features show no guidance. Clicks pass through the dimmed area.

const REVIEW = '[data-component="session-review-v2"], [data-component="session-review"]'

// above: for the bottom bar, so the card covers the chat rather than the terminal.
type Step = { target: () => Element | null; title: string; body: JSX.Element; tasks?: boolean; above?: boolean }

const shown = (el: Element) => {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}
// The first visible match: opencode keeps hidden copies of some panels.
const q = (sel: string) => () => [...document.querySelectorAll(sel)].find(shown) ?? null
const firstIn = (sel: string) => q(`[data-slot="session-timeline-scroll"] ${sel}`)
// The panel's tab back to the changes ("Files Changed n", or "Review" before there are any).
const changesTab = () => [...document.querySelectorAll("[role=tab], button")].find((el) => /^\s*(Files Changed|Review)\b/.test(el.textContent ?? "") && shown(el)) ?? null

// The three things to try once during the practice's first review; Accept and Reject wait for them (dock.tsx).
const [tasks, setTasks] = createSignal({ changes: false, files: false, tests: false })
const [skipped, setSkipped] = createSignal(false)
export const practiceTasksDone = () => skipped() || Object.values(tasks()).every(Boolean)
const TASKS: { key: keyof ReturnType<typeof tasks>; label: string }[] = [
  { key: "changes", label: "Click a changed file in the list on the right" },
  { key: "files", label: "Open any file of the project via Files" },
  { key: "tests", label: "Run npm test in the terminal" },
]

let filesMode = false
// dock.tsx: the Files button switches the panel to the project's file browser.
export const notePracticeFiles = () => void (filesMode = true)

function watchTasks() {
  const onClick = (e: MouseEvent) => {
    if (!e.isTrusted || !(e.target instanceof Element)) return
    const el = e.target
    const tab = el.closest("button, [role=tab]")?.textContent ?? ""
    if (/Open file/.test(tab)) filesMode = true
    else if (/Review|Files Changed|Changes/.test(tab)) filesMode = false
    if (!el.closest(REVIEW)) return
    const file = el.closest("[data-path]")
    if (!file || !/\.[a-z0-9]+$/i.test(file.getAttribute("data-path") ?? "")) return
    setTasks((t) => (filesMode ? { ...t, files: true } : { ...t, changes: true }))
  }
  // telemetry.ts reports every terminal command and test run as a "study:ui" event.
  const onUi = (e: Event) => {
    const { type, data } = (e as CustomEvent<{ type: string; data: { line?: string } }>).detail
    if (type === "test_result" || (type === "terminal_command" && /\bnpm\s+(run\s+)?t(est)?\b/.test(data.line ?? ""))) setTasks((t) => ({ ...t, tests: true }))
  }
  document.addEventListener("click", onClick, true)
  window.addEventListener("study:ui", onUi)
  onCleanup(() => {
    document.removeEventListener("click", onClick, true)
    window.removeEventListener("study:ui", onUi)
  })
}

const STEPS: Partial<Record<StudyPhase, Step[]>> = {
  plan: [
    {
      target: firstIn('[data-component="user-message"]'),
      title: "The user story",
      body: <>Every feature starts with a request from the product owner: what to build, and the acceptance criteria. This one is the practice feature.</>,
    },
    {
      target: firstIn('[data-component="text-part"]'),
      title: "The agent's plan",
      body: <>The agent has answered with a plan in four steps. You don't need to change it.</>,
    },
    {
      target: q('[data-study-tour="approve"]'),
      title: "Let the agent start",
      body: <>Approve the plan, and the agent starts writing the code.</>,
    },
  ],
  working: [
    {
      target: q('[data-slot="session-timeline-scroll"]'),
      title: "The agent is working",
      body: <>It works through the steps one after another, and you can follow along here. When it is your turn, it stops, and the bar at the bottom tells you what to do.</>,
    },
  ],
  stage1: [
    {
      target: q(REVIEW),
      title: "Your review",
      body: (
        <>
          The agent has stopped for your review. This view shows exactly what it wrote since your last review; new lines are green. Click a file
          in the list to see its changes. After opening other files, <b>Files Changed</b> at the top brings you back here.
        </>
      ),
    },
    {
      target: q('[data-study-tour="tools"]'),
      title: "Files and terminal",
      body: <>Files opens any file of the project, not only the changed ones. The terminal runs commands in the project, for example <code>npm test</code>.</>,
    },
    {
      target: q("[data-study-dock]"),
      title: "Try it once",
      body: <>Before you decide, try the tools. This is only in the practice.</>,
      tasks: true,
      above: true,
    },
    {
      target: q('[data-study-tour="decide"]'),
      title: "Decide",
      body: (
        <>
          <b>Accept and continue</b> if the code is fine: the agent goes on with the next steps. <b>Reject / flag defect</b> if something is
          wrong: the agent asks what to change, you answer in the message box, and it fixes this step. In the practice, accept.
        </>
      ),
      above: true,
    },
  ],
  stage2: [
    {
      target: q("[data-study-dock]"),
      title: "One question before you go on",
      body: <>A short question about how the code behaves. If you're not sure, check it in the terminal. Then confirm your decision, or reverse it if you changed your mind.</>,
      above: true,
    },
  ],
  reviewing: [
    {
      target: changesTab,
      title: "The feature is finished",
      body: (
        <>
          The agent has written all the steps. <b>Files Changed</b> shows what it wrote since your review. Look over the final code for as long
          as you like.
        </>
      ),
    },
    {
      target: q("[data-study-dock]"),
      above: true,
      title: "When you're done",
      body: <>Click <b>I've finished reviewing</b>. The code is then hidden, and a colleague asks you a few questions about how it behaves.</>,
    },
  ],
}

type Box = { top: number; left: number; width: number; height: number }
const PAD = 6
const CARD_W = 320

function place(box: Box | null, card: { w: number; h: number }, above = false) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const m = 16
  if (!box) return { left: (vw - card.w) / 2, top: (vh - card.h) / 2 }
  const clampX = (x: number) => Math.min(Math.max(m, x), vw - card.w - m)
  const clampY = (y: number) => Math.min(Math.max(m, y), vh - card.h - m)
  if (above && box.top - m - card.h >= m) return { left: clampX(box.left + box.width - card.w), top: box.top - m - card.h }
  if (box.left + box.width + m + card.w <= vw - m) return { left: box.left + box.width + m, top: clampY(box.top) }
  if (box.left - m - card.w >= m) return { left: box.left - m - card.w, top: clampY(box.top) }
  if (box.top - m - card.h >= m) return { left: clampX(box.left), top: box.top - m - card.h }
  if (box.top + box.height + m + card.h <= vh - m) return { left: clampX(box.left), top: box.top + box.height + m }
  // A large panel: inside it, bottom left.
  return { left: clampX(box.left + m), top: clampY(box.top + box.height - card.h - m) }
}

export function PracticeTour() {
  const [seen, setSeen] = createSignal(new Set<string>())
  const [index, setIndex] = createSignal(0)
  const [box, setBox] = createSignal<Box | null>(null)
  const [pos, setPos] = createSignal({ left: 0, top: 0 })
  let card: HTMLDivElement | undefined

  const phase = () => view()?.phase
  const steps = () => (view()?.practice ? (STEPS[phase()!] ?? []) : [])
  const open = () => steps().length > 0 && !seen().has(phase()!)
  const step = () => steps()[Math.min(index(), steps().length - 1)]

  // A new phase starts its own steps from the first.
  createEffect(() => {
    phase()
    setIndex(0)
  })

  const close = () => setSeen((s) => new Set(s).add(phase()!))
  const next = () => (index() + 1 < steps().length ? setIndex(index() + 1) : close())

  onMount(() => {
    watchTasks()
    let frame = 0
    const tick = () => {
      frame = requestAnimationFrame(tick)
      if (!open()) return
      const el = step()?.target()
      const r = el?.getBoundingClientRect()
      const b = r && r.width > 0 && r.height > 0 ? { top: r.top - PAD, left: r.left - PAD, width: r.width + 2 * PAD, height: r.height + 2 * PAD } : null
      const prev = box()
      if (JSON.stringify(b) !== JSON.stringify(prev)) setBox(b)
      const p = place(b, { w: CARD_W, h: card?.offsetHeight ?? 180 }, step()?.above)
      if (p.left !== pos().left || p.top !== pos().top) setPos(p)
    }
    frame = requestAnimationFrame(tick)
    onCleanup(() => cancelAnimationFrame(frame))
  })

  return (
    <>
      <Show when={open()}>
        <div data-study-tour-layer>
          <Show when={box()} fallback={<div data-study-tour-dim />}>
            {(b) => <div data-study-tour-spot style={{ top: `${b().top}px`, left: `${b().left}px`, width: `${b().width}px`, height: `${b().height}px` }} />}
          </Show>
          <div data-study-tour-card ref={card} style={{ left: `${pos().left}px`, top: `${pos().top}px`, width: `${CARD_W}px` }} role="dialog" aria-live="polite">
            <div data-study-tour-count>
              Practice guide · {index() + 1} of {steps().length}
            </div>
            <h2>{step()?.title}</h2>
            <p>{step()?.body}</p>
            <Show when={step()?.tasks}>
              <ul data-study-tour-tasks>
                <For each={TASKS}>{(t) => <li data-done={tasks()[t.key]}>{t.label}</li>}</For>
              </ul>
            </Show>
            <div data-study-tour-actions>
              <Show when={index() > 0} fallback={<span />}>
                <Button variant="ghost" size="normal" onClick={() => setIndex(index() - 1)}>
                  Back
                </Button>
              </Show>
              <Show
                when={step()?.tasks && !practiceTasksDone()}
                fallback={
                  <Button variant="submit" size="normal" onClick={next}>
                    {index() + 1 < steps().length ? "Next" : "Got it"}
                  </Button>
                }
              >
                <button type="button" data-study-tour-skip onClick={() => setSkipped(true)}>
                  Skip the tasks
                </button>
              </Show>
            </div>
          </div>
        </div>
      </Show>
      <Show when={!open() && steps().length > 0}>
        <button type="button" data-study-tour-again onClick={() => (setIndex(0), setSeen((s) => (s.delete(phase()!), new Set(s))))}>
          Show the guide
        </button>
      </Show>
    </>
  )
}
