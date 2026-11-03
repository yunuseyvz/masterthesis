import { Match, Show, Switch, createEffect, onCleanup, onMount, type ParentProps } from "solid-js"
import { useLocation, useNavigate } from "@solidjs/router"
import { useLanguage } from "@/runtime/i18n/language"
import { ServerConnection } from "@/runtime/server/registry"
import { sessionHref } from "@/shell/routes/session"
import { StudyPage } from "./pages"
import { active, error, load, view } from "./store"
import { markRecording, resetCoverage, startRecording, startTelemetry } from "./telemetry"
import "./study.css"

/** The scroll area of opencode's chat timeline. */
const timeline = () => document.querySelector<HTMLElement>('[data-slot="session-timeline-scroll"] > .scroll-view__viewport')

/**
 * Study mode for opencode's web app. The study server decides what is on screen: its own pages (questionnaires,
 * the understanding questions) or opencode on the current trial's session, with the study prompt in place of the
 * composer (see dock.tsx). Navigation that would leave the trial's session (home, new session, other tabs) is hidden.
 */
export function StudyGate(props: ParentProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const language = useLanguage()
  onMount(() => {
    document.body.dataset.study = "1"
    // The study is in English; keep opencode's own labels in the same language.
    language.setLocale("en")
    startTelemetry()
    // Tabs cannot be closed or managed: no context menu, no middle-click on a tab.
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

  // The review is a new view of the code: diff coverage counts from zero when the agent stops.
  createEffect(() => {
    const phase = view()?.phase
    if (phase === "stage1" || phase === "reviewing") resetCoverage()
  })

  // Screen recording, when the server has it on; each phase change is marked in it.
  createEffect(() => {
    const v = view()
    if (!v?.recording) return
    startRecording()
    markRecording(v.phase, v.trial)
  })

  // A new story opens at its start (the user story, then the plan as it arrives), not at the newest message.
  // opencode follows the newest content until upward input; a synthetic upward wheel releases that, then scroll to
  // the top. Once the plan is approved, scrolling to the end makes opencode follow the agent's work again.
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
      </Match>
    </Switch>
  )
}
