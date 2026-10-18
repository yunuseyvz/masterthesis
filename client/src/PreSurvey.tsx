import { useState } from "react";
import type { Demographics } from "@beacon/shared";

// NOTE: consent wording must match the approved ethics protocol before real use.
const CONSENT =
  "Participation is voluntary and you can stop at any time. We record your interactions with this study environment " +
  "(clicks, timings, terminal commands and your answers) together with your questionnaire answers. Data are stored under " +
  "your participant ID, without your name, and used only for this master's thesis research.";

// NCS-6 (Coelho et al., 2018). Items 3 and 4 are reverse-keyed (scored on the server).
const NCS_ITEMS = [
  "I would prefer complex to simple problems.",
  "I like to have the responsibility of handling a situation that requires a lot of thinking.",
  "Thinking is not my idea of fun.",
  "I would rather do something that requires little thought than something that is sure to challenge my thinking abilities.",
  "I really enjoy a task that involves coming up with new solutions to problems.",
  "I would prefer a task that is intellectual, difficult, and important to one that is somewhat important but does not require much thought.",
];
// Instructed-response attention check; the server expects answer 4.
const ATTENTION_ITEM = "To show that you are reading carefully, please select “Somewhat characteristic” for this statement.";
const ATTENTION_AFTER = 3; // shown after the 3rd NCS item
const NCS_LABELS = ["Extremely uncharacteristic", "Somewhat uncharacteristic", "Uncertain", "Somewhat characteristic", "Extremely characteristic"];

// S-TIAS (McGrath et al., 2025), with AI coding assistants as the referent.
const STIAS_ITEMS = ["I am confident in AI coding assistants.", "AI coding assistants are reliable.", "I can trust AI coding assistants."];

type Opt<T extends string> = { value: T; label: string };
const AGE: Opt<Demographics["ageGroup"]>[] = [
  { value: "18-24", label: "18–24" }, { value: "25-34", label: "25–34" }, { value: "35-44", label: "35–44" },
  { value: "45-54", label: "45–54" }, { value: "55+", label: "55+" }, { value: "no-answer", label: "Prefer not to say" },
];
const YEARS: Opt<Demographics["programmingYears"]>[] = [
  { value: "<1", label: "< 1 year" }, { value: "1-3", label: "1–3" }, { value: "3-5", label: "3–5" },
  { value: "5-10", label: "5–10" }, { value: "10+", label: "10+" },
];
const FREQ: Opt<Demographics["aiAssistantUse"]>[] = [
  { value: "never", label: "Never" }, { value: "rarely", label: "Rarely" }, { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" }, { value: "daily", label: "Daily" },
];

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: Opt<T>[]; value: T | null; onChange: (v: T) => void }) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="choices">
        {options.map((o) => <button key={o.value} className={`choice ${value === o.value ? "sel" : ""}`} onClick={() => onChange(o.value)}>{o.label}</button>)}
      </div>
    </div>
  );
}

function Likert({ text, max, value, onChange, labels }: { text: string; max: number; value: number; onChange: (n: number) => void; labels: [string, string] | string[] }) {
  return (
    <div className="item">
      <div className="item-text">{text}</div>
      <div className="likert" style={{ gridTemplateColumns: `repeat(${max}, 1fr)` }}>
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
          <button key={n} className={`lk ${value === n ? "sel" : ""}`} onClick={() => onChange(n)}>
            <span className="lk-n">{n}</span>
            {labels.length === max && <span className="lk-l">{labels[n - 1]}</span>}
          </button>
        ))}
      </div>
      {labels.length === 2 && <div className="lk-ends"><span>{labels[0]}</span><span>{labels[1]}</span></div>}
    </div>
  );
}

export interface PreSurveyResult {
  consent: true;
  demographics: Demographics;
  ncs: number[];
  attention: number;
  stias: number[];
}

