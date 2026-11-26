import { createEffect, createRoot } from "solid-js"
import { afk, view } from "./store"

// Behind Conditioner, its nginx puts window.__STUDY__ into the page. Each change of phase or trial goes to its
// tracking endpoint, so the dashboard shows where every participant is. Only the position in the study, no answers.
let started = false

export function startProgress() {
  if (started) return
  started = true
  const target = (window as { __STUDY__?: { study: string; user: string } }).__STUDY__
  if (!target) return
  const url = `/__tracking/${encodeURIComponent(target.study)}/${encodeURIComponent(target.user)}/progress`
  let last = ""
  createRoot(() =>
    createEffect(() => {
      const v = view()
      if (!v) return
      const payload = { phase: v.phase, trial: v.trial, nTrials: v.nTrials, practice: v.practice, afk: afk() }
      const key = JSON.stringify(payload)
      if (key === last) return
      last = key
      void fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payload, client_ts: new Date().toISOString() }),
        keepalive: true,
      }).catch(() => {})
    }),
  )
}
