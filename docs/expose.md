# Master's Thesis Exposé

**Author:** Yunus Emre Yavuz ([yunus.yavuz@campus.lmu.de](mailto:yunus.yavuz@campus.lmu.de))  
**Advisors:** Thomas Weber and Prof. Dr. Albrecht Schmidt  
**Chair:** Human-Centered Ubiquitous Media, LMU Munich  
**Date:** 16 October 2026 (Revised following Supervisor Meeting on 15 October 2026)

---

# Knowing When to Pause: Pair-Programming-Driven Verification Checkpoints and Parallel System-1 Review in Agentic Software Development

## 1. Motivation: The "8,000-Line Batch Problem" vs. "Arbitrary Interruption"

AI-assisted software engineering has shifted from single-line autocomplete to autonomous agents that implement entire **User Stories, Features, and Tickets** across multiple files (e.g., Claude Code `acceptEdits`, Cursor Agent, OpenCode). While code generation speed has increased, human verification and code understanding have not kept pace. In the 2025 Stack Overflow Developer Survey ($n > 49{,}000$), 66% of developers cite *"AI solutions that are almost right, but not quite"* as their top frustration. In the 2026 Sonar State of Code Survey ($n = 1{,}149$), 96% of developers do not fully trust AI-generated code to be functionally correct, yet only 48% always verify it before committing—a divide Sonar terms the *verification gap*. At the organizational level, the 2026 Faros AI Engineering Report ($n = 22{,}000$ developers, $4{,}000$ teams) reports a severe review bottleneck alongside a 28% rise in bugs per pull request. Longitudinal telemetry across 11,429 AI pull-request reviews by 400 repeat reviewers over seven months shows human approval rising from 30.1% to 36.8% while inline comments fall by 22% (**Yu et al., 2026**, `https://arxiv.org/abs/2606.22721`). In a five-hour study of autonomous coding agents, 94% (83/88) of developers failed to detect subtle agent sabotage; crucially, even when a real-time LLM monitor correctly flagged suspicious actions, sabotage still succeeded in 56% of alerted sessions because developers ignored passive, flag-only warnings (**Ye et al., NeurIPS 2026**, `https://arxiv.org/abs/2606.05647`).

When designing human oversight for an autonomous agent implementing a User Story or Feature, current workflows fall into **two broken extremes**:

1. **End-of-Feature Batch Guards ("The 8,000-Line Problem"):**
   In standard agentic workflows, the agent executes dozens of edits autonomously and presents a finished multi-file diff at the very end (`git commit` / PR merge), accompanied by passing happy-path unit tests ("Green CI"). As shown by **Dhanorkar, Passi, and Vorvoreanu (FAccT 2026**, DOI: `https://doi.org/10.1145/3805689.3812402`, arXiv: `https://arxiv.org/abs/2606.05391`), developers overseeing agents rely on *"efficiency-over-perfection heuristics, including treating test results as a guarantee of correctness."* Placing a verification gate at the end of a large batch effectively tells the developer: *"Here are 500–8,000 lines of finished code—now inspect and understand it."* At that point, cognitive overload makes mental simulation impossible, low-level implementation details (*Implementierungsdetails*) that silently violate the User Story are buried inside a massive diff, and if an early assumption was flawed, the entire downstream implementation is wasted (**Perry et al., CCS 2023**, DOI: `https://doi.org/10.1145/3576915.3623157`; **Becker et al., 2025**, `https://arxiv.org/abs/2507.09089`; **Shen & Tamkin, 2026**, `https://arxiv.org/abs/2601.20245`).
2. **Arbitrary Intermediate Interruptions (*Scaffolding step*):**
   The opposite extreme—forcing the developer to approve or answer a check after every micro-edit, file write, or fixed line threshold—interrupts the workflow at an **scaffolding state (*scaffolding step*)**. Because an agent builds a feature in stages (creating type definitions, scaffolding imports, writing core logic, wiring routes), pausing at an arbitrary step catches the code in an incomplete state or forces the human to verify trivial boilerplate, rapidly inducing annoyance and click-through habituation.

This thesis argues that **knowing *when* and *why* to pause an agent is just as critical as *what* to ask when pausing**. Rather than gating at the end of a massive batch or interrupting at scaffolding edits, we derive principled **When & Why Intervention Criteria (*Kriterien: Wann und Warum*)** from **Human Pair Programming and Peer Code Review theory**, and operationalize them via a fast **Parallel System-1 Code Reviewer** that monitors the agent's progress in real time.

---

## 2. Theoretical Grounding: Pair Programming, Code Review, and Cognitive Forcing

### 2.1 From Human–Human to Human–AI Pair Programming (*Wann andere intervenieren*)
Before autonomous coding agents, software engineering already had an established paradigm in which one actor writes code while a second actor observes, maintains understanding, and intervenes: **Pair Programming (Driver + Navigator)** and **Peer Code Review**.

