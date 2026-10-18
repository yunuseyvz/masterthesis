import { useEffect, useState } from "react";
import type { ViewState } from "@beacon/shared";

function Options({ options, value, onChange, dontKnow }: { options: string[]; value: number | null; onChange: (i: number) => void; dontKnow?: boolean }) {
  const all = dontKnow ? [...options, "I don't know"] : options;
  return (
    <div className="opts">
      {all.map((o, i) => {
        const v = dontKnow && i === options.length ? -1 : i;
        return (
          <button key={i} className={`opt ${value === v ? "sel" : ""}`} onClick={() => onChange(v)}>
            <span className="n">{i + 1}</span>
            <span className="lbl">{o}</span>
          </button>
        );
      })}
    </div>
  );
}

function Scale({ label, max, value, onChange }: { label: string; max: number; value: number; onChange: (n: number) => void }) {
  return (
    <div className="scale">
      <span className="lbl">{label}</span>
      <span className="pills">
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button key={n} className={value === n ? "sel" : ""} onClick={() => onChange(n)}>{n}</button>
        ))}
      </span>
    </div>
  );
}

export interface DockHandlers {
  onStage1: (d: "accept" | "reject") => void;
  onAdvance: () => void;
  onStage2: (probe: number, final: "confirm" | "reverse") => void;
  onUnderstanding: (a: { answer: number; confidence: number; mentalDemand: number; frustration: number }) => void;
}

/** Number keys act like the real tool's prompts, but never while typing in the terminal. */
function useNumberKeys(enabled: boolean, onKey: (n: number) => void) {
  useEffect(() => {
    if (!enabled) return;
    const h = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el?.closest(".xterm") || el?.tagName === "INPUT" || el?.tagName === "TEXTAREA") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9) onKey(n);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });
}

export function Dock({ view, busy, h }: { view: ViewState; busy: boolean; h: DockHandlers }) {
  const [probe, setProbe] = useState<number | null>(null);
  const [answer, setAnswer] = useState<number | null>(null);
  const [conf, setConf] = useState(0);
  const [demand, setDemand] = useState(0);
  const [frus, setFrus] = useState(0);

  useNumberKeys(!busy && view.phase === "stage1", (n) => { if (n === 1) h.onStage1("accept"); else if (n === 2) h.onStage1("reject"); });
  useNumberKeys(view.phase === "stage2" && !!view.probe, (n) => {
    const count = view.probe!.options.length;
    if (n <= count) setProbe(n - 1); else if (n === count + 1) setProbe(-1);
  });
  useNumberKeys(view.phase === "understanding", (n) => { if (n <= (view.understanding?.options.length ?? 0)) setAnswer(n - 1); });

  if (view.phase === "unscored") {
    return (
      <div className="dock">
        <h4>The agent paused</h4>
        <p>Look over the changes, then let it continue.</p>
        <div className="btn-row"><button className="btn primary" disabled={busy} onClick={h.onAdvance}>Continue</button></div>
      </div>
    );
  }

  if (view.phase === "stage1") {
    return (
      <div className="dock">
        <h4>Review the agent's changes</h4>
        <p>Inspect the diff, browse the files, or use the terminal. Then decide.</p>
        <div className="opts">
          <button className="opt" disabled={busy} onClick={() => h.onStage1("accept")}><span className="n">1</span><span className="lbl">Accept / Continue</span></button>
          <button className="opt" disabled={busy} onClick={() => h.onStage1("reject")}><span className="n">2</span><span className="lbl">Reject / Flag defect</span></button>
        </div>
      </div>
    );
  }

  if (view.phase === "stage2" && view.probe) {
    return (
      <div className="dock">
        <h4>Before finalizing</h4>
        <p className="q">{view.probe.question}</p>
        <Options options={view.probe.options} value={probe} onChange={setProbe} dontKnow />
        <div className="btn-row">
          <button className="btn primary" disabled={busy || probe === null} onClick={() => h.onStage2(probe!, "confirm")}>Confirm initial decision</button>
          <button className="btn" disabled={busy || probe === null} onClick={() => h.onStage2(probe!, "reverse")}>Reverse decision</button>
        </div>
      </div>
    );
  }

  if (view.phase === "understanding" && view.understanding) {
    const ready = answer !== null && conf > 0 && demand > 0 && frus > 0;
    return (
      <div className="dock">
        <h4>A quick question about the feature</h4>
        <p className="q">{view.understanding.question}</p>
        <Options options={view.understanding.options} value={answer} onChange={setAnswer} />
        <div className="scales">
          <Scale label="Confidence (1–7)" max={7} value={conf} onChange={setConf} />
          <Scale label="Mental demand (1–5)" max={5} value={demand} onChange={setDemand} />
          <Scale label="Frustration (1–5)" max={5} value={frus} onChange={setFrus} />
        </div>
        <div className="btn-row">
          <button className="btn primary" disabled={busy || !ready} onClick={() => h.onUnderstanding({ answer: answer!, confidence: conf, mentalDemand: demand, frustration: frus })}>Next</button>
        </div>
      </div>
    );
  }
  return null;
}
