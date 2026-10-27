import { For, Index, Match, Show, Switch, createSignal } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@opencode/ui/button"
import { act, busy, finish, view } from "./store"

// NOTE: consent wording must match the approved ethics protocol before real use.
const CONSENT =
  "Participation is voluntary and you can stop at any time. We record your interactions with this study environment " +
  "(timings, your decisions and answers, and the agent session) together with your questionnaire answers. Data are stored " +
  "under your participant ID, without your name, and used only for this master's thesis research."
const CONSENT_RECORDING =
  " The study window is also recorded (what is on screen and your mouse and keyboard input in it, not your camera or microphone)."

// NCS-6 (Coelho et al., 2018). Items 3 and 4 are reverse-keyed (scored on the server).
const NCS_ITEMS = [
  "I would prefer complex to simple problems.",
  "I like to have the responsibility of handling a situation that requires a lot of thinking.",
  "Thinking is not my idea of fun.",
  "I would rather do something that requires little thought than something that is sure to challenge my thinking abilities.",
  "I really enjoy a task that involves coming up with new solutions to problems.",
  "I would prefer a task that is intellectual, difficult, and important to one that is somewhat important but does not require much thought.",
]
// Instructed-response attention check; the server expects answer 4.
const ATTENTION_ITEM = "To show that you are reading carefully, please select “Somewhat characteristic” for this statement."
const ATTENTION_AFTER = 3 // shown after the 3rd NCS item
const NCS_LABELS = ["Extremely uncharacteristic", "Somewhat uncharacteristic", "Uncertain", "Somewhat characteristic", "Extremely characteristic"]
// S-TIAS (McGrath et al., 2025), with AI coding assistants as the referent.
const STIAS_ITEMS = ["I am confident in AI coding assistants.", "AI coding assistants are reliable.", "I can trust AI coding assistants."]

type Opt = { value: string; label: string }
const AGE: Opt[] = [
  { value: "18-24", label: "18–24" }, { value: "25-34", label: "25–34" }, { value: "35-44", label: "35–44" },
  { value: "45-54", label: "45–54" }, { value: "55+", label: "55+" }, { value: "no-answer", label: "Prefer not to say" },
]
const YEARS: Opt[] = [
  { value: "<1", label: "< 1 year" }, { value: "1-3", label: "1–3" }, { value: "3-5", label: "3–5" }, { value: "5-10", label: "5–10" }, { value: "10+", label: "10+" },
]
const FREQ: Opt[] = [
  { value: "never", label: "Never" }, { value: "rarely", label: "Rarely" }, { value: "monthly", label: "Monthly" }, { value: "weekly", label: "Weekly" }, { value: "daily", label: "Daily" },
]
/** 50 % = guessing between two options, 100 % = certain. */
const CONFIDENCE = [50, 60, 70, 80, 90, 100]
const STYLES = [
  { value: "END", label: "The agent works through everything and I review once, at the very end" },
  { value: "PAUSE", label: "The agent pauses partway through and I review that part before it continues" },
]

function Card(props: { step?: string; title: string; children: any }) {
  return (
    <div data-study-page>
      <div data-study-card>
        <Show when={props.step}>
          <div data-study-step>{props.step}</div>
        </Show>
        <h1>{props.title}</h1>
        {props.children}
      </div>
    </div>
  )
}