In early inline autocomplete (e.g., Copilot tab-completion), the human remained the Driver (**Barke, James, & Polikarpova, OOPSLA 2023**, DOI: `https://doi.org/10.1145/3586030`; **Imai, ICSE 2022**, DOI: `https://doi.org/10.1145/3510454.3522684`). In 2026 agentic coding, the roles have inverted: **the AI Agent is the Driver** implementing the User Story, while **the Human is pushed into the Navigator/Reviewer role**—but without the continuous cognitive engagement that keeps a human Navigator's mental model synchronized (**Mozannar et al., CHI 2024**, DOI: `https://doi.org/10.1145/3613904.3642936`).

Empirical studies of human pair programming and code review demonstrate how human Navigators solve the tradeoff between end-of-batch overload and arbitrary interruption:
- **Continuous Intermediate-Level Navigation:** **Bryant, Romero, and du Boulay (IJHCS 2008**, DOI: `https://doi.org/10.1016/j.ijhcs.2007.03.005`) show that effective Navigators act as continuous reviewers who bridge low-level code with task-level goals to maintain a shared mental model.
- **When and Why Navigators Intervene:** **Plonka et al. (IJHCS 2015**, DOI: `https://doi.org/10.1016/j.ijhcs.2014.09.001`) and **Chong & Hurlbutt (ICSE 2007**, DOI: `https://doi.org/10.1109/ICSE.2007.87`) document that human partners do *not* interrupt during routine typing or boilerplate setup. They intervene specifically when: (1) an unstated assumption in the User Story is silently resolved in code, (2) a foundational logic block is completed before downstream wiring begins, or (3) shared understanding between Driver and Navigator diverges.
- **Understanding as the Core Goal of Code Review:** **Bacchelli and Bird (ICSE 2013**, DOI: `https://doi.org/10.1109/ICSE.2013.6606617`) and **Sadowski et al. (ICSE-SEIP 2018**, DOI: `https://doi.org/10.1145/3183519.3183525`) establish that building **code understanding**—not merely hunting syntax defects—is the primary motivation and bottleneck in peer code review. Furthermore, **Gullstrand Heander, Söderberg, and Rydenfält (EMSE 2026**, DOI: `https://doi.org/10.1007/s10664-025-10791-2`) show in their *Code Review as Decision-Making (CRDM)* model that once reviewers reach a final accept/reject vote on a finished artifact, they rarely return to mental simulation on their own.

### 2.2 Taxonomy of "When & Why" Intervention Criteria (*Kriterien: Wann und Warum*)
Synthesizing Pair Programming and CRDM literature, we define three explicit criteria for **when and why** an agent implementing a **User Story / Feature** must pause for human verification—and when it must *not* pause:

| Criterion | Abstraction Bridge | Why Intervene Here? (Pair Programming Grounding) | Concrete Example |
|---|---|---|---|
| **M1. Implicit User-Story Resolution** | *Implementierungsdetail* $\leftrightarrow$ *User Story* | The User Story leaves an edge case implicit; the agent writes a 15–25 line implementation detail that silently decides user-visible behavior (**Plonka et al., 2015**, DOI: `https://doi.org/10.1016/j.ijhcs.2014.09.001`). | User Story: *"Allow customers to reserve stock."* Agent silently decides in code whether failed reservations roll back partial stock counts. |
| **M2. Foundational State Lock-In** | *Core Logic Unit* $\leftrightarrow$ *Feature Architecture* | The agent finishes the core state/algorithmic logic of a feature *before* wiring it into multiple endpoints, controllers, or tests (**Bryant et al., 2008**, DOI: `https://doi.org/10.1016/j.ijhcs.2007.03.005`). | Pausing right after the 25-line retry/deduplication core is written—*before* hundreds of lines of API routes and boilerplate are built around it. |
| **M3. Green-CI / Expectation Divergence** | *Runtime Behavior* $\leftrightarrow$ *Human Understanding* | Happy-path tests pass, creating a false sense of security (**Dhanorkar et al., 2026**, DOI: `https://doi.org/10.1145/3805689.3812402`), while boundary behavior diverges from natural expectations (**Bacchelli & Bird, 2013**, DOI: `https://doi.org/10.1109/ICSE.2013.6606617`). | Happy-path tests for `"2h"` and `"45m"` pass, but combined input `"1h30m"` silently drops the hours component. |
| **Non-Trigger (*Scaffolding step*)** | *Boilerplate / Mid-Edit* | Routine scaffolding (type definitions, imports, route plumbing, or incomplete mid-function edits). Intervening here wastes attention and causes habituation. | Agent creating interfaces (`types.ts`), mock fixtures, or standard Express route wrappers. |

### 2.3 Parallel Code Review as "System One" + Active Boundary Verification as "System Two"
To operationalize Criteria M1-M3 in an agentic workflow without human babysitting, we combine two mechanisms grounded in **Kahneman’s System 1 / System 2 dual-process framework**:

