import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { DiffFile, ViewState } from "@beacon/shared";
import * as api from "./api";
import { diffStat } from "./diff";
import { Dock } from "./Dock";
import { ArrowUp, Check, Folder, Pencil, Plus, Sparkle } from "./icons";
import { ChangesPane, WorkPane } from "./Panes";
import { PostSurvey } from "./PostSurvey";
import { PreSurvey } from "./PreSurvey";

type ChatItem =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; path: string; isNew: boolean; added: number; removed: number }
  | { kind: "pause"; text: string }
  | { kind: "decision"; text: string };

/** Total time spent replaying the agent's scripted work before each pause (same at every checkpoint). */
const REPLAY_MS = 2400;

function itemsForCheckpoint(view: ViewState): ChatItem[] {
  const cp = view.checkpoint!;
  const out: ChatItem[] = [];
  for (const step of view.agentSteps!) {
    out.push({ kind: "assistant", text: step.summary + "." });
    for (const path of step.files) {
      const d = cp.diffs.find((x) => x.path === path);
      if (!d) continue;
      out.push({ kind: "tool", path, isNew: d.before === "", ...diffStat(d.before, d.after) });
    }
  }
  out.push({ kind: "pause", text: "I've paused so you can review the changes before I go on." });
  return out;
}

/** Timed script for the new items of a checkpoint; total duration is the same for every checkpoint. */
interface Replay { base: number; starts: number[]; durs: number[]; total: number }

function buildReplay(base: number, items: ChatItem[]): Replay {
  const weight = (it: ChatItem) => (it.kind === "tool" ? 2.4 : it.kind === "pause" ? 0.7 : 1);
  const sum = items.reduce((a, it) => a + weight(it), 0);
  const durs = items.map((it) => (weight(it) / sum) * REPLAY_MS);
  const starts = durs.map((_, i) => durs.slice(0, i).reduce((a, b) => a + b, 0));
  return { base, starts, durs, total: REPLAY_MS };
}

function Message({ item, running }: { item: ChatItem; running: boolean }) {
  switch (item.kind) {
    case "user": return <div className="msg-user">{item.text}</div>;
    case "assistant": return <div className="msg-assistant">{item.text}</div>;
    case "pause": return <div className="msg-assistant muted">{item.text}</div>;
    case "decision": return <div className="msg-decision">{item.text}</div>;
    case "tool": return (
      <div className="tool">
        <span className="ico">{running ? <span className="spinner" /> : <Pencil />}</span>
        <span className="verb">{item.isNew ? "Write" : "Edit"}</span>
        <span className="path">{item.path}</span>
        <span className="stat"><span className="add">+{item.added}</span>{item.removed > 0 && <span className="del"> −{item.removed}</span>}</span>
      </div>
    );
  }
}

function Sidebar({ sessions, current, working }: { sessions: ViewState["sessions"]; current: number; working: boolean }) {
  return (
    <aside className="sidebar">
      {sessions.map((s) => (
        <div key={s.project} className="sb-group">
          <div className="sb-project"><Folder /> {s.project}</div>
          <div className={`sb-session ${s.trial === current ? "active" : ""}`}>
            <span className="sb-ico">
              {s.trial < current ? <Check className="done" /> : working ? <span className="spinner" /> : <span className="dot" />}
            </span>
            <span className="sb-title">{s.title}</span>
          </div>
        </div>
      ))}
    </aside>
  );
}

