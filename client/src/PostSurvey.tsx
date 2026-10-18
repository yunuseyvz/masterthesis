import { useState } from "react";
import type { Tlx } from "@beacon/shared";

type Regime = "BATCH" | "ARBITRARY" | "PAIR_PROG";

// Raw NASA-TLX (Hart & Staveland, 2006), 21-step scales scored 0-100. Performance keeps the original
// orientation (left = perfect, right = failure), so higher always means "worse" on that item.
const TLX: { key: keyof Tlx; label: string; question: string; ends: [string, string] }[] = [
  { key: "mental", label: "Mental demand", question: "How mentally demanding was the task?", ends: ["Very low", "Very high"] },
  { key: "physical", label: "Physical demand", question: "How physically demanding was the task?", ends: ["Very low", "Very high"] },
  { key: "temporal", label: "Temporal demand", question: "How hurried or rushed was the pace of the task?", ends: ["Very low", "Very high"] },
  { key: "performance", label: "Performance", question: "How successful were you in accomplishing what you were asked to do?", ends: ["Perfect", "Failure"] },
  { key: "effort", label: "Effort", question: "How hard did you have to work to accomplish your level of performance?", ends: ["Very low", "Very high"] },
  { key: "frustration", label: "Frustration", question: "How insecure, discouraged, irritated, stressed, and annoyed were you?", ends: ["Very low", "Very high"] },
];

const STYLES: Record<Regime, string> = {
  BATCH: "The agent works through everything and I review once, at the very end",
  ARBITRARY: "The agent pauses after routine steps (types, wiring)",
  PAIR_PROG: "The agent pauses at the key logic, before the rest is built around it",
};

const STEPS = Array.from({ length: 21 }, (_, i) => i * 5);

function Slider21({ label, question, ends, value, onChange }: { label: string; question: string; ends: [string, string]; value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="item">
      <div className="item-text"><b>{label}</b> <span className="muted">· {question}</span></div>
      <div className="slider">
        {STEPS.map((n) => (
          <button key={n} className={`tick ${value === n ? "sel" : ""} ${n % 25 === 0 ? "major" : ""}`} onClick={() => onChange(n)} aria-label={`${label} ${n}`} />
        ))}
      </div>
      <div className="lk-ends"><span>{ends[0]}</span><span>{value === null ? "" : value}</span><span>{ends[1]}</span></div>
    </div>
  );
}

export interface PostSurveyResult {
  tlx: Tlx;
  paas: number;
  ranking: Regime[];
  comment?: string;
}

export function PostSurvey({ busy, onSubmit }: { busy: boolean; onSubmit: (r: PostSurveyResult) => void }) {
  const [step, setStep] = useState(0);
  const [tlx, setTlx] = useState<Partial<Record<keyof Tlx, number>>>({});
  const [paas, setPaas] = useState(0);
  const [ranking, setRanking] = useState<Regime[]>([]);
  const [comment, setComment] = useState("");

  const page1 = TLX.every((t) => tlx[t.key] !== undefined);
  const page2 = paas > 0 && ranking.length === 3;
  const remaining = (Object.keys(STYLES) as Regime[]).filter((r) => !ranking.includes(r));

  return (
    <div className="survey">
      <div className="survey-card">
        <div className="survey-step">Final questions · {step + 1} of 2</div>

        {step === 0 && (
          <>
            <h2>How was the task overall?</h2>
            <p className="muted">Think about all the stories together. Click a position on each scale.</p>
            {TLX.map((t) => (
              <Slider21 key={t.key} label={t.label} question={t.question} ends={t.ends} value={tlx[t.key] ?? null} onChange={(n) => setTlx({ ...tlx, [t.key]: n })} />
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <h2>Effort and preferences</h2>
            <div className="item">
              <div className="item-text">Overall, how much mental effort did you invest while reviewing the agent's work?</div>
              <div className="likert" style={{ gridTemplateColumns: "repeat(9, 1fr)" }}>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => (
                  <button key={n} className={`lk ${paas === n ? "sel" : ""}`} onClick={() => setPaas(n)}><span className="lk-n">{n}</span></button>
                ))}
              </div>
              <div className="lk-ends"><span>Very, very low effort</span><span>Very, very high effort</span></div>
            </div>

            <div className="item">
              <div className="item-text">You experienced three ways of working with the agent. Click them in order of your preference, favourite first.</div>
              <div className="opts">
                {remaining.map((r) => (
                  <button key={r} className="opt" onClick={() => setRanking([...ranking, r])}>
                    <span className="n">{ranking.length + 1}</span><span className="lbl">{STYLES[r]}</span>
                  </button>
                ))}
              </div>
              {ranking.length > 0 && (
                <div className="ranking">
                  {ranking.map((r, i) => <div key={r}><span className="n">{i + 1}</span>{STYLES[r]}</div>)}
                  <button className="btn" onClick={() => setRanking([])}>Reset ranking</button>
                </div>
              )}
            </div>

            <div className="item">
              <div className="item-text">Anything you'd like to add? <span className="muted">(optional)</span></div>
              <textarea className="textarea" rows={4} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
          </>
        )}

        <div className="btn-row" style={{ marginTop: 22 }}>
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
          {step === 0 ? (
            <button className="btn primary" disabled={!page1} onClick={() => setStep(1)}>Next</button>
          ) : (
            <button
              className="btn primary"
              disabled={busy || !page2}
              onClick={() => onSubmit({ tlx: tlx as Tlx, paas, ranking, comment: comment.trim() || undefined })}
            >Submit</button>
          )}
        </div>
      </div>
    </div>
  );
}