1. **Parallel Code Review as Machine System 1 (Monitoring *When & Why* to Pause):**
   Traditional autoregressive LLMs take 3–30 seconds per query and produce poorly calibrated confidence scores, making them unsuitable for synchronous step-by-step monitoring. In contrast, new **System One decision models** such as TypeSafe AI’s **Jev** (`~typesafe/jev-latest` via the OpenRouter Decisions API; **Almeida / TypeSafe AI, 2026**, `https://typesafe.ai/blog/introducing-system-one-models-and-jev`), trained via *Reinforcement Learning for Calibrated Decisions (RLCD)*, evaluate atomic typed questions (`noul` yes/no probabilities, `choice` distributions, and ordered `score` rubrics) against a program state in parallel and return calibrated probability distributions and confidence scores in **70–500 ms**. Running alongside the coding agent like an AI Co-Navigator, the **Parallel System-1 Reviewer** evaluates each agent step in a single parallel query against Criteria M1-M3 (`is_scaffolding_step`, `m1_story_disambiguation`, `m2_foundation_lock_in`, `m3_expectation_divergence`, and `checkpoint_classification`). Boilerplate steps pass silently; the moment a semantic milestone (M1-M3) is reached, the System-1 monitor pauses the agent *while the critical diff is still ~25 lines*.
2. **Active Boundary-Behavior Probe as Human System 2 (Restoring Understanding & Verification):**
   Cognitive Forcing Function (CFF) research proves that passive explanations rarely reduce over-reliance (**Buçinca, Malaya, & Gajos, CSCW 2021**, DOI: `https://doi.org/10.1145/3449287`) and generic prompts can backfire: **Ghosh et al. (2026**, `https://arxiv.org/abs/2601.18033`) found a generic *"What-If"* prompt worsened over-reliance to **80.7%**, whereas checking concrete assumptions reduced it (70.6% $\to$ 63.0%); similarly, **Sovrano, Dominici, and Bacchelli (FSE 2026**, DOI: `https://doi.org/10.1145/3715740`) showed generic debiasing had **0% effect** while surfacing concrete assumptions cut bias by **~51%** (see also **Li et al., CHI 2026**, DOI: `https://doi.org/10.1145/3772318.3790632`; **Danry et al., CHI 2023**, DOI: `https://doi.org/10.1145/3544548.3580672`; **Chen & Schmidt, HCII/DUXU 2024**, DOI: `https://doi.org/10.1007/978-3-031-61353-1_1`; **Zhu et al., AI and Ethics 2026**, DOI: `https://doi.org/10.1007/s43681-026-01147-7`).
   Therefore, when the Parallel System-1 Reviewer pauses at a M1-M3 milestone, the gate presents a **Two-Stage Checkpoint** that asks one concrete, sandbox-executed question bridging the **User Story** and the **Implementation Detail**: *"For User Story scenario X (e.g., reserving 5 items when 2 are in stock), what does this 20-line implementation actually produce?"*

---

## 3. Research Questions

- **RQ1 (Verification Quality — Discrimination $d'$, Criterion $c$, and Decision Reversals):**
  Do **Pair-Programming Guided Checkpoints** (pausing at semantic milestones M1-M3 while the critical change is ~20 lines and contextualized by the User Story) improve developers' sensitivity ($d'$) in discriminating between flawed and correct feature implementations compared to **(a) End-of-Feature Batch Review** and **(b) Arbitrary Intermediate Checkpoints (*Scaffolding step*)**, without merely inducing blanket rejection ($c$)? How frequently does answering the boundary-behavior probe trigger a corrective within-checkpoint **decision reversal** (`Accept → Reject` on flawed logic)?
  *(Grounded in Signal Detection Theory for human-AI reliance: **Schoeffer et al., JAIR 2025**, DOI: `https://doi.org/10.1613/jair.1.15873`; **Guo et al., FAccT 2024**, DOI: `https://doi.org/10.1145/3630106.3658901`; **Bo, Wan, & Anderson, CHI 2025**, DOI: `https://doi.org/10.1145/3706598.3714097`; **Langer, Schlicker, & Baum, 2024**, DOI: `https://doi.org/10.1007/s11023-024-09701-0`.)*
- **RQ2 (Developer Code Understanding & Mental Model Retention):**
  Does pausing at **Pair-Programming Milestones (M1-M3)** lead to higher post-feature **code understanding** (accuracy in answering post-story mental-model questions about how the completed feature works after the diff is closed) compared to End-of-Feature Batch Review and Arbitrary Intermediate Checkpoints?
- **RQ3 (Cost, Habituation, and Parallel System-1 Evaluation with TypeSafe Jev):**
  1. How do cognitive load, frustration, and review dwell-time decay (habituation) compare across **Pair-Programming Checkpoints**, **Arbitrary Intermediate Checkpoints**, and **End-of-Feature Batch Review**?
  2. How accurately and quickly (in ms) can a **Parallel System-1 Code Reviewer (TypeSafe Jev)** classify intermediate agent steps against Criteria M1-M3 (vs. *Scaffolding step*) and predict human Stage-1 rubber-stamping from live review telemetry?

