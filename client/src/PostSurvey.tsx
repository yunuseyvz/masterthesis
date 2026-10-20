import { useState } from "react";
import type { Style } from "@beacon/shared";

// The participant cannot tell a milestone pause from a non-milestone pause, so the ranking compares what they
// can see: a review at the end versus a pause partway through.
const STYLES: Record<Style, string> = {
  END: "The agent works through everything and I review once, at the very end",
  PAUSE: "The agent pauses partway through and I review that part before it continues",
};

export interface PostSurveyResult {
  ranking: Style[];
  comment?: string;
}

export function PostSurvey({ busy, onSubmit }: { busy: boolean; onSubmit: (r: PostSurveyResult) => void }) {
  const [ranking, setRanking] = useState<Style[]>([]);
  const [comment, setComment] = useState("");
  const remaining = (Object.keys(STYLES) as Style[]).filter((r) => !ranking.includes(r));

  return (
    <div className="survey">
      <div className="survey-card">
        <div className="survey-step">Final questions</div>
        <h2>Your preferences</h2>

        <div className="item">
          <div className="item-text">You experienced two ways of working with the agent. Click them in order of your preference, favourite first.</div>
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

        <div className="btn-row" style={{ marginTop: 22 }}>
          <button className="btn primary" disabled={busy || ranking.length !== 2} onClick={() => onSubmit({ ranking, comment: comment.trim() || undefined })}>Submit</button>
        </div>
      </div>
    </div>
  );
}
