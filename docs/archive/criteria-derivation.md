# How the intervention criteria (C1–C3) were derived

**Status:** 18 October 2026. Companion to §2.2 of [`expose.md`](expose.md).

**One-sentence answer.** The criteria are a *synthesis*: I took the supervisor's request for "when and why" criteria grounded in pair programming, extracted what eight primary sources actually say about moments where a second person (or a break in the work) matters, grouped that evidence into three mechanisms, turned each mechanism into an observable decision test, and then tested the tests on the study corpus and on unscripted agent traces. The first formulation (iteration 1) was informal; the documented, repeatable procedure below starts at iteration 2 and finishes with an independent-rater study that has **not been run yet**.

---

## 1. Method

The procedure adapts the **taxonomy development method of Nickerson, Varshney & Muntermann (2013)**, DOI `10.1057/ejis.2012.26`, which builds a classification by alternating two kinds of iteration until stated ending conditions hold:

- *conceptual-to-empirical*: derive candidate dimensions from theory, then check them against objects;
- *empirical-to-conceptual*: take objects, find what distinguishes them, then revise the dimensions.

Agreement between raters is measured with **Cohen's κ** (Cohen, 1960, DOI `10.1177/001316446002000104`) and read with the conventional bands of Landis & Koch (1977, DOI `10.2307/2529310`).

**Meta-characteristic** (the one question every criterion must answer): *which observable properties of an agent's subtask make a human check worthwhile before the agent continues?*

**Design requirements for any criterion** (fixed before judging candidates):

| # | Requirement | Reason |
|---|---|---|
| R1 | Decidable from artifacts a reviewer can see: the user story, the subtask's diff, the visible tests. | Two raters must be able to apply it. |
| R2 | Decidable at the time of the subtask, without looking at later subtasks. | A live gate cannot see the future. (Exception: C2 asks about files that *still have to be written*; see §6.) |
| R3 | Independent of whether the code is correct. | The criterion is about where to pause, not about finding the bug. |
| R4 | Motivated by something people do or need when reviewing or pairing, not by tooling convenience. | Otherwise it collapses into "after every file" or "every N lines". |
| R5 | Separates a pause-worthy subtask from routine scaffolding. | The supervisor's "scaffolding step" critique. |

---

## 2. Iterations: what happened and what is planned

| Iteration | Type | Input | Output | Status |
|---|---|---|---|---|
| **1** (15–16 Oct) | conceptual-to-empirical, **informal** | The supervisor meeting (keywords: criteria *wann und warum*, pair programming literature, *wann andere intervenieren*, story level vs implementation detail, understanding) and the literature already collected in `archive/`. | First draft of three criteria (C1 implicit story resolution, C2 foundational lock-in, C3 green-CI divergence) and the six-story corpus with one seeded defect per story. | Done. It was not a documented procedure. The draft attributed the criteria to the pair-programming studies more strongly than those studies support. |
| **2** (18 Oct) | empirical-to-conceptual | Full texts of fourteen sources (§3); two more (Fagan 1976, Parnas & Weiss) are not yet read. | Evidence matrix; criteria re-stated as a synthesis; C3 recast from "expectation divergence" (which leans on the defect) to "test blind spot" (R3); C2 motivation corrected after Bryant et al. turned out to concern both partners. | Done. |
| **3** (18 Oct) | empirical | The 24 corpus subtasks (6 stories × 4 subtasks) and 22 subtasks from 12 agent traces (Claude Haiku). A fast decision model (Jev) was asked yes/no questions derived from the decision tests (`docs/jev-benchmark/README.md`). | (a) A model's answers to the C2 questions were high for all six milestones, and on my reading all six Subtask-2 units are core stateful or branching logic, so C1/C2/C3 do **not** look separable as subtask properties: the labels in the corpus name the seeded defect type. (b) The same model rated the corpus's wiring subtask (Subtask 3) high on C1 (0.78–0.80), so that subtask may also satisfy C1. (c) On traces, a mechanical version of C2 ("a unit that later commits import") labels 5 of 22 subtasks. | Done. This changed how the criteria are used: as a binary "pause here?" with a tie-break rule, not as a three-way classification. |
| **3b** (19 Oct) | design | The corpus was restructured so that the milestone is no longer always Subtask 2. | Milestone at subtask 1 (US4, US6), subtask 2 (US1, US3) and subtask 3 (US2, US5). The rater sheet was regenerated (`scripts/make-rater-sheet.py`). | Done. The iteration-3 results refer to the earlier layout. |
| **4** | empirical, **independent** | Two raters label every corpus subtask and every trace subtask against the decision tests, blind to the intended milestone and to any model output. | κ per criterion and for the binary decision; list of disagreements. | **Planned.** Rater sheet: `docs/rater-sheet-corpus.csv` (rows shuffled; the key file is only for analysis); traces: `docs/jev-benchmark/labeling-sheet.csv`. |
| **5** | conceptual-to-empirical | Disagreements from iteration 4. | Revised wording, re-labelling of a subset. Repeat until the ending conditions hold. | Planned. |
| **6** | freeze | Final wording. | Criteria and labels fixed and time-stamped **before** participant data collection. | Planned. |