---

## 4. System Architecture and Ephemeral Container Study Runner

### 4.1 Multi-Step User Story Workspace & Two-Stage Checkpoint Flow
The study harness models an agentic IDE workspace where an agent implements a **User Story / Feature** across **4 sequential steps** (~180 lines total across 3 files when finished):
- **Step 1 (*Boilerplate / scaffolding step*):** Data types, interfaces, and schema definitions (~35 lines).
- **Step 2 (*Critical M1-M3 Milestone*):** Core domain and boundary logic (~25 lines) where an implementation detail determines User Story edge-case behavior.
- **Step 3 (*Boilerplate / scaffolding step*):** Controller/route plumbing and service wiring (~70 lines).
- **Step 4 (*Completion*):** Happy-path unit tests (`3/3 PASS` in both `Correct` and `Flawed` variants, ~50 lines).

At any checkpoint where a behavior probe fires, the harness uses a **server-authoritative Two-Stage Flow** so initial review behavior is never contaminated by the question:
1. **Stage 1 (Natural Review $\to$ Initial Click):** The participant inspects the User Story brief, test runner, and diff, and clicks **`[Accept / Continue]`** or **`[Reject / Flag Defect]`**. The server logs `initial_decision`, `stage1_dwell_ms`, `diff_scroll_coverage`, and `test_runs_stage1`.
2. **Stage 2 (Boundary-Behavior Probe $\to$ Confirm or Reverse):** Before proceeding, the gate intercepts the click and asks: *"Before finalizing: for boundary scenario X, what does this code return / set state Y to?"* (4 seeded options + *"I don't know"*; no correctness feedback shown). Once answered, the participant clicks **`[Confirm Initial Decision]`** or **`[Reverse Decision]`**, logging `final_decision`, `decision_reversed`, and `stage2_probe_latency_ms`.

### 4.2 Reproducible Ephemeral Docker Container Infrastructure (Systems Contribution)
To eliminate cross-participant state bleed, environment drift, and external LLM cheating while contributing a reusable empirical software engineering runner, **every participant session runs inside an isolated, ephemeral Docker container initialized from a single random seed**:

```bash
docker run --rm --network none \
  -p 127.0.0.1:5185:5185 \
  -e PARTICIPANT_ID="P14" \
  -e STUDY_SEED="91827364" \
  -v "$(pwd)/exports:/exports:rw" \
  beacon-study-harness:latest
```

1. **Deterministic Session Generation from `STUDY_SEED`:** Inside the container, `STUDY_SEED` drives a cryptographic PRNG that deterministically assigns the participant to one of 6 counterbalanced Latin-square groups, sets the User Story sequence, assigns the oversight regime (`BATCH`, `ARBITRARY`, `PAIR_PROG`) and patch variant (`Correct`, `Flawed`), and shuffles multiple-choice option order. Any session can be replayed identically from its seed.
2. **Air-Gapped Real Execution Sandbox:** Running with `--network none` blocks all outbound internet/LLM access while providing a real Node.js/TypeScript runtime (`server/runner.ts`) so project unit tests execute against actual code. Ground-truth grading tables remain strictly server-side and are never sent to the browser.
3. **Automated Telemetry Extraction & Immediate Self-Destruction:** When the participant completes the debrief screen (`POST /api/study/finish`), the server validates the session schema, writes the complete JSON bundle (`/exports/P14_91827364.json`), appends 6 trial rows to `/exports/trials.csv`, flushes disk (`fsyncSync`), and calls `process.exit(0)`. Because of `--rm`, Docker immediately destroys the container and wipes its temporary workspace.

### 4.3 What is Scripted vs. Real AI in the Study

| System Component | Scripted or Real Execution? | Rationale |
|---|---|---|
| **Agent Code Steps (Steps 1–4 per User Story)** | **Scripted (Frozen in Container)** | Guarantees every participant inspects identical diffs and identical seeded defects so `STUDY_SEED` is 100% reproducible and $d'$ has exact ground truth. |
| **Workspace Test Runner & Boundary Evaluator** | **Real Runtime Execution** | Actually executes TypeScript modules and unit tests inside the container's Node.js sandbox (`server/runner.ts`). |
| **Parallel System-1 Reviewer (TypeSafe Jev)** | **Real Jev API Evaluation** | Because Jev returns deterministic, calibrated probability distributions over structured decisions in 70–500 ms, we run the **real Jev API** on (a) all intermediate agent code steps (evaluating M1-M3 milestone vs. *Scaffolding step* classification) and (b) participants' real Stage-1 review telemetry (`dwell_ms`, `scroll_coverage`, `test_runs`) to benchmark Jev's precision, recall, Brier calibration, and latency (RQ3). |

---

## 5. Multi-Step User Story Corpus

Each of the 6 User Stories (`US1`–`US6`) follows the 4-step structure (~180 lines total when batched, vs. ~25 lines at the Step-2 M1-M3 milestone), with 3 passing happy-path unit tests in both variants:

