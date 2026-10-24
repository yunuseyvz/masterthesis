import { Match, Show, Switch, createEffect, onMount, type ParentProps } from "solid-js"
import { useLocation, useNavigate } from "@solidjs/router"
import { useLanguage } from "@/runtime/i18n/language"
import { ServerConnection } from "@/runtime/server/registry"
import { sessionHref } from "@/shell/routes/session"
import { StudyPage } from "./pages"
import { active, error, load, view } from "./store"
import { markRecording, resetCoverage, startRecording, startTelemetry } from "./telemetry"
import "./study.css"

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
