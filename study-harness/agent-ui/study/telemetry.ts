/**
 * What the participant does inside opencode, sent to the study server as `ui_*` events: clicks on controls, the
 * changes view opening and closing, how far the diff was scrolled, which code lines are on screen, files opened,
 * the terminal (commands typed, test results printed), window focus, idleness, and reading back in the chat.
 * The server turns these into per-trial measures (see docs/telemetry.md).
 */

type View = { file: string; from: number; to: number }
type UiEvent =
  | { type: "click"; data: { label: string; area?: string } }
  | { type: "review"; data: { open: boolean } }
  | { type: "diff_scroll"; data: { coverage: number } }
  | { type: "diff_view"; data: { views: View[] } }
  | { type: "file"; data: { name: string } }
  | { type: "terminal"; data: { open: boolean } }
  | { type: "terminal_command"; data: { line: string } }
  | { type: "test_result"; data: { pass: number; fail: number } }
  | { type: "focus"; data: { focused: boolean } }
  | { type: "idle"; data: { idle: boolean } }
  | { type: "chat_scroll"; data: { back: boolean } }
  | { type: "tool_expand"; data: { label: string } }

function send(e: UiEvent) {
  void fetch("/_study/event", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(e), keepalive: true }).catch(() => {})
}

const REVIEW = '[data-component="session-review-v2"], [data-component="session-review"]'
const TERMINAL = '[data-component="terminal"]'
/** No input for this long counts as idle. */
const IDLE_MS = 30_000
/** The chat counts as scrolled back once its end is this far below the visible part. */
const CHAT_BACK_PX = 200

const visible = (el: Element | null) => !!el && (el as HTMLElement).offsetParent !== null
const clean = (s: string) => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "")
const text = (el: Element | null | undefined) => (el?.textContent ?? "").replace(/\s+/g, " ").trim()

/** A short, readable name for the control a click landed on. */
function labelOf(el: Element) {
  const control = el.closest("button, a, [role=tab], [role=treeitem], [role=option], [role=menuitem]")
  const slot = el.closest("[data-slot]:not([data-slot^=icon])")
  const target = control ?? slot ?? el
  const label = target.getAttribute("aria-label") || text(target) || target.getAttribute("data-slot") || ""
  return label.slice(0, 80)
}

/**
 * The terminal's websocket: every line typed (one per Enter) and the summary of every `node --test` run printed in it.
 * Installed before opencode opens a terminal, so its sockets are created through this subclass.
 */
function watchTerminal() {
  const isPty = (url: string) => /\/api\/(experimental\/persistent-pty|pty)\//.test(url)
  const lines = new WeakMap<WebSocket, string>()
  const original = WebSocket.prototype.send
  WebSocket.prototype.send = function (this: WebSocket, data: string | ArrayBufferLike | Blob | ArrayBufferView) {
    if (typeof data === "string" && isPty(this.url)) {
      let line = lines.get(this) ?? ""
      for (const ch of clean(data)) {
        if (ch === "\r" || ch === "\n") {
          if (line.trim()) send({ type: "terminal_command", data: { line: line.trim().slice(0, 500) } })
          line = ""
        } else if (ch === "\x7f" || ch === "\b") line = line.slice(0, -1)
        else if (ch === "\x03" || ch === "\x15") line = ""
        else if (ch >= " ") line += ch
      }
      lines.set(this, line)
    }
    return original.call(this, data as never)
  }

  const Native = window.WebSocket
  window.WebSocket = class extends Native {
    constructor(url: string | URL, protocols?: string | string[]) {
      super(url, protocols)
      if (!isPty(String(url))) return
      let out = ""
      this.addEventListener("message", (m) => {
        if (typeof m.data !== "string") return
        out = (out + clean(m.data)).slice(-20_000)
        // node --test ends with "ℹ tests N … ℹ pass N … ℹ fail N".
        const summary = /ℹ pass (\d+)[\s\S]*?ℹ fail (\d+)/.exec(out)
        if (!summary) return
        send({ type: "test_result", data: { pass: Number(summary[1]), fail: Number(summary[2]) } })
        out = out.slice(summary.index + summary[0].length)
      })
    }
  } as typeof WebSocket
}

/** The file a code view shows: the changes view's file header, otherwise the file last picked in a file tree. */
let lastFile = ""
function fileOf(host: Element) {
  const review = host.closest(REVIEW)
  if (!review) return lastFile
  const dir = text(review.querySelector('[data-slot="session-review-v2-file-path"]'))
  const name = text(review.querySelector('[data-slot="session-review-v2-file-name"]'))
  if (!name) return lastFile
  return dir ? `${dir.replace(/\/?$/, "/")}${name}` : name
}