| Story | User Story & 4 Agent Steps | Step-2 M1-M3 Defect (Flawed Variant) | Boundary-Behavior Probe | Post-Story Understanding Question (RQ2) |
|---|---|---|---|---|
| **US1** | **Flash-Sale Inventory Reservation**<br>*S1:* SKU types & store schema<br>*S2 (M1):* `reserveStock()` state mutation<br>*S3:* Checkout controller & REST route<br>*S4:* Happy-path tests (`3/3 PASS`) | **M1 (Implicit Story Ambiguity):** Decrements `stock -= qty` *before* checking `if (stock < 0) throw`, leaving negative stock on failed orders. | Starting with `stock = 2`, after a failed reservation of `5` units throws an error, what is `stock`? (`2` / `0` / `-3` / `undefined`) | How does the checkout endpoint behave on subsequent valid orders after a single oversized reservation fails? |
| **US2** | **Webhook Payment Idempotency & Retry**<br>*S1:* Event log schema & interfaces<br>*S2 (M2):* Deduplication state & `withRetry` loop<br>*S3:* Webhook Express middleware<br>*S4:* Happy-path tests (`3/3 PASS`) | **M2 (Foundational Lock-In):** Marks `eventId` as `"processed"` *before* handler runs; if attempt 1 throws a transient error, retries are skipped as duplicates. | If the handler throws on attempt 1 for `evt_9`, what does the retry call for `evt_9` do? (`Re-runs handler` / `Skips as already processed` / `Throws duplicate error` / `null`) | Under what failure sequence can a customer payment webhook return `200 OK` without crediting the account? |
| **US3** | **Multi-Tenant Feature-Flag & Quota Engine**<br>*S1:* Tenant config types<br>*S2 (M3):* Config merge (`override` over `base`)<br>*S3:* Quota middleware decorator<br>*S4:* Happy-path tests (`3/3 PASS`) | **M3 (Expectation Divergence):** Uses `override[k] \|\| base[k]` instead of `??`, ignoring explicit tenant `false` or `0` overrides when global default is truthy. | Given global `allowExport = true` and tenant override `allowExport = false`, what does `getEffectiveConfig()` return for `allowExport`? (`false` / `true` / `undefined` / `null`) | Why does setting a tenant's rate limit quota to `0` fail to block requests when the organization default is `100`? |
| **US4** | **SLA Duration & Billing Window Calculator**<br>*S1:* Billing tier constants & types<br>*S2 (M3):* `parseDurationMs()` parser<br>*S3:* SLA credit invoice generator<br>*S4:* Happy-path tests (`3/3 PASS`) | **M3 (Green-CI Divergence):** Happy-path tests check `"2h"` and `"45m"` (pass), but regex drops hours when minutes follow (`"1h30m"` parsed as `"30m"`). | What does `parseDurationMs("1h30m")` return in ms? (`5,400,000` / `1,800,000` / `5,400` / `null`) | If an outage lasts `1h30m` against a `1h` SLA threshold, why does the invoice generator compute zero credit in the flawed patch? |
| **US5** | **Sliding-Window API Rate Limiter**<br>*S1:* Client bucket interfaces<br>*S2 (M1):* `checkAndRecord()` timestamp eviction<br>*S3:* Gateway rate-limit filter<br>*S4:* Happy-path tests (`3/3 PASS`) | **M1 (Implicit Story Ambiguity):** Appends current request timestamp to window *even when* the request is rejected for exceeding the limit, permanently locking out retrying clients. | With limit `2/min` and 2 calls at `t=0`, after a rejected call at `t=10s`, how many timestamps are stored? (`2` / `3` / `0` / `1`) | What happens to a client that sends one request every 40 seconds under a `2 requests per 60s` limit if rejected calls are recorded? |
| **US6** | **Discount Tier & Percentage Clamping**<br>*S1:* Cart line-item types<br>*S2 (M2):* `applyDiscount()` & `clampPercent()`<br>*S3:* Order summary calculator<br>*S4:* Happy-path tests (`3/3 PASS`) | **M2 (Foundational Lock-In):** Upper bound clamped via `Math.min(100, pct)` without lower bound `Math.max(0, ...)`, allowing negative coupon adjustments to increase total price. | What does `clampPercent(-15)` return in this implementation? (`0` / `-15` / `100` / `NaN`) | How does a negative discount adjustment affect the final invoice total in the order summary calculator? |

---

## 6. Experimental Design, Counterbalanced Groups, and Procedure

### 6.1 $3 \times 2$ Within-Participants Design
Every participant completes **1 practice story (`US0`)** followed by **6 measured User Stories (`US1`–`US6`)** in a $3 \times 2$ within-participants factorial design:
- **Factor 1 — Oversight Regime (3 levels):**
  1. `BATCH`: Agent runs Steps 1–4 uninterrupted; checkpoint occurs once on the full ~180-line multi-file diff at the end.
  2. `ARBITRARY` (*Scaffolding step*): Agent pauses at routine boilerplate/wiring steps (Step 1 and Step 3) before final commit.
  3. `PAIR_PROG` (*Pair-Programming Milestone*): Parallel System-1 Reviewer skips Step 1 boilerplate and pauses immediately at **Step 2** (~25-line M1-M3 milestone) before wiring Steps 3–4.
