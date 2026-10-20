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

/** 50 % = guessing between two options, 100 % = certain. */
const CONFIDENCE = [50, 60, 70, 80, 90, 100];

/** Equal-width buttons across the dock, with a question above and anchors under both ends. */
function Segmented({ label, values, format, ends, value, onChange }: { label: string; values: number[]; format?: (n: number) => string; ends: [string, string]; value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="seg">
      <div className="seg-label">{label}</div>
      <div className="seg-row" role="radiogroup" aria-label={label}>
        {values.map((n) => (
          <button key={n} role="radio" aria-checked={value === n} className={value === n ? "sel" : ""} onClick={() => onChange(n)}>{format ? format(n) : n}</button>
        ))}
      </div>
      <div className="seg-ends"><span>{ends[0]}</span><span>{ends[1]}</span></div>
    </div>
  );
}

export interface DockHandlers {
  onStage1: (d: "accept" | "reject") => void;
  onAdvance: () => void;
  onStage2: (probe: number, final: "confirm" | "reverse") => void;
  onUnderstanding: (a: { answers: number[]; confidences: number[]; paas: number }) => void;
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
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [confs, setConfs] = useState<(number | null)[]>([]);
  const [step, setStep] = useState(0); // understanding: one question per screen, then the effort rating
  const [paas, setPaas] = useState(0);

  useNumberKeys(!busy && view.phase === "stage1", (n) => { if (n === 1) h.onStage1("accept"); else if (n === 2) h.onStage1("reject"); });
  useNumberKeys(view.phase === "stage2" && !!view.probe, (n) => {
    const count = view.probe!.options.length;
    if (n <= count) setProbe(n - 1); else if (n === count + 1) setProbe(-1);
  });

  if (view.phase === "unscored") {
    return (
      <div className="dock">
        {view.checkpoint?.id === "wrap-up" ? (
          <>
            <h4>The agent has finished the feature</h4>
            <p>Look over the rest of what it wrote. There is nothing to decide here. Then continue.</p>
          </>
        ) : (
          <>
            <h4>The agent paused</h4>
            <p>Look over the changes, then let it continue.</p>
          </>
        )}
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
    const items = view.understanding.items;
    const picked = items.map((_, k) => answers[k] ?? null);
    const sure = items.map((_, k) => confs[k] ?? null);
    const onEffort = step >= items.length;
    const k = Math.min(step, items.length - 1);
    const set = (prev: (number | null)[], v: number) => { const next = items.map((_, j) => prev[j] ?? null); next[k] = v; return next; };
    return (
      <div className="dock">
        <h4>{onEffort ? "Almost done" : `Question ${step + 1} of ${items.length}`}</h4>
        {!onEffort ? (
          <>
            <p className="q">{items[k]!.question}</p>
            <Options options={items[k]!.options} value={picked[k]!} onChange={(i) => setAnswers((prev) => set(prev, i))} />
            <Segmented label="How sure are you about your answer?" values={CONFIDENCE} format={(c) => `${c}%`} ends={["Guessing", "Certain"]} value={sure[k]!} onChange={(c) => setConfs((prev) => set(prev, c))} />
          </>
        ) : (
          <>
            <Segmented label="How much mental effort did you invest in reviewing this feature?" values={[1, 2, 3, 4, 5, 6, 7, 8, 9]} ends={["Very, very low", "Very, very high"]} value={paas || null} onChange={setPaas} />
          </>
        )}
        <div className="btn-row">
          {step > 0 && <button className="btn" disabled={busy} onClick={() => setStep(step - 1)}>Back</button>}
          {!onEffort ? (
            <button className="btn primary" disabled={picked[k] === null || sure[k] === null} onClick={() => setStep(step + 1)}>Continue</button>
          ) : (
            <button className="btn primary" disabled={busy || paas === 0 || picked.some((a) => a === null) || sure.some((c) => c === null)} onClick={() => h.onUnderstanding({ answers: picked as number[], confidences: sure as number[], paas })}>Next</button>
          )}
        </div>
      </div>
    );
  }
  return null;
}
