import { For, Match, Show, Switch, createSignal } from "solid-js"
import { Button } from "@opencode/ui/button"
import { DockPrompt } from "@opencode/session-ui/dock-prompt"
import { act, busy, view } from "./store"

/** Opens opencode's terminal through its own shortcut (Ctrl+`), which participants would not know. */
function openTerminal() {
  const target = document.activeElement ?? document.body
  target.dispatchEvent(new KeyboardEvent("keydown", { key: "`", code: "Backquote", ctrlKey: true, bubbles: true, cancelable: true }))
}

/** Opens opencode's file explorer (the "Open file" tab of the side panel, which lists the whole project). */
function openFiles() {
  const click = (label: string) => document.querySelector<HTMLElement>(`button[aria-label="${label}"]`)?.click()
  if (!document.querySelector('[data-component="session-review-v2"]')) click("Toggle review")
  // The panel renders its buttons on the next frame after it opens.
  requestAnimationFrame(() => requestAnimationFrame(() => click("Open file")))
}

/** Shortcuts to the files and the terminal, which participants would otherwise have to find in opencode. */
function ToolButtons() {
  return (
    <div style={{ display: "flex", gap: "4px" }}>
      <Button variant="ghost" size="large" onClick={openFiles}>
        Files
      </Button>
      <Button variant="ghost" size="large" onClick={openTerminal}>
        Terminal (Ctrl+`)
      </Button>
    </div>
  )
}

/** One radio option, with the markup and styles of opencode's own question prompt. */
function Option(props: { label: string; picked: boolean; onClick: () => void }) {
  return (
    <button type="button" data-slot="question-option" data-picked={props.picked} role="radio" aria-checked={props.picked} onClick={props.onClick}>
      <span data-slot="question-option-check" aria-hidden="true">
        <span data-slot="question-option-box" data-type="radio" data-picked={props.picked}>
          <span data-slot="question-option-radio-dot" />
        </span>
      </span>
      <span data-slot="question-option-main">
        <span data-slot="option-label">
          <bdi>{props.label}</bdi>
        </span>
      </span>
    </button>
  )
}

/** A prompt in the place of opencode's composer, styled like the agent asking the user something. */
function Prompt(props: { title: string; text: string; hint?: string; children?: any; footer: any }) {
  return (
    <div data-component="session-question-dock" data-study-dock>
      <DockPrompt
        kind="question"
        header={
          <>
            <div data-slot="question-header-top">
              <div data-slot="question-header-title">
                <bdi>{props.title}</bdi>
              </div>
            </div>
            <div data-slot="question-details">
              <div data-slot="question-text">
                <bdi>{props.text}</bdi>
              </div>
              <Show when={props.hint}>
                <div data-slot="question-hint">{props.hint}</div>
              </Show>
            </div>
          </>
        }
        footer={props.footer}
      >
        {props.children ?? <div />}
      </DockPrompt>
    </div>
  )
}

/** The study's part of the session screen: replaces the composer, so the participant never types to the agent. */
export function StudyDock() {
  const [probe, setProbe] = createSignal<number | undefined>()
  const v = () => view()!

  return (
    <Switch>
      <Match when={v().phase === "working" || busy()}>
        <div data-study-working>
          <span data-study-spinner />
          The agent is working…
        </div>
      </Match>

      <Match when={v().phase === "plan"}>
        <Prompt
          title="Approve the plan?"
          text="The agent has answered your request with a plan. Read it above, then let the agent start."
          footer={
            <>
              <div />
              <div data-slot="question-footer-actions">
                <Button variant="submit" size="large" onClick={() => act({ type: "approvePlan" })}>
                  Approve plan
                </Button>
              </div>
            </>
          }
        />
      </Match>

      <Match when={v().phase === "stage1"}>
        <Prompt
          title={v().finished ? "The agent has finished" : "The agent paused for your review"}
          text="Review what it wrote: the changes view at the top right shows the diff, Files opens the whole project, and the terminal runs code. Then decide."
          footer={
            <>
              <ToolButtons />
              <div data-slot="question-footer-actions">
                <Button variant="neutral" size="large" onClick={() => act({ type: "stage1", decision: "reject" })}>
                  Reject / flag defect
                </Button>
                <Button variant="submit" size="large" onClick={() => act({ type: "stage1", decision: "accept" })}>
                  {v().finished ? "Accept" : "Accept and continue"}
                </Button>
              </div>
            </>
          }
        />
      </Match>

      <Match when={v().phase === "stage2" && v().probe}>
        <Prompt
          title="Before you finalize"
          text={v().probe!.question}
          hint="You can run the code in the terminal to check."
          footer={
            <>
              <ToolButtons />
              <div data-slot="question-footer-actions">
                <Button variant="neutral" size="large" disabled={probe() === undefined} onClick={() => act({ type: "stage2", probeAnswer: probe(), final: "reverse" })}>
                  Reverse my decision
                </Button>
                <Button variant="submit" size="large" disabled={probe() === undefined} onClick={() => act({ type: "stage2", probeAnswer: probe(), final: "confirm" })}>
                  Confirm my decision
                </Button>
              </div>
            </>
          }
        >
          <div data-slot="question-options" role="radiogroup">
            <For each={[...v().probe!.options, "I don't know"]}>
              {(label, i) => {
                const value = () => (i() === v().probe!.options.length ? -1 : i())
                return <Option label={label} picked={probe() === value()} onClick={() => setProbe(value())} />
              }}
            </For>
          </div>
        </Prompt>
      </Match>

      <Match when={v().phase === "reviewing"}>
        <Prompt
          title="The feature is finished"
          text="Look over the finished code for as long as you like. When you're done, mark the review finished. Your access to the code ends there."
          footer={
            <>
              <ToolButtons />
              <div data-slot="question-footer-actions">
                <Button variant="submit" size="large" onClick={() => act({ type: "reviewed" })}>
                  I've finished reviewing
                </Button>
              </div>
            </>
          }
        />
      </Match>
    </Switch>
  )
}