/** The part of the viewport where `el` can be seen: clipped by every scrolling or clipping ancestor. */
function clipOf(el: Element) {
  let top = 0
  let bottom = window.innerHeight
  for (let e = el.parentElement; e; e = e.parentElement) {
    if (getComputedStyle(e).overflowY === "visible") continue
    const r = e.getBoundingClientRect()
    top = Math.max(top, r.top)
    bottom = Math.min(bottom, r.bottom)
  }
  return { top, bottom }
}

/**
 * Code lines on screen, per code view (opencode renders diffs and files with @pierre/diffs, one line per
 * `[data-line]` in a shadow root). Only the new side counts: deleted lines have no place in the code as it is now.
 */
function codeOnScreen(): View[] {
  if (document.visibilityState !== "visible") return []
  const views: View[] = []
  for (const host of document.querySelectorAll("diffs-container")) {
    if (!visible(host) || !host.shadowRoot) continue
    const file = fileOf(host)
    if (!file) continue
    const clip = clipOf(host)
    let from = Infinity
    let to = 0
    for (const line of host.shadowRoot.querySelectorAll("[data-line]")) {
      if (line.getAttribute("data-line-type") === "change-deletion" || line.closest("[data-deletions]")) continue
      const r = line.getBoundingClientRect()
      if (r.height === 0 || r.bottom <= clip.top || r.top >= clip.bottom) continue
      const n = Number(line.getAttribute("data-line"))
      if (!n) continue
      from = Math.min(from, n)
      to = Math.max(to, n)
    }
    if (to) views.push({ file: file.slice(0, 300), from, to })
  }
  return views.slice(0, 10)
}

let started = false
let best = 0
let reportCoverage = () => {}