function Choice(props: { label: string; options: Opt[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div data-study-field>
      <div data-study-label>{props.label}</div>
      <div data-study-choices>
        <For each={props.options}>
          {(o) => (
            <button type="button" data-study-chip data-picked={props.value === o.value} onClick={() => props.onChange(o.value)}>
              {o.label}
            </button>
          )}
        </For>
      </div>
    </div>
  )
}

/** Equal-width segments with anchors under both ends (Likert, confidence, effort). */
function Scale(props: { label: string; values: number[]; format?: (n: number) => string; ends: [string, string]; value?: number; onChange: (n: number) => void; captions?: string[] }) {
  return (
    <div data-study-field>
      <div data-study-label>{props.label}</div>
      <div data-study-scale role="radiogroup" aria-label={props.label}>
        <For each={props.values}>
          {(n, i) => (
            <button type="button" role="radio" aria-checked={props.value === n} data-picked={props.value === n} onClick={() => props.onChange(n)}>
              <span>{props.format ? props.format(n) : n}</span>
              <Show when={props.captions}>
                <small>{props.captions![i()]}</small>
              </Show>
            </button>
          )}
        </For>
      </div>
      <Show when={!props.captions}>
        <div data-study-ends>
          <span>{props.ends[0]}</span>
          <span>{props.ends[1]}</span>
        </div>
      </Show>
    </div>
  )
}

function Options(props: { options: string[]; value?: number; onChange: (i: number) => void }) {
  return (
    <div data-study-options>
      <For each={props.options}>
        {(o, i) => (
          <button type="button" data-study-option data-picked={props.value === i()} onClick={() => props.onChange(i())}>
            <span data-study-radio />
            <span>{o}</span>
          </button>
        )}
      </For>
    </div>
  )
}

function Intro() {
  return (
    <Card title={`Welcome to Shopfront, ${view()!.participantId}`}>
      <p>
        You have just joined <b>Shopfront</b>, a small online shop, as a developer. The team works with an AI coding
        agent: the product owner writes a user story, the agent plans and implements it, and a developer reviews the
        agent's work before it ships. This week, that developer is you.
      </p>
      <div data-study-field>
        <div data-study-label>Your job for each feature</div>
        <ol data-study-list>
          <li>Read the user story and the agent's plan, and approve the plan.</li>
          <li>When the agent stops, review its code. Read the changes, open any file, run the code and the tests.</li>
          <li>
            Decide. <b>Accept</b> ships the code with today's release. <b>Reject</b> sends it back and holds the
            feature for a day.
          </li>
        </ol>
      </div>
      <p>
        Afterwards you are on call for these features: a colleague on the support desk asks you a few questions about
        how the new code behaves, without showing it to you. Answer from what you understood during the review.
      </p>
      <p>
        Treat it as real: the shop has customers and money at stake. Accepting broken code costs the shop; rejecting
        good code delays a feature. Take the time you would take at work.
      </p>
      <p>First a short questionnaire, then a practice feature to get to know the interface.</p>
      <div data-study-actions>
        <Button variant="submit" size="large" disabled={busy()} onClick={() => act({ type: "begin" })}>
          Start
        </Button>
      </div>
    </Card>
  )
}

function PreSurvey() {
  const [step, setStep] = createSignal(0)
  const [s, set] = createStore({
    consent: false,
    age: "", years: "", ai: "", review: "", ts: 0,
    ncs: [0, 0, 0, 0, 0, 0],
    attention: 0,
    stias: [0, 0, 0],
  })
  const page1 = () => s.consent && s.age && s.years && s.ai && s.review && s.ts > 0
  const page2 = () => s.ncs.every((v) => v > 0) && s.attention > 0
  const page3 = () => s.stias.every((v) => v > 0)
  const statements: { text: string; attention?: boolean; idx?: number }[] = []
  NCS_ITEMS.forEach((text, idx) => {
    statements.push({ text, idx })
    if (idx === ATTENTION_AFTER - 1) statements.push({ text: ATTENTION_ITEM, attention: true })
  })

  return (
    <Show when={!busy()} fallback={<Preparing />}>
      <Card step={`Questionnaire · ${step() + 1} of 3`} title={["Before we start", "How do you approach thinking tasks?", "AI coding assistants"][step()]!}>
        <Switch>
          <Match when={step() === 0}>
            <p>{CONSENT + (view()?.recording ? CONSENT_RECORDING : "")}</p>
            <label data-study-consent>
              <input type="checkbox" checked={s.consent} onChange={(e) => set("consent", e.currentTarget.checked)} />
              <span>I have read this and agree to take part.</span>
            </label>
            <h2>About you</h2>
            <Choice label="Age group" options={AGE} value={s.age} onChange={(v) => set("age", v)} />
            <Choice label="Years of programming experience" options={YEARS} value={s.years} onChange={(v) => set("years", v)} />
            <Choice label="How often do you use AI coding assistants?" options={FREQ} value={s.ai} onChange={(v) => set("ai", v)} />
            <Choice label="How often do you review other people's code?" options={FREQ} value={s.review} onChange={(v) => set("review", v)} />
            <Scale label="How familiar are you with TypeScript / JavaScript?" values={[1, 2, 3, 4, 5]} ends={["Not at all", "Very familiar"]} value={s.ts} onChange={(v) => set("ts", v)} />
          </Match>
          <Match when={step() === 1}>
            <p>How characteristic is each statement of you?</p>
            <Index each={statements}>
              {(st) => (
                <Scale
                  label={st().text}
                  values={[1, 2, 3, 4, 5]}
                  ends={["", ""]}
                  captions={NCS_LABELS}
                  value={st().attention ? s.attention : s.ncs[st().idx!]}
                  onChange={(v) => (st().attention ? set("attention", v) : set("ncs", st().idx!, v))}
                />
              )}
            </Index>
          </Match>
          <Match when={step() === 2}>
            <p>Thinking of AI coding assistants in general, how much do you agree?</p>
            <Index each={STIAS_ITEMS}>
              {(text, i) => <Scale label={text()} values={[1, 2, 3, 4, 5, 6, 7]} ends={["Not at all", "Extremely"]} value={s.stias[i]} onChange={(v) => set("stias", i, v)} />}
            </Index>
          </Match>
        </Switch>
        <div data-study-actions>
          <Show when={step() > 0}>
            <Button variant="neutral" size="large" onClick={() => setStep(step() - 1)}>Back</Button>
          </Show>
          <Show
            when={step() === 2}
            fallback={<Button variant="submit" size="large" disabled={step() === 0 ? !page1() : !page2()} onClick={() => setStep(step() + 1)}>Next</Button>}
          >
            <Button
              variant="submit"
              size="large"
              disabled={busy() || !page3()}
              onClick={() =>
                act({
                  type: "presurvey",
                  consent: true,
                  demographics: { ageGroup: s.age, programmingYears: s.years, aiAssistantUse: s.ai, codeReviewFrequency: s.review, tsFamiliarity: s.ts },
                  ncs: [...s.ncs],
                  attention: s.attention,
                  stias: [...s.stias],
                })
              }
            >
              Start practice
            </Button>
          </Show>
        </div>
      </Card>
    </Show>
  )
}

function Preparing() {
  return (
    <Card title="Preparing the next feature">
      <p>
        <span data-study-spinner /> The agent is setting up. This takes a few seconds.
      </p>
    </Card>
  )
}

/** The understanding questions: the code is hidden, one question per screen, then mental effort. */
function Quiz() {
  const items = () => view()!.understanding!.items
  const [step, setStep] = createSignal(0)
  const [answers, setAnswers] = createStore<(number | undefined)[]>([])
  const [confs, setConfs] = createStore<(number | undefined)[]>([])
  const [paas, setPaas] = createSignal<number | undefined>()
  const onEffort = () => step() >= items().length
  // Time on each question's screen and answer changes, for the server's per-item measures.
  const itemMs = [0, 0, 0, 0]
  const changes = [0, 0, 0, 0]
  let since = Date.now()
  const go = (next: number) => {
    if (step() < items().length) itemMs[step()]! += Date.now() - since
    since = Date.now()
    setStep(next)
  }
  const pick = (i: number) => {
    const prev = answers[k()]
    if (prev !== undefined && prev !== i) changes[k()]!++
    setAnswers(k(), i)
  }
  const k = () => Math.min(step(), items().length - 1)
  const v = () => view()!

  return (
    <Show when={!busy()} fallback={<Preparing />}>
      <Card step={`${v().practice ? "Practice feature" : `Feature ${v().trial - 1} of ${v().nTrials}`} · the code is hidden now`} title={onEffort() ? "Almost done" : `Question ${step() + 1} of ${items().length}`}>
        <Show
          when={!onEffort()}
          fallback={<Scale label="How much mental effort did you invest in reviewing this feature?" values={[1, 2, 3, 4, 5, 6, 7, 8, 9]} ends={["Very, very low", "Very, very high"]} value={paas()} onChange={setPaas} />}
        >
          <p data-study-lead>A colleague on the support desk asks you about the feature you just reviewed.</p>
          <p data-study-question>{items()[k()]!.question}</p>
          <Options options={items()[k()]!.options} value={answers[k()]} onChange={pick} />
          <Scale label="How sure are you about your answer?" values={CONFIDENCE} format={(c) => `${c}%`} ends={["Guessing", "Certain"]} value={confs[k()]} onChange={(c) => setConfs(k(), c)} />
        </Show>
        <div data-study-actions>
          <Show when={step() > 0}>
            <Button variant="neutral" size="large" onClick={() => go(step() - 1)}>Back</Button>
          </Show>
          <Show
            when={onEffort()}
            fallback={<Button variant="submit" size="large" disabled={answers[k()] === undefined || confs[k()] === undefined} onClick={() => go(step() + 1)}>Continue</Button>}
          >
            <Button
              variant="submit"
              size="large"
              disabled={paas() === undefined || items().some((_, i) => answers[i] === undefined || confs[i] === undefined)}
              onClick={() =>
                act({ type: "understanding", answers: items().map((_, i) => answers[i]), confidences: items().map((_, i) => confs[i]), paas: paas(), itemMs: itemMs.map(Math.round), answerChanges: changes })
              }
            >
              Next
            </Button>
          </Show>
        </div>
      </Card>
    </Show>
  )
}

function PostSurvey() {
  const [ranking, setRanking] = createSignal<string[]>([])
  const [comment, setComment] = createSignal("")
  const remaining = () => STYLES.filter((s) => !ranking().includes(s.value))
  const label = (v: string) => STYLES.find((s) => s.value === v)!.label
  return (
    <Card step="Final questions" title="Your preferences">
      <div data-study-field>
        <div data-study-label>You experienced two ways of working with the agent. Click them in order of your preference, favourite first.</div>
        <div data-study-options>
          <For each={remaining()}>
            {(s) => (
              <button type="button" data-study-option onClick={() => setRanking([...ranking(), s.value])}>
                <span data-study-rank>{ranking().length + 1}</span>
                <span>{s.label}</span>
              </button>
            )}
          </For>
        </div>
        <Show when={ranking().length > 0}>
          <div data-study-ranking>
            <For each={ranking()}>{(r, i) => <div><span data-study-rank>{i() + 1}</span>{label(r)}</div>}</For>
            <Button variant="ghost" size="normal" onClick={() => setRanking([])}>Reset ranking</Button>
          </div>
        </Show>
      </div>
      <div data-study-field>
        <div data-study-label>Anything you'd like to add? (optional)</div>
        <textarea data-study-textarea rows={4} maxLength={2000} value={comment()} onInput={(e) => setComment(e.currentTarget.value)} />
      </div>
      <div data-study-actions>
        <Button variant="submit" size="large" disabled={busy() || ranking().length !== 2} onClick={() => act({ type: "postsurvey", ranking: ranking(), comment: comment().trim() || undefined })}>
          Submit
        </Button>
      </div>
    </Card>
  )
}

function Debrief(props: { onDone: () => void }) {
  return (
    <Card title="Thank you, and a few things we couldn't tell you earlier">
      <p>
        The agent you worked with replayed a recorded run: every participant sees the same code, written in advance, and no AI
        model was answering live. In some features the agent's code contained a deliberate defect that the happy-path tests do
        not catch. The study compares when the agent pauses for your review, and how well people understand the code and spot
        such defects.
      </p>
      <p>
        Your answers and interaction data are stored under your participant ID only. If you have questions or want your data
        removed, tell the experimenter now or contact them later.
      </p>
      <div data-study-actions>
        <Button variant="submit" size="large" disabled={busy()} onClick={() => finish().then(props.onDone)}>
          Finish
        </Button>
      </div>
    </Card>
  )
}

/** Full-screen study pages shown instead of opencode: before, between and after the agent sessions. */
export function StudyPage() {
  const [done, setDone] = createSignal(false)
  return (
    <Switch>
      <Match when={done() || view()!.phase === "finished"}>
        <Card title="Thank you">
          <Show when={view()!.demo} fallback={<p>You can close this window.</p>}>
            <p>This is a demo. A fresh session with a new participant ID is ready.</p>
            <div data-study-actions>
              <Button variant="submit" size="large" onClick={() => window.location.assign("/")}>Start again</Button>
            </div>
          </Show>
        </Card>
      </Match>
      <Match when={view()!.phase === "intro"}><Intro /></Match>
      <Match when={view()!.phase === "presurvey"}><PreSurvey /></Match>
      <Match when={view()!.phase === "understanding"}><Quiz /></Match>
      <Match when={view()!.phase === "postsurvey"}><PostSurvey /></Match>
      <Match when={view()!.phase === "debrief"}><Debrief onDone={() => setDone(true)} /></Match>
    </Switch>
  )
}