export function PreSurvey({ busy, onSubmit }: { busy: boolean; onSubmit: (r: PreSurveyResult) => void }) {
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState(false);
  const [age, setAge] = useState<Demographics["ageGroup"] | null>(null);
  const [years, setYears] = useState<Demographics["programmingYears"] | null>(null);
  const [ai, setAi] = useState<Demographics["aiAssistantUse"] | null>(null);
  const [review, setReview] = useState<Demographics["codeReviewFrequency"] | null>(null);
  const [ts, setTs] = useState(0);
  const [ncs, setNcs] = useState<number[]>(Array(6).fill(0));
  const [attention, setAttention] = useState(0);
  const [stias, setStias] = useState<number[]>(Array(3).fill(0));

  const page1 = consent && age && years && ai && review && ts > 0;
  const page2 = ncs.every((v) => v > 0) && attention > 0;
  const page3 = stias.every((v) => v > 0);
  const set = (arr: number[], setter: (a: number[]) => void, i: number, v: number) => setter(arr.map((x, j) => (j === i ? v : x)));

  const statements: { text: string; attention?: boolean; idx?: number }[] = [];
  NCS_ITEMS.forEach((text, idx) => {
    statements.push({ text, idx });
    if (idx === ATTENTION_AFTER - 1) statements.push({ text: ATTENTION_ITEM, attention: true });
  });

  return (
    <div className="survey">
      <div className="survey-card">
        <div className="survey-step">Questionnaire · {step + 1} of 3</div>

        {step === 0 && (
          <>
            <h2>Before we start</h2>
            <p className="muted">{CONSENT}</p>
            <label className="consent">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>I have read this and agree to take part.</span>
            </label>
            <h3>About you</h3>
            <Choice label="Age group" options={AGE} value={age} onChange={setAge} />
            <Choice label="Years of programming experience" options={YEARS} value={years} onChange={setYears} />
            <Choice label="How often do you use AI coding assistants?" options={FREQ} value={ai} onChange={setAi} />
            <Choice label="How often do you review other people's code?" options={FREQ} value={review} onChange={setReview} />
            <Likert text="How familiar are you with TypeScript / JavaScript?" max={5} value={ts} onChange={setTs} labels={["Not at all", "Very familiar"]} />
          </>
        )}

        {step === 1 && (
          <>
            <h2>How do you approach thinking tasks?</h2>
            <p className="muted">How characteristic is each statement of you?</p>
            {statements.map((s, i) => (
              <Likert
                key={i}
                text={s.text}
                max={5}
                labels={NCS_LABELS}
                value={s.attention ? attention : ncs[s.idx!]!}
                onChange={(v) => (s.attention ? setAttention(v) : set(ncs, setNcs, s.idx!, v))}
              />
            ))}
          </>
        )}

        {step === 2 && (
          <>
            <h2>AI coding assistants</h2>
            <p className="muted">Thinking of AI coding assistants in general, how much do you agree?</p>
            {STIAS_ITEMS.map((text, i) => (
              <Likert key={i} text={text} max={7} labels={["Not at all", "Extremely"]} value={stias[i]!} onChange={(v) => set(stias, setStias, i, v)} />
            ))}
          </>
        )}

        <div className="btn-row" style={{ marginTop: 22 }}>
          {step > 0 && <button className="btn" onClick={() => setStep(step - 1)}>Back</button>}
          {step < 2 ? (
            <button className="btn primary" disabled={step === 0 ? !page1 : !page2} onClick={() => setStep(step + 1)}>Next</button>
          ) : (
            <button
              className="btn primary"
              disabled={busy || !page3}
              onClick={() => onSubmit({
                consent: true,
                demographics: { ageGroup: age!, programmingYears: years!, aiAssistantUse: ai!, codeReviewFrequency: review!, tsFamiliarity: ts },
                ncs,
                attention,
                stias,
              })}
            >Start practice</button>
          )}
        </div>
      </div>
    </div>
  );
}
