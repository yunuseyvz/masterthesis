import { useEffect, useMemo, useRef, useState } from "react";
import type { CheckpointView, DiffFile } from "@beacon/shared";
import { diffStat } from "./diff";
import { DiffView, FileViewer } from "./DiffView";
import { Chevron, DiffIcon, FilesIcon, Folder, GlobeIcon, ReloadIcon, TerminalIcon, fileIcon } from "./icons";
import { TerminalView } from "./TerminalView";

const split = (p: string) => { const i = p.lastIndexOf("/"); return i < 0 ? ["", p] as const : [p.slice(0, i + 1), p.slice(i + 1)] as const; };

/** Stacked, collapsible per-file diffs in one scrolling pane. Coverage = share of each diff that has been scrolled into view. */
export function ChangesPane({ diffs, live, onSeen, onToggle }: { diffs: DiffFile[]; live: boolean; onSeen: (path: string, coverage: number) => void; onToggle: (path: string, open: boolean) => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const wraps = useRef(new Map<string, HTMLElement>());
  const range = useRef(new Map<string, [number, number]>());
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const measure = () => {
    const sc = scroller.current;
    if (!sc || live) return; // only count what the participant scrolls through once the agent is done
    const c = sc.getBoundingClientRect();
    for (const d of diffs) {
      const el = wraps.current.get(d.path);
      if (!el || closed.has(d.path)) continue;
      const r = el.getBoundingClientRect();
      const top = Math.max(r.top, c.top);
      const bottom = Math.min(r.bottom, c.bottom);
      if (bottom <= top || r.height === 0) continue;
      const prev = range.current.get(d.path);
      const next: [number, number] = [Math.min(prev?.[0] ?? Infinity, top - r.top), Math.max(prev?.[1] ?? -Infinity, bottom - r.top)];
      range.current.set(d.path, next);
      onSeen(d.path, Math.min(1, (next[1] - next[0]) / r.height));
    }
  };
  useEffect(() => { const t = setTimeout(measure, 150); return () => clearTimeout(t); });

  // While the agent writes, follow the newest file; when it stops, start the review from the top.
  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    if (live) sc.scrollTop = sc.scrollHeight;
  });
  useEffect(() => {
    if (live) return;
    range.current.clear();
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [live]);

  const total = useMemo(() => diffs.reduce((a, d) => { const s = diffStat(d.before, d.after); return { a: a.a + s.added, r: a.r + s.removed }; }, { a: 0, r: 0 }), [diffs]);

  return (
    <div className="pane grow">
      <div className="pane-head">
        <span className="pane-title"><DiffIcon /> Changes</span>
        <span className="pane-meta">{diffs.length} file{diffs.length === 1 ? "" : "s"} <span className="add">+{total.a}</span>{total.r > 0 && <span className="del"> −{total.r}</span>}</span>
      </div>
      <div className="pane-body scroll" ref={scroller} onScroll={measure}>
        {diffs.length === 0 && <div className="empty"><span>Changes will appear here as the agent writes.</span></div>}
        {diffs.map((d) => {
          const st = diffStat(d.before, d.after);
          const [dir, name] = split(d.path);
          const isClosed = closed.has(d.path);
          return (
            <section key={d.path} className="diff-file" ref={(el) => { if (el) wraps.current.set(d.path, el); }}>
              <button className="diff-head" onClick={() => { const n = new Set(closed); isClosed ? n.delete(d.path) : n.add(d.path); setClosed(n); onToggle(d.path, isClosed); }}>
                <Chevron open={!isClosed} />
                {fileIcon(name)}
                <span className="diff-path"><span className="dir">{dir}</span>{name}</span>
                <span className="diff-stat"><span className="add">+{st.added}</span>{st.removed > 0 && <span className="del"> −{st.removed}</span>}</span>
              </button>
              {!isClosed && <DiffView before={d.before} after={d.after} />}
            </section>
          );
        })}
      </div>
    </div>
  );
}

interface Node { name: string; path: string; children: Map<string, Node>; file: boolean }

function buildTree(paths: string[]): Node {
  const root: Node = { name: "", path: "", children: new Map(), file: false };
  for (const p of paths) {
    let cur = root;
    p.split("/").forEach((part, i, arr) => {
      const path = arr.slice(0, i + 1).join("/");
      if (!cur.children.has(part)) cur.children.set(part, { name: part, path, children: new Map(), file: i === arr.length - 1 });
      cur = cur.children.get(part)!;
    });
  }
  return root;
}