---

## 3. Evidence matrix (fourteen sources, read in full on 18 October 2026)

"Strength" is my judgement of how directly the source supports a *pause criterion for reviewing an agent*. None supports one directly.

| Source (section) | What it says | Mechanism | Supports | Strength |
|---|---|---|---|---|
| Zieris & Prechelt 2016, ICSE '16 Companion (§1, §4.2.1) | Patterns RESYNC and PARALLEL: equal grasp does not guarantee common understanding; extra synchronisation is needed. In the illustrated session the ticket stated no requirements and the pair discussed the intended behaviour. | Understanding has to be actively aligned; unspecified requirements get resolved in conversation. | C1 | Weak: one illustrated session, qualitative. |
| Mu et al. 2024, FSE (abstract, §1) | LLMs "directly generate programs" from unclear requirements instead of asking. | An agent silently resolves ambiguity. | C1 | Moderate for model behaviour; function-level benchmarks; the premise sentence is an assertion citing other work. |
| Yang et al. 2026, ASE (abstract) | 1,304 function-level tasks: ambiguity degrades all models; divergent implementations; models cannot identify or resolve ambiguity autonomously. | Same. | C1 | Moderate for model behaviour; not ticket-level. |
| Bryant et al. 2008, IJHCS (§6.3) | Both partners speak most about blocks of the program ("abstract chunks of code"); no difference between driver and navigator; success may come from this intermediate-level talk (stated as a hypothesis). | The natural unit of shared talk is a block of code, not a line and not the whole system. | C2 (granularity) | Weak: hypothesis, opportunistic XP sample, transcripts only. |
| Iqbal & Bailey 2006, CHI (intro, conclusion) | Interrupting at subtask boundaries gives lower cost of interruption (resumption lag) than between boundaries; low-workload boundaries are cheaper. | A finished subtask is a cheaper moment to interrupt. | C2 (timing) | Weak: lab tasks, not programming. |
| Adamczyk & Bailey 2004, CHI (results, discussion) | Moments between coarse breakpoints: lower annoyance, frustration, effort; no effect on task time or resumption lag. | Same. | C2 (timing) | Weak: 16 participants, office-style tasks, affect only. |
| Dhanorkar et al. 2026, FAccT (§4.2, Heuristic 2) | Developers treat "passing test results" as a guarantee of correctness; heuristics prioritise "efficiency over perfection". | Green tests create unwarranted confidence. | C3 | Moderate: 17 interviews. |
| Dhanorkar et al. 2026 (§4.1, co-planning) | Developers split work into small chunks so each is testable and reviewable; they often skip real-time monitoring. | Practitioners already shrink review units themselves. | Context for all; counter-evidence to the "8,000-line batch" premise | Moderate: 17 interviews. |
| Tao et al. 2012, FSE (abstract, §1) | Survey and interviews at Microsoft: engineers seek a change's quality (correctness, completeness, consistency), its risk to other components, and "most importantly the rationale"; composite changes are valuable to decompose into sub-changes that each address one development issue, but this lacks tool support. | A reviewer needs the rationale of a change and a cohesive unit to look at. | C1 (rationale); C2 (cohesive unit) | Moderate: large industrial survey; about changes in general, not agent output. |
| Rigby & Bird 2013, FSE (§§ on change size, conclusion) | Contemporary review: regular, quick, just before commit, on small independent changes (median 25 to 44 lines in Apache, Linux, Android and AMD and 78 in Chrome; larger but unspecified in Bing, Office and SQL; 263 non-comment lines in a traditional Lucent inspection). | What practitioners actually review. | C2 (unit size); scale of the corpus | Descriptive only: no claim that small changes are reviewed *better*. |
| Fucci et al. 2017, TSE (abstract, §4.4) | 82 data points from 39 professionals: finer-grained (shorter) and more uniform test-code cycles were positively associated with quality and productivity; test-first ordering had no important influence. | Working in short, uniform cycles. | C2 (subtask granularity) | Moderate for TDD; says nothing about reviewing an agent. |
| Inozemtseva & Holmes 2014, ICSE (abstract) | Across 31,000 generated suites for five Java systems: low to moderate correlation between coverage and effectiveness once suite size is controlled; stronger coverage forms add no insight; coverage is useful for finding under-tested parts but is not a good quality target. | Green or well-covered tests do not show that a suite is adequate. | C3 | Moderate to strong; Java systems, generated suites. |
| Jia & Harman 2011, TSE (introduction) | Mutation testing provides the "mutation adequacy score" to measure how well a test set detects faults. | A standard way to check whether tests would notice a plausible change. | C3 (optional check) | Survey; a measurement tool, not an effect. |
| Herzig & Zeller 2013, MSR (abstract) | Up to 15% of bug fixes in five projects are tangled changes, which add noise to analyses of version histories. | — | **Not used.** It concerns mined-data quality; the paper states tangled changes do not cause trouble in development itself. | — |
| Plonka et al. 2015, IJHCS | Six teaching strategies in expert–novice pairs. | Knowledge transfer in pairs. | Background only | Contains no account of when to intervene. |