- **Factor 2 — Implementation Correctness (2 levels):** `Flawed` (contains Step-2 M1-M3 defect; happy-path tests pass) vs. `Correct` (both happy-path and boundary behavior correct).

Participants ($N = 30\text{–}36$, a multiple of 6) are assigned by `STUDY_SEED` to one of **6 Williams Latin-Square Sequence Groups** so that every User Story appears equally often in every Regime $\times$ Correctness cell.

### 6.2 Session Procedure (~30 Minutes in Lab)
1. **Onboarding & Pre-Survey (4.5 min):** Consent, demographics, **NCS-6** (**Coelho et al., 2018**, DOI: `https://doi.org/10.1177/1073191118793208`), **S-TIAS** (**McGrath et al., 2025**, DOI: `https://doi.org/10.3389/frai.2025.1582880`), attention check.
2. **Practice Tutorial (`US0`, 2 min):** Demonstrates the multi-step progress bar, Monaco diff, sandbox test runner, and Two-Stage Checkpoint.
3. **Measured User Stories (`US1`–`US6`, 18 min, ~3 min per story):**
   - Participant oversees the agent under the assigned regime (`BATCH`, `ARBITRARY`, or `PAIR_PROG`).
   - At the checkpoint: **Stage 1** (initial decision + natural dwell/scroll telemetry) $\to$ **Stage 2** (boundary probe + confirm/reverse decision).
   - **Post-Story Understanding Question (Diff Closed):** 1 multiple-choice mental-model question (RQ2) + Confidence (1–7), Mental Demand (1–5), Frustration (1–5).
4. **Post-Survey & Exit Interview (4 min):** Raw **NASA-TLX** (**Hart & Staveland, 2006**, DOI: `https://doi.org/10.1177/154193120605000909`), **Paas** effort scale (**Paas, 1992**, DOI: `https://doi.org/10.1037/0022-0663.84.4.429`), direct preference ranking of the 3 regimes, and debrief.
5. **Automated Extraction & Container Teardown (<1 sec):** Container validates `/exports` JSON + `trials.csv` and self-destructs (`docker rm -f`).

---

## 7. Measures and Statistical Analysis Plan