export function App() {
  const [view, setView] = useState<ViewState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [chat, setChat] = useState<ChatItem[]>([]);
  const [replay, setReplay] = useState<Replay | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [awaitingReady, setAwaitingReady] = useState(false);

  const chatRef = useRef<ChatItem[]>([]);
  const chatTrial = useRef(0);
  const lastKey = useRef("");
  const seen = useRef(new Map<string, number>());
  const scroller = useRef<HTMLDivElement>(null);

  const update = useCallback((v: ViewState) => { setError(null); setView(v); }, []);
  useEffect(() => { api.getState().then(setView).catch((e) => setError(String(e))); }, []);

  // New checkpoint: queue the scripted agent work and replay it; the review panels fill in live as it goes.
  useLayoutEffect(() => {
    if (!view?.checkpoint || view.phase === "stage2" || view.phase === "understanding") return;
    const key = `${view.trial}-${view.checkpoint.id}`;
    if (key === lastKey.current) return;
    lastKey.current = key;

    if (chatTrial.current !== view.trial) {
      chatTrial.current = view.trial;
      chatRef.current = [{ kind: "user", text: view.story!.brief }];
    }
    const base = chatRef.current.length;
    const items = itemsForCheckpoint(view);
    chatRef.current = [...chatRef.current, ...items];
    setChat(chatRef.current);
    setReplay(buildReplay(base, items));
    setElapsed(0);
    setAwaitingReady(true);
    seen.current = new Map();
  }, [view]);

  const animating = replay !== null && elapsed < replay.total;
  useEffect(() => {
    if (!animating) return;
    const t = setInterval(() => setElapsed((e) => e + 40), 40);
    return () => clearInterval(t);
  }, [animating]);

  useEffect(() => {
    if (replay && !animating && awaitingReady && view && (view.phase === "stage1" || view.phase === "unscored")) {
      setAwaitingReady(false);
      setReplay(null);
      api.act({ type: "ready" }).then(setView).catch((e) => setError(String(e)));
    }
  }, [replay, animating, awaitingReady, view]);

  // What has been written so far: per-file status and progress derived from the replay clock.
  const visibleCount = replay ? replay.base + replay.starts.filter((st) => st <= elapsed).length : chat.length;
  const runningIdx = replay ? replay.starts.findIndex((st, i) => st <= elapsed && elapsed < st + replay.durs[i]!) : -1;
  const fileProgress = useMemo(() => {
    const m = new Map<string, number>(); // path -> 0..1 (absent = not started)
    if (!replay) return m;
    chat.slice(replay.base).forEach((it, i) => {
      if (it.kind !== "tool" || elapsed < replay.starts[i]!) return;
      m.set(it.path, Math.min(1, (elapsed - replay.starts[i]!) / replay.durs[i]!));
    });
    return m;
  }, [replay, elapsed, chat]);

  const liveCp = useMemo(() => {
    const cp = view?.checkpoint;
    if (!cp) return undefined;
    if (!replay) return cp;
    const diffs: DiffFile[] = cp.diffs
      .filter((d) => fileProgress.has(d.path))
      .map((d) => {
        const f = fileProgress.get(d.path)!;
        if (f >= 1) return d;
        const lines = d.after.split("\n");
        return { ...d, after: lines.slice(0, Math.max(1, Math.ceil(f * lines.length))).join("\n") };
      });
    const pending = new Set(cp.diffs.filter((d) => !fileProgress.has(d.path)).map((d) => d.path));
    return { ...cp, diffs, workspace: cp.workspace.filter((f) => !pending.has(f.path)) };
  }, [view?.checkpoint, replay, fileProgress]);

  useEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }, [visibleCount, view?.phase]);

  const run = async (fn: () => Promise<ViewState>) => {
    setBusy(true);
    try { update(await fn()); } catch (e) { setError(String(e)); } finally { setBusy(false); }
  };
  const decide = (text: string) => { chatRef.current = [...chatRef.current, { kind: "decision", text }]; setChat(chatRef.current); };

  if (error) return <pre style={{ color: "var(--red)", padding: 20 }}>{error}</pre>;
  if (!view) return null;

  if (view.phase === "intro") {
    return (
      <div className="center-card">
        <Sparkle className="logo" />
        <h2>Welcome, {view.participantId}</h2>
        <p>An AI coding agent will implement a series of small features, each in a different project. Whenever it pauses, review its work and respond to the prompt at the bottom.</p><p>First a short questionnaire, then a practice story to get familiar with the interface.</p>
        <div className="btn-row"><button className="btn primary" onClick={() => run(() => api.act({ type: "begin" }))}>Start</button></div>
      </div>
    );
  }
  if (view.phase === "presurvey") return <PreSurvey busy={busy} onSubmit={(r) => run(() => api.act({ type: "presurvey", ...r }))} />;
  if (view.phase === "postsurvey") return <PostSurvey busy={busy} onSubmit={(r) => run(() => api.act({ type: "postsurvey", ...r }))} />;
  if (view.phase === "debrief") return <Debrief onDone={() => api.getState().then(setView)} />;
  if (view.phase === "finished") return <div className="center-card"><h2>Thank you</h2><p>You can close this window.</p></div>;

  const cp = view.checkpoint;
  const working = animating || awaitingReady;
  const coverage = () => (!cp || cp.diffs.length === 0 ? 1 : cp.diffs.reduce((s, d) => s + (seen.current.get(d.path) ?? 0), 0) / cp.diffs.length);
  const status = working ? "Agent is working" : view.phase === "understanding" ? "Answer the question above" : "Waiting for your review";

  return (
    <div className="app">
      <Sidebar sessions={view.sessions} current={view.trial} working={working} />

      <main className="center">
        <div className="topbar"><span className="title">{view.story?.title}</span><span className="crumb">{view.story?.project}</span><span className={`chip ${view.practice ? "practice" : ""}`}>{view.practice ? "Practice" : `Story ${view.trial - 1} of ${view.nTrials}`}</span></div>
        <div className="transcript" ref={scroller}>
          <div className="col">
            {chat.slice(0, visibleCount).map((it, i) => <Message key={i} item={it} running={!!replay && i === (replay.base + runningIdx) && runningIdx >= 0} />)}
            {working && <div className="working"><span className="spinner" />Working…</div>}
          </div>
        </div>
        <div className="bottom">
          <div className="col">
            {!working && (
              <Dock
                key={`${view.trial}-${cp?.id ?? "q"}-${view.phase}`}
                view={view}
                busy={busy}
                h={{
                  onStage1: (d) => { decide(d === "accept" ? "Accept / Continue" : "Reject / Flag defect"); run(() => api.act({ type: "stage1", decision: d, scrollCoverage: coverage() })); },
                  onAdvance: () => { decide("Continue"); run(() => api.act({ type: "advance" })); },
                  onStage2: (probe, final) => { if (final === "reverse") decide("I changed my decision"); run(() => api.act({ type: "stage2", probeAnswer: probe, final })); },
                  onUnderstanding: (a) => run(() => api.act({ type: "understanding", ...a })),
                }}
              />
            )}
            <div className="composer">
              <span className="plus"><Plus /></span>
              <span className="placeholder">{status}</span>
              <span className="send"><ArrowUp /></span>
            </div>
          </div>
        </div>
      </main>

      <section className="right">
        {cp && liveCp && view.phase !== "understanding" ? (
          <>
            <ChangesPane
              key={`c-${view.trial}-${cp.id}`}
              diffs={liveCp.diffs}
              live={animating}
              onSeen={(p, c) => seen.current.set(p, Math.max(seen.current.get(p) ?? 0, c))}
              onToggle={(path, open) => api.uiEvent({ type: "diff_toggle", path, tab: open ? "open" : "close" })}
            />
            <WorkPane key={`w-${view.trial}-${cp.id}`} cp={liveCp} onFileOpen={(path) => api.uiEvent({ type: "file_open", path })} onTab={(tab) => api.uiEvent({ type: "tab_switch", tab })} />
          </>
        ) : (
          <>
            <div className="pane grow"><div className="pane-head"><span className="pane-title">Changes</span></div><div className="empty"><span>Closed while you answer the question.</span></div></div>
            <div className="pane small"><div className="pane-head"><span className="pane-title">Files</span></div><div className="empty"><span>Closed while you answer the question.</span></div></div>
          </>
        )}
      </section>
    </div>
  );
}

function Debrief({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="survey">
      <div className="survey-card">
        <h2>Thank you — and a few things we couldn't tell you earlier</h2>
        <p className="muted">
          The "agent" you worked with was scripted: every participant sees the same code, written in advance, and no AI model was
          running. In some stories the agent's code contained a deliberate defect that the happy-path tests do not catch. The study
          compares when and how the agent pauses for your review, and how well people spot such defects.
        </p>
        <p className="muted">
          Your answers and interaction data are stored under your participant ID only. If you have questions or want your data
          removed, tell the experimenter now or contact them later.
        </p>
        <div className="btn-row">
          <button className="btn primary" disabled={busy} onClick={async () => { setBusy(true); await api.finish({}); onDone(); }}>Finish</button>
        </div>
      </div>
    </div>
  );
}