---

## 4. From evidence to candidate criteria

Candidates considered, and what happened to them:

| Candidate | Source of the idea | Decision |
|---|---|---|
| Pause when the agent resolves a case the story leaves open | Tao (rationale); Zieris & Prechelt; Mu; Yang | **Kept → C1** |
| Pause when a core unit is finished and nothing is built on it yet | Tao (decompose into sub-changes per development issue); Rigby & Bird (small independent changes); Fucci (short, uniform cycles); Bryant (unit of talk); Iqbal & Bailey / Adamczyk & Bailey (boundary timing) | **Kept → C2**, now with a broader basis. "Check it *before* others build on it" is still my argument, not a finding. Fagan (1976) and Parnas & Weiss on design review are not yet read. |
| Pause when tests are green but input cases are untested | Dhanorkar Heuristic 2; Inozemtseva & Holmes; Jia & Harman | **Kept → C3**, reworded from "expectation divergence" to "test blind spot" to remove the dependence on whether the code is right. |
| Pause after every file write / every N lines | Common tool behaviour | **Rejected** (R4): no human-factors motivation; this is the "arbitrary" extreme. |
| Pause when the agent is uncertain | Monitor literature | **Not used**: needs the agent's internals and is not a pair-programming analogue (R1). |
| Pause on risky commands | Permission prompts | **Out of scope**: covers safety, not understanding. |

---

## 5. Decision tests

Verbatim in `expose.md` §2.2. In short: **C1** the code treats a failure, empty or boundary input differently, the story is silent on it, and more than one outcome is reasonable. **C2** the subtask defines a unit that owns state or a rule, at least two files still to be written must call it, and no downstream code exists yet. **C3** the code distinguishes at least three kinds of input and the visible tests exercise fewer. **Non-trigger:** no conditional, arithmetic or state change on domain data, or only tests. Tie-break: first applicable criterion, in the order C1, C2, C3.