- **RQ1 — Discrimination ($d'$), Criterion ($c$), and Decision Reversals:**
  Analyzed via a hierarchical **probit-link Generalized Linear Mixed Model (GLMM)** (**DeCarlo, 1998**, DOI: `https://doi.org/10.1037/1082-989X.3.2.186`):
  $$\Phi^{-1}\big(P(\text{Reject}_{ij})\big) = \beta_0 + \sum_{r} \beta_{1r}\text{Regime}_{ij} + \beta_2\text{Flawed}_{ij} + \sum_{r} \beta_{3r}(\text{Regime}_{ij} \times \text{Flawed}_{ij}) + u_{0i} + v_{0j}$$
  where $\beta_{3r}$ estimates the change in discrimination ($\Delta d'$) and $\beta_{1r}$ estimates criterion shift ($\Delta c$) for `PAIR_PROG` vs. `BATCH` and `ARBITRARY`. Within-checkpoint **decision reversals** (`Stage-1 Accept` $\to$ `Stage-2 Reject` on flawed implementations) are analyzed via paired mixed-effects logistic regression, leveraging each checkpoint as its own baseline (**Sommet et al., 2023**, DOI: `https://doi.org/10.1177/25152459231178728`).
- **RQ2 — Post-Story Code Understanding:**
  Mixed-effects logistic regression on `understanding_question_correct` (0/1) across the 3 Regimes, testing whether pausing at the 25-line M1-M3 milestone yields superior feature comprehension compared to reviewing a 180-line finished batch.
- **RQ3 — Workload, Habituation, and Jev System-1 Calibration:**
  Linear mixed models on decision latency, mental demand, frustration, and dwell-time slope across trial order; plus precision/recall, Brier score, Expected Calibration Error (ECE), and inference latency (ms) of **TypeSafe Jev** on step classification (`M1-M3` vs. *scaffolding step*) and Stage-1 rubber-stamp prediction.

---

## 8. Expected Contributions

1. **Theory-Driven "When & Why" Taxonomy for Agentic Oversight:**
   Deriving explicit intervention criteria (M1: Implicit User-Story Resolution, M2: Foundational State Lock-In, M3: Green-CI / Expectation Divergence) from **Human Pair Programming and Peer Code Review theory** (**Bryant et al., 2008**; **Plonka et al., 2015**; **Bacchelli & Bird, 2013**; **Gullstrand Heander et al., 2026**) to overcome both the **"8,000-Line Batch Problem"** and **"Arbitrary Intermediate Interruptions (*Scaffolding step*)."**
2. **Empirical Comparison of Pair-Programming Checkpoints vs. Batch and Arbitrary Review:**
   Controlled lab evidence ($N = 30\text{–}36$) quantifying how checkpoint timing and execution-scored boundary probes affect **defect discrimination ($d'$, $c$)**, **within-checkpoint decision reversals**, and **post-feature code understanding (RQ2)**.
3. **"Parallel Code Review as System One" Evaluation (TypeSafe Jev):**
   Demonstrating and benchmarking how a sub-200ms, RLCD-calibrated **System-1 decision model (Jev)** can act as a real-time AI Co-Navigator—classifying agent steps against Criteria M1-M3 and detecting human Stage-1 rubber-stamping.
4. **Ephemeral, Seeded Docker Container Study Runner:**
   An open-source, reproducible experimental harness where each participant session spawns an air-gapped (`--network none`) Docker container from a single PRNG seed, runs a real Node.js test sandbox without cross-participant state bleed, and automatically extracts validated JSON/CSV telemetry before destroying the container on completion.
5. **Multi-Step "User Story $\to$ Implementation Detail" Benchmark Corpus:**
   A calibrated corpus of 6 multi-step User Story implementations (with passing happy-path unit tests, matched M1-M3 boundary defects, execution-scored probes, and post-story comprehension items).

---

## 9. Key References (With Verified DOIs & Direct Links)

- Almeida, D. / TypeSafe AI. (2026). Introducing System One Models & Jev: Reinforcement Learning for Calibrated Decisions (RLCD). *TypeSafe AI Technical Blog*, Sep/Oct 2026. `https://typesafe.ai/blog/introducing-system-one-models-and-jev`.
- Bacchelli, A., & Bird, C. (2013). Expectations, outcomes, and challenges of modern code review. *Proc. IEEE/ACM ICSE 2013*, 712–721. DOI: `https://doi.org/10.1109/ICSE.2013.6606617`.
- Barke, S., James, M. B., & Polikarpova, N. (2023). Grounded Copilot: How programmers interact with code-generating models. *PACMPL (OOPSLA1)*, 7, Art. 78. DOI: `https://doi.org/10.1145/3586030`.
- Becker, J., Rush, N., Barnes, E., & Rein, D. (2025). Measuring the impact of early-2025 AI on experienced open-source developer productivity. *arXiv:2507.09089* (`https://arxiv.org/abs/2507.09089`).
- Bo, J. Y., Wan, S., & Anderson, A. (2025). To rely or not to rely? Evaluating interventions for appropriate reliance on large language models. *Proc. ACM CHI 2025*. DOI: `https://doi.org/10.1145/3706598.3714097`.
- Bryant, S., Romero, P., & du Boulay, B. (2008). Pair programming and the mysterious role of the navigator. *International Journal of Human-Computer Studies (IJHCS)*, 66(7), 519–529. DOI: `https://doi.org/10.1016/j.ijhcs.2007.03.005`.
- Buçinca, Z., Malaya, M. B., & Gajos, K. Z. (2021). To trust or to think: Cognitive forcing functions can reduce overreliance on AI in AI-assisted decision-making. *PACM HCI (CSCW1)*, 5, Art. 188. DOI: `https://doi.org/10.1145/3449287`.
- Chen, Z., & Schmidt, R. (2024). Exploring a behavioral model of "positive friction" in human-AI interaction. *HCII/DUXU 2024*, LNCS 14713, 3–22. DOI: `https://doi.org/10.1007/978-3-031-61353-1_1`.
- Chong, J., & Hurlbutt, T. (2007). The social dynamics of pair programming. *Proc. IEEE/ACM ICSE 2007*, 354–363. DOI: `https://doi.org/10.1109/ICSE.2007.87`.
- Coelho, G. L. H., Hanel, P. H. P., & Wolf, L. J. (2018). The Very Efficient Assessment of Need for Cognition: Developing a Six-Item Version. *Assessment*, 27(8), 1870–1885. DOI: `https://doi.org/10.1177/1073191118793208`.
- Danry, V., Pataranutaporn, P., Mao, Y., & Maes, P. (2023). Don't just tell me, ask me: AI systems that intelligently frame explanations as questions improve human logical discernment. *Proc. ACM CHI 2023*, Art. 352. DOI: `https://doi.org/10.1145/3544548.3580672`.
- DeCarlo, L. T. (1998). Signal detection theory and generalized linear models. *Psychological Methods*, 3(2), 186–205. DOI: `https://doi.org/10.1037/1082-989X.3.2.186`.
- Dhanorkar, S., Passi, S., & Vorvoreanu, M. (2026). Human oversight of agentic systems in practice. *Proc. ACM FAccT 2026*, 6438–6465. DOI: `https://doi.org/10.1145/3805689.3812402` (arXiv: `https://arxiv.org/abs/2606.05391`).
- Ghosh, A., Sarkar, A., Lindley, S., & Poelitz, C. (2026). An experimental comparison of cognitive forcing functions for execution plans in AI-assisted writing. *arXiv:2601.18033* (`https://arxiv.org/abs/2601.18033`).
- Gullstrand Heander, L., Söderberg, E., & Rydenfält, C. (2026). Code review as decision-making: A model of reviewer cognition. *Empirical Software Engineering (EMSE)*. DOI: `https://doi.org/10.1007/s10664-025-10791-2`.
- Guo, Z., Wu, Y., Hartline, J. D., & Hullman, J. (2024). A decision theoretic framework for measuring AI reliance. *Proc. ACM FAccT 2024*. DOI: `https://doi.org/10.1145/3630106.3658901`.
- Hart, S. G., & Staveland, L. E. (2006). Development of NASA-TLX: Results of empirical and theoretical research. *Proceedings of the Human Factors and Ergonomics Society Annual Meeting*, 50(9), 904–908. DOI: `https://doi.org/10.1177/154193120605000909`.
- Imai, S. (2022). Is GitHub Copilot a substitute for human pair-programming? An empirical study. *Proc. ACM/IEEE ICSE Companion 2022*, 319–321. DOI: `https://doi.org/10.1145/3510454.3522684`.
- Langer, M., Schlicker, N., & Baum, K. (2024). Effective human oversight of AI systems: A signal detection perspective. *Minds and Machines*, 34. DOI: `https://doi.org/10.1007/s11023-024-09701-0`.
- Li, X., Li, Y., Li, Z., Zhu, H., & Li, M. (2026). Guided reflection as a cognitive forcing function in XAI-assisted decision making. *Proc. ACM CHI 2026*. DOI: `https://doi.org/10.1145/3772318.3790632`.
- McGrath, M., et al. (2025). Short Trust in Automated Systems Scale (S-TIAS). *Frontiers in Artificial Intelligence*. DOI: `https://doi.org/10.3389/frai.2025.1582880`.
- Mozannar, H., Bansal, G., Fourney, A., & Horvitz, E. (2024). Reading between the lines: Modeling user behavior and costs in AI-assisted programming. *Proc. ACM CHI 2024*. DOI: `https://doi.org/10.1145/3613904.3642936`.
- Paas, F. G. W. C. (1992). Training strategies for attaining transfer of problem-solving skill in statistics: A cognitive-load approach. *Journal of Educational Psychology*, 84(4), 429–434. DOI: `https://doi.org/10.1037/0022-0663.84.4.429`.
- Perry, N., Srivastava, M., Kumar, D., & Boneh, D. (2023). Do users write more insecure code with AI assistants? *Proc. ACM CCS 2023*, 2785–2799. DOI: `https://doi.org/10.1145/3576915.3623157`.
- Plonka, L., Sharp, H., van der Linden, J., & Dittrich, Y. (2015). Knowledge transfer in pair programming: An in-depth analysis. *International Journal of Human-Computer Studies (IJHCS)*, 73, 66–78. DOI: `https://doi.org/10.1016/j.ijhcs.2014.09.001`.
- Sadowski, C., Söderberg, E., Church, L., Sipko, M., & Bacchelli, A. (2018). Modern code review: A case study at Google. *Proc. ACM/IEEE ICSE-SEIP 2018*, 181–190. DOI: `https://doi.org/10.1145/3183519.3183525`.
- Schoeffer, J., Jakubik, J., Vössing, M., Kühl, N., & Satzger, G. (2025). AI reliance and decision quality: Fundamentals, interdependence, and the effects of interventions. *Journal of Artificial Intelligence Research (JAIR)*, 82, 471–501. DOI: `https://doi.org/10.1613/jair.1.15873`.
- Shen, J. H., & Tamkin, A. (2026). How AI impacts skill formation. *arXiv:2601.20245* (`https://arxiv.org/abs/2601.20245`).
- Sommet, N., Weissman, D. L., Cheutin, N., & Elliot, A. J. (2023). How many participants do I need to test an interaction? *Advances in Methods and Practices in Psychological Science (AMPPS)*. DOI: `https://doi.org/10.1177/25152459231178728`.
- Sovrano, F., Dominici, G., & Bacchelli, A. (2026). Mitigating cognitive biases in AI-assisted software engineering. *Proc. ACM FSE 2026*. DOI: `https://doi.org/10.1145/3715740`.
- Ye, J., et al. (2026). Coding with the enemy: Evaluating developer detection of autonomous agent sabotage. *Proc. NeurIPS 2026*, *arXiv:2606.05647* (`https://arxiv.org/abs/2606.05647`).
- Yu, H., et al. (2026). Habituation at the gate: Longitudinal analysis of human review on AI agent pull requests. *arXiv:2606.22721* (`https://arxiv.org/abs/2606.22721`).
- Zhu, H., Lu, Y., Ding, X., Lee, J., Wang, D., & Chen, Y. (2026). Designing meaningful human oversight in AI: The solve–verify asymmetry. *AI and Ethics*. DOI: `https://doi.org/10.1007/s43681-026-01147-7`.
