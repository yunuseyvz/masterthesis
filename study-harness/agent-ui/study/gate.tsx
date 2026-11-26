import { Match, Show, Switch, createEffect, onCleanup, onMount, type ParentProps } from "solid-js"
import { useLocation, useNavigate } from "@solidjs/router"
import { useLanguage } from "@/runtime/i18n/language"
import { ServerConnection } from "@/runtime/server/registry"
import { sessionHref } from "@/shell/routes/session"
import { StudyPage } from "./pages"
import { PracticeTour } from "./tour"
import { active, afk, error, load, stillHere, view } from "./store"
import { Button } from "@opencode/ui/button"
import { markRecording, resetCoverage, startRecording, startTelemetry } from "./telemetry"
import "./study.css"

const timeline = () => document.querySelector<HTMLElement>('[data-slot="session-timeline-scroll"] > .scroll-view__viewport')

export function StudyGate(props: ParentProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const language = useLanguage()
  onMount(() => {
    document.body.dataset.study = "1"
    language.setLocale("en")
    startTelemetry()
    const onTab = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('[data-slot="titlebar-tab-item"]') && (e.type === "contextmenu" || e.button === 1)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener("contextmenu", onTab, true)
    document.addEventListener("auxclick", onTab, true)
    document.addEventListener("mousedown", onTab, true)
    void load()
  })

  createEffect(() => {
    const phase = view()?.phase
    if (phase !== "stage1" && phase !== "reviewing") return
    resetCoverage()
    // The changes view reloads the working tree's diff (patch in review/model.ts).
    window.dispatchEvent(new Event("study:review"))
  })

  createEffect(() => {
    const v = view()
    if (!v?.recording) return
    startRecording()
    markRecording(v.phase, v.trial)
  })

  // opencode follows the newest content until upward input: fake an upward wheel to release it, then scroll to the top.
  let topFor: string | undefined
  createEffect(() => {
    const v = view()
    if (!v?.agentSessionId) return
    const id = v.agentSessionId
    if (v.phase === "working" && topFor === id) {
      topFor = undefined
      const el = timeline()
      if (el) el.scrollTop = el.scrollHeight
      return
    }
    if (v.phase !== "plan" || topFor === id) return
    const timer = setInterval(() => {
      const el = timeline()
      if (!el || el.scrollHeight - el.clientHeight <= 1) return
      el.dispatchEvent(new WheelEvent("wheel", { deltaY: -1, bubbles: true }))
      el.scrollTop = 0
      topFor = id
      clearInterval(timer)
    }, 200)
    onCleanup(() => clearInterval(timer))
  })

  createEffect(() => {
    const v = view()
    if (!v || !active() || !v.agentSessionId) return
    const href = sessionHref(ServerConnection.Key.make(window.location.origin), v.agentSessionId)
    if (location.pathname !== href) navigate(href, { replace: true })
  })

  return (
    <>
      <Show when={afk()}>
        <div data-study-afk role="alertdialog" aria-labelledby="study-afk-title">
          <div data-study-card>
            <h1 id="study-afk-title">Are you still there?</h1>
            <p>There has been no activity for a while. Continue where you left off.</p>
            <div data-study-actions>
              <Button variant="submit" size="large" onClick={stillHere}>
                Continue
              </Button>
            </div>
          </div>
        </div>
      </Show>
      <Switch>
        <Match when={error()}>
          <pre data-study-error>{error()}</pre>
        </Match>
        <Match when={!view()}>
          <div data-study-page />
        </Match>
        <Match when={!active()}>
          <StudyPage />
        </Match>
        <Match when={active()}>
          <Show when={view()!.debugTag}>
            <div data-study-tag title="regime · variant (experimenter view)">
              {view()!.participantId} {view()!.debugTag}
            </div>
          </Show>
          {props.children}
          <Show when={view()!.practice}>
            <PracticeTour />
          </Show>
        </Match>
      </Switch>
    </>
  )
}