---

## 6. Validation protocol (iteration 4)

1. **Raters.** The author and one independent rater (ideally not involved in building the corpus). Both read the criteria text and the decision tests; neither is told which subtask is the intended milestone, and neither sees any model output.
2. **Items.** 24 corpus subtasks (Correct variant; the variants differ only in the milestone subtask) and 22 trace subtasks; more traces can be added to reach a larger sample.
3. **Procedure.** For each subtask: answer the three conditions of each criterion (y/n), apply the tie-break, then record a binary "pause here? (y/n)". C2 condition (b) concerns files still to be written; for corpus subtasks the rater is given the story's planned file list, for traces the later commits.
4. **Statistics.** Cohen's κ for the binary decision and for each criterion; percent agreement; a list of disagreeing items with reasons. Interpretation with Landis & Koch bands.
5. **Success conditions (ending conditions).**
   - *Objective:* every item is classified; no criterion was added or merged in the last iteration; each criterion has at least one positive item in the data; the tie-break yields exactly one tag per subtask; κ for the binary decision ≥ 0.61 ("substantial").
   - *Subjective (Nickerson et al.):* the criteria are concise, robust, comprehensive for the corpus, and explanatory.
6. **Check against the design intention.** The corpus is built so that one subtask per story is the milestone (subtask 1 in two stories, subtask 2 in two, subtask 3 in two, so the position is no cue). The rater study tests whether independent raters, applying only the decision tests, agree with that intention. Expected trouble spot: Subtask 3 may satisfy C1 (it contains branching such as error mapping).
7. **Freeze** the wording and the labels, with a date, before participant data are collected.

---

## 7. Threats and honest limits

- **Authorship bias.** I built the corpus and wrote the criteria. The rater study is the remedy, and it has not been done.
- **Thin literature.** No source studies pausing an agent. The pair-programming and interruption studies describe talk and costs, not triggers. Applying them to subtasks is an argument.
- **Domain transfer.** The interruption studies used office-style tasks; the ambiguity studies used function-level benchmarks.
- **Small corpus.** Six stories and 22 trace subtasks from one agent. Not enough to claim completeness.
- **Informal start.** Iteration 1 was not a documented procedure. The method above documents what was done afterwards and what remains.

---

## 8. Short answer for the supervisor meeting

> "Ich bin so vorgegangen: Aus deinem Auftrag habe ich fünf Anforderungen an Kriterien festgelegt. Dann habe ich acht Quellen im Volltext ausgewertet und festgehalten, was sie über Momente sagen, in denen Abgleich oder Unterbrechung sinnvoll ist. Daraus ergaben sich drei Mechanismen: ungeklärte Fälle, abgeschlossene Kerneinheiten und blinde Flecken bei grünen Tests. Jeder Mechanismus hat einen Entscheidungstest. Ich habe die Tests am Korpus und an echten Agenten-Läufen angewendet und gesehen, dass sich die drei Typen als Schritt-Eigenschaft nicht trennen lassen; deshalb nutze ich sie als binäre Entscheidung. Als Nächstes bewerten zwei unabhängige Rater alle Schritte, und ich berichte κ. Erst danach friere ich die Kriterien ein."

---

## References for this document

- Cohen, J. (1960). A coefficient of agreement for nominal scales. *Educational and Psychological Measurement*, 20(1). DOI `10.1177/001316446002000104`.
- Landis, J. R., & Koch, G. G. (1977). The measurement of observer agreement for categorical data. *Biometrics*, 33(1). DOI `10.2307/2529310`.
- Nickerson, R. C., Varshney, U., & Muntermann, J. (2013). A method for taxonomy development and its application in information systems. *European Journal of Information Systems*, 22(3). DOI `10.1057/ejis.2012.26`.
- The eight sources in §3 are listed with DOIs in [`literature.md`](literature.md).