function TreeLevel({ node, depth, selected, changed, onSelect }: { node: Node; depth: number; selected: string; changed: Set<string>; onSelect: (p: string) => void }) {
  const [shut, setShut] = useState<Set<string>>(new Set());
  const kids = [...node.children.values()].sort((a, b) => Number(a.file) - Number(b.file) || a.name.localeCompare(b.name));
  return (
    <>
      {kids.map((k) => {
        const isShut = shut.has(k.path);
        return (
          <div key={k.path}>
            <button
              className={`tree-row ${k.path === selected ? "active" : ""}`}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => { if (k.file) onSelect(k.path); else { const n = new Set(shut); isShut ? n.delete(k.path) : n.add(k.path); setShut(n); } }}
            >
              {k.file ? <span style={{ width: 16, flex: "none" }} /> : <Chevron open={!isShut} />}
              {k.file ? fileIcon(k.name) : <Folder />}
              <span className="tree-name">{k.name}</span>
              {k.file && changed.has(k.path) && <span className="tree-badge">M</span>}
            </button>
            {!k.file && !isShut && <TreeLevel node={k} depth={depth + 1} selected={selected} changed={changed} onSelect={onSelect} />}
          </div>
        );
      })}
    </>
  );
}

export type WorkTab = "files" | "terminal" | "preview";

/** A small browser: address bar plus the participant's dev server in an iframe. */
function PreviewPane({ url, visible, onNavigate }: { url: string; visible: boolean; onNavigate: (url: string) => void }) {
  const [addr, setAddr] = useState(url);
  const [src, setSrc] = useState(url);
  const [nonce, setNonce] = useState(0);
  const go = (to: string) => {
    const next = /^https?:\/\//.test(to) ? to : `http://${to}`;
    setAddr(next);
    setSrc(next);
    setNonce((n) => n + 1);
    onNavigate(next);
  };
  return (
    <div className="preview" style={{ display: visible ? "flex" : "none" }}>
      <form className="preview-bar" onSubmit={(e) => { e.preventDefault(); go(addr); }}>
        <button type="button" className="icon-btn" title="Reload" onClick={() => go(src)}><ReloadIcon /></button>
        <input className="preview-addr" value={addr} onChange={(e) => setAddr(e.target.value)} spellCheck={false} aria-label="Address" />
      </form>
      <div className="preview-hint">Start the app in the Terminal with <code>npm run dev</code>, then reload.</div>
      <iframe key={nonce} className="preview-frame" src={src} title="Preview" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
    </div>
  );
}

/** Shown instead of the browser when the session has no reachable dev server (offline or no PREVIEW_URL). */
function PreviewUnavailable({ visible }: { visible: boolean }) {
  return (
    <div className="preview" style={{ display: visible ? "flex" : "none" }}>
      <div className="empty">
        Preview isn't available in this session.
        <br />
        <span>Use the Terminal to run the tests, e.g. <code>npm test</code>.</span>
      </div>
    </div>
  );
}

export function WorkPane({ cp, tab, onTab, previewUrl, onNavigate, hidden, onFileOpen }: { cp: CheckpointView; tab: WorkTab; onTab: (t: WorkTab) => void; previewUrl?: string; onNavigate: (url: string) => void; hidden: boolean; onFileOpen: (p: string) => void }) {
  // `cp.diffs` here is the live subset, so the tree grows as files get written.
  const [file, setFile] = useState("");
  const tree = useMemo(() => buildTree(cp.workspace.map((f) => f.path)), [cp.workspace]);
  const changed = useMemo(() => new Set(cp.diffs.map((d) => d.path)), [cp.diffs]);
  const content = cp.workspace.find((f) => f.path === file)?.content;

  return (
    <div className="pane small" style={{ display: hidden ? "none" : undefined }}>
      <div className="pane-head">
        <button className={`tab ${tab === "files" ? "active" : ""}`} onClick={() => onTab("files")}><FilesIcon /> Files</button>
        <button className={`tab ${tab === "terminal" ? "active" : ""}`} onClick={() => onTab("terminal")}><TerminalIcon /> Terminal</button>
        <button className={`tab ${tab === "preview" ? "active" : ""}`} onClick={() => onTab("preview")}><GlobeIcon /> Preview</button>
      </div>
      <div className="pane-body split" style={{ display: tab === "files" ? "flex" : "none" }}>
        <div className="tree scroll"><TreeLevel node={tree} depth={0} selected={file} changed={changed} onSelect={(p) => { setFile(p); onFileOpen(p); }} /></div>
        <div className="viewer">
          {content !== undefined ? (
            <>
              <div className="viewer-head">{file}</div>
              <div style={{ flex: 1, minHeight: 0 }}><FileViewer key={file} path={file} content={content} /></div>
            </>
          ) : <div className="empty">Opened files appear here.<br /><span>Select a file in the tree.</span></div>}
        </div>
      </div>
      <div className="pane-body term-body" style={{ display: tab === "terminal" ? "block" : "none" }}>
        <TerminalView visible={tab === "terminal" && !hidden} />
      </div>
      {previewUrl ? <PreviewPane url={previewUrl} visible={tab === "preview"} onNavigate={onNavigate} /> : <PreviewUnavailable visible={tab === "preview"} />}
    </div>
  );
}
