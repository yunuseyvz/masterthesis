# Engagement interventions for AI-generated code and AI-assisted decisions

Research date: 20.11.2026. Scope: 2021–2026. Thesis context: a blocking pause in a coding agent (accept/reject, then one behaviour question, then confirm or reverse). The thesis varies *where* the pause comes, not *what* it is.

**Verification status.** "Full text" means I read the document itself. "Abstract/snippet" means I only saw the abstract or search excerpts; the numbers below are as stated there and need checking before they are cited. Items marked *already known* are on the list in the prompt; I only add new detail. Items marked *in literature.md* are already in `docs/archive/literature.md`, not re-checked here.

Ranking key: **high** = directly tests engagement or timing for code or AI output with measured outcomes; **medium** = adjacent domain or weaker design; **low** = background or non-empirical.

---

## Cognitive forcing and engagement interventions: what works and what does not

### Takeaway
Blocking and active-task interventions reduce over-reliance or raise engagement in most studies. The gains on *understanding* of AI-generated code are small or not significant. Gentle friction (slow accept) had no measurable effect in the one controlled code study I found. The strongest code-specific evidence is still Kazemitabaar et al. 2025, which is underpowered and was run with novices.

### Cited Findings
- **Buçinca, Malaya & Gajos 2021** (*already known*): N = 199, three cognitive forcing designs cut over-reliance vs. simple XAI; the designs participants liked least were the most effective; benefits concentrated in high need-for-cognition people — [Source](https://www.eecs.harvard.edu/~kgajos/papers/2021/bucinca2021trust.shtml) (abstract). [high]
- **Ghosh, Sarkar, Lindley & Poelitz 2026** (*already known*, arXiv:2601.18033): N = 214, four conditions on *AI execution plans* (writing tasks): Assumptions CFF had the highest feedback accuracy and significantly lower over-reliance than WhatIf (χ² = 7.20, p_BH = 0.04 and χ² = 10.25, p_BH = 0.008); Assumptions added no cognitive load; combining two CFFs ("Both") was not better and may be harmful; users *perceived* WhatIf as more helpful — [Source](https://arxiv.org/html/2601.18033) (abstract and results snippet). The effect is on a writing plan, not on code. [high]
- **Kazemitabaar et al. 2025** (*already known*, IUI, doi:10.1145/3708359.3712104): Study 1 (between, N = 82): no technique beat baseline significantly; Lead-and-Reveal highest (58.3 vs 31.5 baseline, p = .058, Bonferroni α = .007); Solve-Code-Puzzle and Trace-and-Predict 54.1 each; the authors call it underpowered (153 needed for 90 % power). Study 2 (within, N = 42, 30 in the Friedman test): no performance difference (p = .150). Trace-and-Predict had the highest task load (TLX 67.1 vs 58.9 baseline) and 2.66× completion time; Lead-and-Reveal 1.82× — [Source](https://doi.org/10.1145/3708359.3712104) (full text read earlier, see `docs/talk/antrittsvortrag/intervention-landscape.md`). [high]
- **Catalan et al. 2026** (CHI 2026 workshop, arXiv:2603.14225; full text read, see below): engagement declined over the task. Participants were careful while planning, disengaged during the agent's execution, and checked only the output at the end. [medium: formative, n = 4]
- **Developer proactive-AI field study 2026** (IUI 2026, doi:10.1145/3742413.3789148; abstract only, ACM page returned 403): 15 developers, five days, 229 interventions. Interventions at workflow boundaries (post-commit) got 52 % engagement; mid-task interventions were dismissed 62 % of the time. Well-timed suggestions took 45.4 s to interpret vs 101.4 s for reactive ones. This is the only field evidence I found on *when* in the workflow an intervention lands. [high for timing; the outcome is engagement, not understanding]
- **"(Im)Paired Programming" 2026** (arXiv:2607.26375; abstract/snippet only): 54 students, coding agent that edits user code vs. chatbot. Agents helped task completion but harmed comprehension and the later extension task. Low-effort interaction (copy-paste prompts, auto-accepted edits) was linked to lower comprehension. [high for the agent setting; student sample]
- **Mastery-Aware Pipeline 2026** (SBES 2026; abstract/snippet only): N = 19 quasi-experiment. Two structured checks, a formal spec gate before the agent may code and a Socratic review after, gave a mastery score of 73 vs 62 (about 70 % vs 32 % correct solution explanations). Small, quasi-experimental, students and professionals. [medium]
- **"Faster but Not Wiser" (Copilot brownfield comprehension)** (arXiv:2511.02922; abstract and snippets only): N = 15 within-subjects. Copilot improved task performance but not comprehension (p = .59). Participants with higher comprehension did more verification loops (write-then-view transitions 4.7× more often, p = .001). The category-level correlations did not survive multiple-comparison correction. [medium]
- **Comprehension Gap 2026** (arXiv:2611.24216, posted 18 Nov 2026; abstract only): N = 35 crossover. Participants found 11 % fewer introduced mutations in generated code than in self-written code and needed 20 % longer. Those with high LLM reliance and low task engagement understood less. [medium; very recent, not peer-reviewed]
- **Friction study: CoFriction 2025/26** (Aalborg master's thesis, vbn.aau.dk; not peer-reviewed): N = 38 students, Copilot vs. slow accept + inline AI feedback + highlighting of pasted code. No significant differences on cognitive load, confidence, frustration, tasks completed or compilability. Participants found slow accept frustrating; inline feedback and highlights were mostly ignored. [Source](https://vbn.aau.dk/ws/files/784924368/Thesis.pdf) [medium–low as evidence; high as a warning]
- **Bo, Wan & Anderson 2025** (CHI 2025, doi:10.1145/3706598.3714097; abstract and results snippets): N = 400 online. Three reliance interventions (reliance disclaimer, uncertainty highlighting, implicit answer, which adds friction by hiding the answer). All reduced over-reliance in some configurations, but none reliably improved *appropriate* reliance. Friction-type designs increased under-reliance. Perceived helpfulness fell under all three. [high]
- **Eye-tracking of Copilot suggestions** (ICSE 2026 preprint, eye-for-ai.hasel.dev; abstract/snippet only): N = 33. About half the suggestions were never looked at; about 77 % of looked-at suggestions were rejected; each rejection cost about 3 s of looking and about 51 micro-interruptions per 45-min session. [medium; cost evidence]
- **Tanasa 2026 systematic review** (Bachelor thesis, RUG; PRISMA, 49 of 204 records): see Q4.
- **Yang et al. 2026 (Orchid) and Vasconcelos et al. 2023**: not checked this session.

### Inferences
- The evidence says what kind of task matters more than how strong the block is. Active tasks (answer, decide, predict) beat passive views; plan-level questions about assumptions beat generic "what-if" prompts (Ghosh). This supports a behaviour question over a diff.
- Blocking works on over-reliance but not automatically on understanding. Kazemitabaar, Ghosh and the Copilot studies all show a gap between engagement and learning. The thesis should therefore measure a *behaviour* outcome on the code, not just whether the pause was passed.
- The timing evidence is indirect. The IUI 2026 study shows boundary timing gets more engagement, but it measures receptivity to a suggestion, not understanding after a block. Catalan et al. suggest engagement is highest during planning and lowest during execution. Both point toward pausing at a boundary, but neither tests the pause position.

### Gaps
- No controlled study I found varies *where in an agent's run* a blocking pause lands and measures understanding. Kazemitabaar's "engagement timing" (before/after reveal) and the IUI 2026 boundary-vs-mid-task split are the nearest.
- Nearly all forcing-function studies use chat or writing tasks, not agent-generated code, and most use students.
- The IUI 2026 study is only available as an abstract (ACM returned 403); I could not read its method.

---

## Question type and abstraction level: line-level vs behaviour vs explanation vs test vs assumption

### Takeaway
Only a few studies compare question types directly. Kazemitabaar 2025 is the closest: trace-and-predict behaviour questions were answered at 76.3 % vs 58.0 % for lead-and-reveal questions (paired t-test, p < .001), which says behaviour questions are answerable at a usable level. Ghosh 2026 shows that assumption-type questions beat hypothesis-type ones. Line-level questions were too easy for the population Kazemitabaar studied, so they moved to blocks plus explanations.

### Cited Findings
- **Kazemitabaar et al. 2025** (*already known*): Trace-and-Predict asked an average of 8.3 tracing questions (predict values) and 3.7 short explanation questions; learners scored 76.3 % (SD 14.2) on these, vs 58.0 % (SD 12.4) on Lead-and-Reveal questions (paired t-test, p < .001). Line-level tracing was "too easy", so V2 asked about blocks and added explanations — [Source](https://doi.org/10.1145/3708359.3712104) (results snippet). [high]
- **Ghosh et al. 2026** (*already known*): assumption-type CFF beat hypothesis-type CFF on over-reliance; the authors state that combining CFFs was not better — [Source](https://arxiv.org/html/2601.18033). [high, for plans]
- **Danry et al. 2023** (*already known*): AI that *asks* a question ("does it follow that…?") improved discernment more than causal explanations — [Source](https://doi.org/10.1145/3544548.3580672) (not re-read). [high]
- **Catalan et al. 2026** (arXiv:2603.14225, full text read): Bloom-level survey after a single Cline task (n = 4). Recall questions were answered poorly: none of the four gave the correct function count (Table 2). Half could summarise the first function. Participants "only recalled, understood, analysed and evaluated the happy path" — [Source](https://arxiv.org/abs/2603.14225). [medium: n = 4]
- **Comprehension Gap 2026** (arXiv:2611.24216, abstract): comprehension measured by finding introduced mutations, which is a behaviour-level task. Result: 11 % fewer found, 20 % slower, for generated code — [Source](https://arxiv.org/html/2611.24216). [medium]
- **"Faster but Not Wiser" 2025/26** (arXiv:2511.02922, snippets): comprehension questions were grouped by category. The category-level correlation with performance was positive for "what and where to modify" (ρ = .50) and negative for "explain how the code works" and "predict the effects of a change" (ρ = −.57), but neither survived correction. — [Source](https://arxiv.org/html/2511.02922). [medium–low: exploratory]
- **Shen & Tamkin 2026** (*already known*): the quiz was measured right after the task; debugging questions showed the largest gap — [Source](https://arxiv.org/abs/2601.20245) (not re-read this session).

### Inferences
- Behaviour questions ("what does it return for X?") are answerable enough to use as a gate: about three quarters correct in Kazemitabaar's trace condition. But that population was novices on algorithms, so the rate may not carry over to professionals.
- The "predict the effect" category did worst in the Copilot study, which points toward asking about behaviour of the changed code, not about the change's rationale. This is exploratory and I would not cite it as a result.
- Question difficulty must be matched to the code. If a question can be answered by reading one line, it measures nothing.

### Gaps
- No study I found varies abstraction level (line / behaviour / explanation / test / assumption) *within the same code and population*. Kazemitabaar varies the technique, not the level.
- No study tests a pass/fail gate that asks about *behaviour of an agent's changed code* before acceptance.

---

## Cost of blocking and engagement interventions: time, load, annoyance, habituation, willingness to use

### Takeaway
Costs are consistent across studies. Stronger, more active interventions take longer, feel more demanding and are liked less, and people work around them. Habituation is the main concern for repeated pauses, but I found no code-specific habituation study. The clearest number is Kazemitabaar's time cost: 1.8× to 2.7× the baseline completion time.

### Cited Findings
- **Kazemitabaar et al. 2025** (*already known*): trace-and-predict was about 2.7× slower, and 15 of 42 participants were reluctant to use it — [Source](https://doi.org/10.1145/3708359.3712104) (full text read earlier). [high]
- **Buçinca et al. 2021** (*already known*): the most effective forcing designs were rated least favourably — [Source](https://www.eecs.harvard.edu/~kgajos/papers/2021/bucinca2021trust.shtml). [high]
- **Bo et al. 2025** (CHI, N = 400): perceived helpfulness fell under all three interventions; the friction designs produced under-reliance. — [Source](https://dl.acm.org/doi/full/10.1145/3706598.3714097). [high]
- **CoFriction 2025/26** (master's thesis): slow accept was described as frustrating; some participants valued it for learning, but overall there was no significant effect on load or frustration in a short time-pressured task — [Source](https://vbn.aau.dk/ws/files/784924368/Thesis.pdf). [medium–low]
- **Eye-tracking 2026** (ICSE preprint): each rejected suggestion took about 3 s, double the time spent accepting. Rejected suggestions were followed by more deletions than usual — [Source](https://eye-for-ai.hasel.dev/download/an-eye-for-ai-icse2026-preprint.pdf). [medium]
- **Powers et al. 2018** (*already known*, JAMIA systematic review, clinical hard-stop alerts): workarounds, more alerts and delayed care were the main unintended effects; good user experience required heavy user involvement and iterative design. Source as in `docs/talk/antrittsvortrag/intervention-landscape.md`; DOI not re-checked this session. [high, domain analogue]
- **Egelman, Cranor & Hong 2008** (*already known*, CHI): active warnings heeded by 79 %, passive by one participant; people who had seen similar warnings ignored them more. Source as in `intervention-landscape.md`; DOI not re-checked this session. [high, domain analogue]
- **Action approval survey 2026** (arXiv:2611.10058, N = 203): 61 % of developers who carefully review most generated code still approved at least one agent action without close review; supervising agents remained mentally demanding — [Source](https://arxiv.org/abs/2611.10058). [medium]
- **Offloading Score 2026** (arXiv:2605.29392, N = 40): time pressure increased reliance (+43 %, p = .018). The measure detected it; self-report and usage did not. — [Source](https://arxiv.org/html/2605.29392). [medium: measurement, relevant to cost-of-reliance]

### Inferences
- A pause that takes a minute is affordable if it is rare and targeted. The study design should record the time added by the pause, because the time cost of a hard stop is the main reason developers refuse it.
- Habituation is plausible but unmeasured for code. The thesis should expect it with repeated pauses and keep the number of pauses low.
- The developer-acceptance data suggest the practical question is less whether people will tolerate one block and more whether they will tolerate a block at the same place every time.

### Gaps
- No code study measures habituation to repeated blocking pauses.
- Time-cost data are mostly from students, short tasks and chat tools, not from agent workflows.

---

## Meta-analyses and systematic reviews, 2023–2026

### Takeaway
I found no meta-analysis of cognitive forcing functions for AI-generated code in 2023–2026. The nearest are a 2026 bachelor-thesis systematic review on appropriate-reliance interventions and a general meta-analysis on algorithm aversion. Both point to the same finding as the primary studies: timing and structure of the interaction matter more than improving the AI.

### Cited Findings
- **Tanasa 2026** (bachelor thesis, RUG, supervised by J. Schoeffer; PRISMA, Scopus search 25 Mar 2026, 49 of 204 records; not peer-reviewed): slowdown (time must pass before AI advice is shown) and pre-made decisions (decide before AI is consulted) were among the most promising intervention classes. The reliability disclaimer had the most positive evidence. Querying and cognitively easing the task had little evidence — [Source](https://fse.studenttheses.ub.rug.nl/37460/1/MateiTanasaBachelorThesis.pdf). [medium: systematic method, weak venue]
- **Bo et al. 2025** (CHI, see above): benchmarks three interventions; they reduce over-reliance but not reliably improve appropriate reliance — [Source](https://dl.acm.org/doi/full/10.1145/3706598.3714097). [high]
- **Schoeffer et al. 2025** (*in literature.md*, JAIR 82, doi:10.1613/jair.1.15873): conceptual framework; argues that accuracy and reliance must both be measured because an intervention can raise accuracy only by raising adherence — [Source](https://eref.uni-bayreuth.de/id/eprint/89886/) (metadata snippet). [high, conceptual]
- **"Interaction Context is Key" 2025** (HICSS, meta-analysis of 32 studies, 89 effect sizes): interventions against algorithm aversion overall g = 0.23; context-targeted interventions g = 0.55; heterogeneity I² = 88 % — [Source](https://doi.org/10.24251/hicss.2025.071). Algorithm aversion, not over-reliance; [low–medium].
- **Bo et al.** and others also note that most reliance studies use inconsistent metrics, and many use accuracy as a proxy for appropriate reliance — [Source](https://dl.acm.org/doi/full/10.1145/3706598.3714097) and [Source](https://fse.studenttheses.ub.rug.nl/37460/1/MateiTanasaBachelorThesis.pdf). [high for the methodological point]
- An MDPI review (2025) of 84 studies found simple visual highlights more effective than complex presentation at preventing over-reliance — [Source](https://www.mdpi.com/2227-9709/12/4/135) (abstract only; not read). [low–medium]
- A systematic review on metacognitive engagement in human-AI interaction exists (doi:10.17605/osf.io/rqg8c, 2025) — found, not read. [unknown]

### Inferences
- A forcing-function meta-analysis would be the next useful study, but it does not exist yet for code. Tanasa's taxonomy is a usable starting point for classifying the thesis's intervention, with the caveat that its quality is that of a bachelor thesis.
- The consistent message is that the design of the interaction (slowdown, decide-first, targeted queries) beats making the AI better. This supports treating the pause position as a design variable.

### Gaps
- No 2023–2026 peer-reviewed systematic review specifically on cognitive forcing for AI-generated code.
- Metrics across reliance studies are inconsistent, so effect sizes cannot be pooled without a common definition. The thesis should report appropriate reliance (ARR-type), not only over-reliance.

---

## Ranked list of new findings (this session)

| Rank | Finding | Why it matters for the thesis |
|---|---|---|
| high | Bo et al. 2025, CHI (N = 400), doi:10.1145/3706598.3714097 | Friction reduces over-reliance but not appropriate reliance; cost in perceived helpfulness |
| high | Developer proactive-AI field study 2026, IUI, doi:10.1145/3742413.3789148 | Only field timing data: workflow boundaries vs mid-task (abstract only) |
| high | "(Im)Paired Programming" 2026, arXiv:2607.26375 | Agent-specific: auto-accept and copy-paste linked to lower comprehension (abstract only) |
| high | Catalan et al. 2026, arXiv:2603.14225 (full text) | Engagement falls across the agent task; planning is where people engage most (n = 4) |
| medium | Mastery-Aware Pipeline 2026, SBES | Gate before and check after; higher understanding, small n |
| medium | Comprehension Gap 2026, arXiv:2611.24216 | Behaviour-type task (find mutations) measures generated-code understanding |
| medium | "Faster but Not Wiser" 2026, arXiv:2511.02922 | Verification loops predict comprehension (abstract only) |
| medium | Eye-tracking Copilot, ICSE 2026 | Hidden cost of each rejected suggestion |
| medium | Tanasa 2026 systematic review (bachelor thesis) | Slowdown and decide-first are the promising classes; weak venue |
| medium | Action-approval survey 2026, arXiv:2611.10058 | Approval without review even among careful reviewers |
| low–medium | CoFriction thesis 2025/26 | Friction null in a short time-pressured task; a warning, not evidence against |
| low–medium | HICSS 2025 meta-analysis on algorithm aversion | Adjacent domain |

Not used / not checked in this session: Adamczyk & Bailey 2004, Iqbal & Bailey 2006, Park et al. 2019 (slow algorithm, cited in Catalan), Kuang et al. CHI 2024 (proactive dialogue and timing; cited in Catalan, not located), Lambe et al. 2016 (dual-process interventions, cited in Catalan). Kuang et al. 2024 is the one to check next: its title names *timing* directly.

---

## Full-text reads (2–3 new papers)

Only one new paper was read in full: **Catalan et al. 2026, arXiv:2603.14225**.
- Design: formative study, CHI 2026 workshop "Tools for Thought"; four software engineers (Samsung R&D Institute Philippines, plus York University); one code-generation task with Cline (Excel dashboard script); self-report survey after the task, structured by Bloom's taxonomy (recall, understand, analyse, evaluate).
- Findings: engagement fell over three phases (planning high; execution low, "I'm not reading all of that"; evaluation minimal, mostly output-only, "it worked"). Participants checked the happy path. Only half could summarise the first function, and none could give the function count.
- Relation to thesis: supports the idea that engagement is not constant over an agent's run. It suggests the planning phase is where people engage most, which argues for placing a pause before execution rather than at the end. Their design section proposes cognitive forcing "during the AI's decision-making", which is close to the thesis's blocking pause. The sample (n = 4) and self-report measures make it formative only.
- Limitations stated by the authors: small sample, one task, self-report, planned follow-ups with eye-tracking.

**Partly read (persisted fetch, not reviewed in full):** arXiv:2511.02922 ("Faster but Not Wiser"). The fetched text was truncated in storage; figures above come from search snippets and the abstract. Read in full before citing.

**Not read in full:** Bo et al. 2025, IUI 2026 proactive study (403 on ACM), Mastery-Aware Pipeline, (Im)Paired Programming, Comprehension Gap 2026, Eye-tracking ICSE 2026, CoFriction thesis, Tanasa thesis. Their numbers above come from abstracts and snippets.

---

## Additional notes

- Human oversight of agentic systems (arXiv:2606.05391, 17 interviews, four forms of oversight, including a heuristic that test results guarantee correctness). It overlaps with Dhanorkar et al. 2026 in `literature.md`. Not read in full. [medium]
- Trust-calibrated code review (arXiv:2606.01969, participatory design, N = 17 + survey N = 43): frames review of multi-file agent changes as trust calibration, a design problem more than a diffing problem. [medium; design, not evaluated]
- GitLab "human checkpoints" blog post: industry guidance to move checkpoints upstream to intent review. Not evidence. [low]
- DevSquad Copilot "comprehension checkpoints" (Microsoft docs): a product pattern with a pre-implementation confirmation and post-implementation questions. Not evaluated. [low]
- Cognitive biases in LLM-assisted development (arXiv:2601.08045, 14 observed + 22 surveyed developers): 48.8 % of programmer actions biased. Observational. [low]