export function startTelemetry() {
  if (started) return
  started = true
  watchTerminal()

  let lastInput = Date.now()
  let idle = false
  const onInput = (e: Event) => {
    if (!e.isTrusted) return
    lastInput = Date.now()
    if (idle) {
      idle = false
      send({ type: "idle", data: { idle: false } })
    }
  }
  for (const type of ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"]) document.addEventListener(type, onInput, { capture: true, passive: true })
  // Input that scrolls: the wheel, keys, touch, or pressing on a scroll area itself (its scrollbar).
  let lastScrollInput = 0
  const onScrollInput = (e: Event) => {
    if (!e.isTrusted) return // the study's own scrolling (gate.tsx) is not the participant's
    if (e.type !== "pointerdown" || (e.target instanceof Element && e.target.scrollHeight > e.target.clientHeight)) lastScrollInput = Date.now()
  }
  for (const type of ["wheel", "keydown", "touchmove", "pointerdown"]) document.addEventListener(type, onScrollInput, { capture: true, passive: true })

  // A (re)loaded page starts from a clean state; tell the server, whose state may be left over from the last page.
  const hasFocus = () => document.visibilityState === "visible" && document.hasFocus()
  let focused = hasFocus()
  send({ type: "focus", data: { focused } })
  send({ type: "idle", data: { idle: false } })
  send({ type: "review", data: { open: false } })
  send({ type: "diff_view", data: { views: [] } })
  const onFocus = () => {
    const now = hasFocus()
    if (now === focused) return
    focused = now
    send({ type: "focus", data: { focused: now } })
  }
  window.addEventListener("focus", onFocus)
  window.addEventListener("blur", onFocus)
  document.addEventListener("visibilitychange", onFocus)

  document.addEventListener(
    "click",
    (e) => {
      const el = e.target instanceof Element ? e.target : null
      // The study's own prompts and pages are logged by the server; their clicks are not participant activity in opencode.
      if (!el || el.closest("[data-study-dock], [data-study-page]")) return
      const review = el.closest(REVIEW)
      send({ type: "click", data: { label: labelOf(el), area: review ? "review" : el.closest(TERMINAL) ? "terminal" : undefined } })
      // A file picked in a file tree (the changes view or the file browser); folders have no extension.
      const row = el.closest("[data-path]")
      const name = row?.getAttribute("data-path") ?? ""
      if (row && /\.[a-z0-9]+$/i.test(name)) {
        lastFile = name
        send({ type: "file", data: { name: name.slice(0, 300) } })
      }
      // Expanding a collapsed tool call in the chat (still collapsed while this capture listener runs).
      const toggle = el.closest('[data-component="collapsed-tool-group"] [aria-expanded], [data-component="tool-trigger"]')
      const group = toggle?.closest('[data-component="collapsed-tool-group"], [data-component="tool-trigger"]')
      if (toggle && toggle.getAttribute("aria-expanded") !== "true") send({ type: "tool_expand", data: { label: text(group ?? toggle).slice(0, 200) } })
    },
    true,
  )

  // Diff coverage: the furthest point reached in the changes view's longest scroll area (1 = scrolled to the end).
  reportCoverage = () => {
    const review = document.querySelector(REVIEW)
    if (!visible(review)) return
    let main: HTMLElement | null = null
    for (const el of review!.querySelectorAll<HTMLElement>("*")) {
      if (el.scrollHeight > el.clientHeight + 4 && (!main || el.scrollHeight > main.scrollHeight)) main = el
    }
    const coverage = main ? Math.min(1, (main.scrollTop + main.clientHeight) / main.scrollHeight) : 1
    if (coverage >= best + 0.05 || (coverage === 1 && best < 1)) {
      best = coverage
      send({ type: "diff_scroll", data: { coverage: Math.round(coverage * 100) / 100 } })
    }
  }

  // Reading back in the chat: its scroll area moved away from the end by the participant (not by new messages or layout).
  let chatBack = false
  document.addEventListener(
    "scroll",
    (e) => {
      const el = e.target instanceof Element ? e.target : null
      if (!el) return
      if (el.closest(REVIEW)) return reportCoverage()
      if (!el.querySelector('[data-component="session-turn"]')) return
      const back = el.scrollHeight - el.scrollTop - el.clientHeight > CHAT_BACK_PX
      if (back === chatBack || (back && Date.now() - lastScrollInput > 1000)) return
      chatBack = back
      send({ type: "chat_scroll", data: { back } })
    },
    true,
  )

  // Open/closed state of the changes view and the terminal, the code on screen, and idleness, twice a second.
  let reviewOpen = false
  let terminalOpen = false
  let onScreen = "[]"
  setInterval(() => {
    const r = visible(document.querySelector(REVIEW))
    if (r !== reviewOpen) {
      reviewOpen = r
      send({ type: "review", data: { open: r } })
      if (r) {
        best = 0
        setTimeout(reportCoverage, 300)
      }
    }
    const t = visible(document.querySelector(TERMINAL))
    if (t !== terminalOpen) {
      terminalOpen = t
      send({ type: "terminal", data: { open: t } })
    }
    const views = codeOnScreen()
    const key = JSON.stringify(views)
    if (key !== onScreen) {
      onScreen = key
      send({ type: "diff_view", data: { views } })
    }
    onFocus() // focus events can be missed (e.g. focus arriving while the page loads)
    if (!idle && Date.now() - lastInput >= IDLE_MS) {
      idle = true
      send({ type: "idle", data: { idle: true } })
    }
  }, 500)
}

/** A new agent turn or trial: count diff coverage from zero again (the server keeps everything else per trial). */
export function resetCoverage() {
  best = 0
  setTimeout(() => reportCoverage(), 300)
}

type Rrweb = { record: ((o: object) => (() => void) | undefined) & { addCustomEvent(tag: string, payload: unknown): void } }
let recorder: Rrweb | undefined
let recording = false
/** The phase marked before rrweb finished loading; marked as soon as it records. */
let pendingMark: { phase: string; trial: number } | undefined

/**
 * Screen recording with rrweb (DOM snapshots and changes, not video), for qualitative follow-up. Batches go to the
 * study server every 5 s. The terminal is drawn on a canvas and not recorded; its commands are logged above.
 */
export function startRecording() {
  if (recording) return
  recording = true
  let buffer: unknown[] = []
  const flush = () => {
    if (!buffer.length) return
    const body = JSON.stringify({ events: buffer })
    buffer = []
    void fetch("/_study/recording", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: body.length < 60_000 }).catch(() => {})
  }
  const script = document.createElement("script")
  script.src = "/_study/rrweb.js"
  script.onload = () => {
    recorder = (window as unknown as { rrweb: Rrweb }).rrweb
    recorder.record({
      emit: (e: unknown) => buffer.push(e),
      sampling: { mousemove: 200, scroll: 200, input: "last" },
      recordCanvas: false,
      collectFonts: false,
      maskInputOptions: { password: true },
    })
    if (pendingMark) markRecording(pendingMark.phase, pendingMark.trial)
    setInterval(flush, 5000)
    window.addEventListener("pagehide", flush)
  }
  document.head.appendChild(script)
}

/** Marks a study phase change in the recording, so a replay can jump to it. */
export function markRecording(phase: string, trial: number) {
  if (!recorder) {
    pendingMark = { phase, trial }
    return
  }
  recorder.record.addCustomEvent("study", { phase, trial })
}
