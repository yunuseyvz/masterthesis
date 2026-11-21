# Gap check: intermediate checkpoints vs. end-of-task review for AI coding agents

Compiled 20 Nov 2026. Scope: controlled studies (lab or online) that manipulate the timing, placement, or granularity of human review or intervention during AI agent or multi-step generation work, 2023–2026. Searches: arXiv API (export.arxiv.org), Crossref, web search, and full or partial reads of the arXiv HTML versions of the three most relevant new papers. ACM DL returned HTTP 403 to fetches, so ACM pages were checked only through search snippets. Semantic Scholar and Google Scholar were not queried directly. This is a targeted search, not a systematic review.

Verdict up front: the gap claim survives in narrow form, but it needs rewording. The closest new hit is Zhou et al. (CHI 2026), which runs the same comparison (confirm-at-end vs. intermediate confirmation points) for agents, with 48 participants. It uses GUI/web agent tasks, not code, and it does not measure understanding or fault detection. The thesis must cite it. See the last section for suggested wording.

---

## Q1. Is there a controlled experiment where timing or placement of human review or intervention during agent work is the manipulated variable?

### Takeaway
Yes, but not for coding agents with an understanding outcome. The closest is Zhou et al. (CHI 2026), who compare confirm-at-end with model-scheduled intermediate confirmations in web/GUI agent tasks (within-subjects, N=48). Only preference and completion time were reported as main outcomes. No study found places a blocking review at a chosen point in a code-generating agent's run and measures understanding or defect detection.

### Cited Findings
- **Zhou, Roy, Gupta, Weitekamp & MacLellan, "When Should Users Check? Modeling Confirmation Frequency in Multi-Step Agentic AI Tasks", CHI 2026 (DOI 10.1145/3772318.3790655; arXiv 2510.05307, v3 revised 7 May 2026).** Formative study with N=8 (45-min sessions, five tasks). Seven of eight disliked confirm-at-end; the study found a recurring Confirmation–Diagnosis–Correction–Redo (CDCR) pattern. A decision-theoretic dynamic-programming model places checkpoints to minimise expected user time, using per-step success probabilities. Verification study: within-subjects N=48 across three domains (hotel booking, Overcooked, document processing), comparing the model's intermediate confirmation with the confirm-at-end baseline. Result: 39 of 48 (81%) preferred intermediate confirmation; mean completion time down 13.54%. Their paper also reports edge cases where participants failed to identify the first error because the agent kept acting after the mistake. — [Source](https://arxiv.org/abs/2510.05307); [DOI](https://doi.org/10.1145/3772318.3790655)
- Same paper, confirm-at-end critique: "Seven out of eight participants expressed their dissatisfaction with the current confirm-at-end strategy." — [Source](https://arxiv.org/html/2510.05307v3)
- **Chen, Zhang, Chen, Xu, Yang, Khalilov, Gebreegziabher, Ye, Xiao, Yao, Li & Li, "Comparing Human Oversight Strategies for Computer-Use Agents", arXiv 2604.04918 (Apr 2026).** Mixed-methods study: within-subjects N=48 in a live web environment, with a follow-up interview study. Four oversight strategies: Risk-Gated, Action Confirmation (approval before each action), Supervisory Co-Execution (plan-level oversight), and a Structurally Enriched strategy. Tasks contain embedded privacy leakage, prompt injection, and dark-pattern scenarios. Abstract reports: plan-based strategies were associated with fewer problematic-action occurrences, but not with equally strong gains in intervention success once actions became visible; no single strategy was uniformly best on subjective measures; trust showed the clearest context dependence. Interviews: intervention depended on whether risky moments "became legible as requiring judgment during execution." — [Source](https://arxiv.org/html/2604.04918v1)
- **Kirmayr, Wennmacher, Huynh & Stappen, "What Are You Doing? Effects of Intermediate Feedback from Agentic LLM In-Car Assistants During Multi-Step Processing", arXiv 2602.15569 (Feb 2026).** Controlled mixed-methods study, N=45, in a car-mockup dual-task setting. Manipulated variable: feedback timing (No Intermediate, silent until final answer, vs. Planning & Results, with intermediate updates). Intermediate feedback improved perceived speed, trust, and UX, and reduced task load. Not code, not review, and no understanding measure. — [Source](https://arxiv.org/html/2602.15569v2)
- **Kumar, Dutta & Gulwani, "Plans Work in Mysterious Ways: Evaluating a Plan Mode for Spreadsheet Agents", arXiv 2607.23670 (Jul 2026).** Within-subjects N=24, Plan Mode (agent presents a plan before execution, user reviews it) vs. a non-planning baseline, in spreadsheets. Reported: similar task outcomes; Plan Mode reduced refinement and improved perceived creativity support and human–machine collaboration. The placement manipulated is one upfront checkpoint, not mid-run or end-of-run. — [Source](https://arxiv.org/abs/2607.23670)
- Kazemitabaar et al. 2024 (see Q2): the manipulated variable is decomposition granularity, not review timing.

### Inferences
- Zhou et al. (2026) are the nearest neighbour to the thesis's BATCH vs. checkpoint comparison. Their baseline is the same as the thesis's BATCH condition. Differences: (a) GUI/web agent, not code; (b) outcomes are preference and time, not understanding or fault detection; (c) checkpoints are placed to minimise expected cost from agent error probabilities, not at the decision points where the agent silently settled a question; (d) confirmation is of state (did the result match?), not a behaviour question about what the code does; (e) whether their confirmation halts execution until the user responds (the thesis's pause is blocking; I did not verify how theirs behaves). None of these differences is listed in the thesis yet.
- Chen et al. (2026) compare different oversight structures, but none uses an end-of-task review baseline. Their finding that intervention depends on whether a moment is "recognizable as requiring judgment" supports the thesis's decision-point idea, but does not test it.
- Kumar et al. (2026) test a single pre-execution checkpoint, so they answer a different timing question (plan before vs. no plan).

### Gaps
- No found study uses a blocking pause after a specific subtask of a code-generating agent and measures prediction of code behaviour (understanding) with code hidden.
- No found study compares checkpoint placement at decision points with placement after an equally sized non-decision subtask.
- Zhou et al. (2026) do not report fault detection or understanding outcomes in the main text I read. I read the abstract, intro, formative findings, and verification-study description, but not the full results tables; check the paper before citing secondary numbers.

---

## Q2. Studies comparing stepwise / incremental / progressive disclosure of AI output with all-at-once review

### Takeaway
Kazemitabaar et al. (2024, UIST) is the main precedent for stepwise decomposition, but it manipulates how the task is decomposed and how much the user steers, not when the user reviews output. Code-review studies on change decomposition show that splitting changes reduces noise but does not improve understanding or defect detection.

### Cited Findings
- **Kazemitabaar, Williams, Drosos, Grossman & Glassman (2024), "Improving Steering and Verification in AI-Assisted Data Analysis with Interactive Task Decomposition", UIST 2024 (DOI 10.1145/3654777.3676345; arXiv 2407.02651).** Two systems: Stepwise (decomposes into step-by-step subgoals, each with editable assumptions and code, until completion) and Phasewise (three editable phases: assumptions, plan, code). Controlled within-subjects experiment, n=18, compared against a conversational baseline. Reported: users had significantly greater control with Stepwise and Phasewise; some preferred the conversational system's simpler flow. — [Source](https://arxiv.org/abs/2407.02651); [ACM DOI](https://doi.org/10.1145/3654777.3676345)
- **di Biase, Bruntink, van Deursen & Bacchelli (2019), "The effects of change decomposition on code review — a controlled experiment", PeerJ Computer Science.** Controlled experiment, 28 developers (professionals and graduate students), pull-based review. Large vs. decomposed change sets. Change decomposition led to fewer wrongly reported issues and more context-seeking; it did not change understanding of the change rationale or the number of defects found. — [Source](https://pmc.ncbi.nlm.nih.gov/articles/PMC7924728/) (already in the archive as a reference)
- **Baum, Schneider & Bacchelli (2019), "Associating working memory capacity and code change ordering with code review performance", Empirical Software Engineering (DOI 10.1007/s10664-018-9676-8).** Confirmatory experiment, N=50, mostly professionals; reviewed one small and two larger changes with seeded defects. Effectiveness was significantly larger for small changes. Association of working memory with effectiveness was moderate, for delocalized defects only. The effect of the order of change parts on efficiency could not be concluded. — [Source](https://link.springer.com/article/10.1007/s10664-018-9676-8); [DOI](https://doi.org/10.1007/s10664-018-9676-8) (already in the archive as a reference)
- Zhou et al. (2026) also cite Kazemitabaar et al. (2024) as a related stepwise verification system (see Q1).

### Inferences
- The thesis's central comparison (checkpoint vs. batch) is confounded with chunk size in the same way as Baum et al. (2019): smaller chunks help effectiveness. The thesis must hold size fixed (its design already uses similar-size subtasks in the control condition), so that the decision-point effect is not a chunk-size effect.
- di Biase et al. (2019) suggest a null is possible for understanding and defect detection from chunking alone. The thesis's H1 (understanding) may therefore depend on placement at decision points, not on chunking per se. This should be stated as a risk in the analysis plan.

### Gaps
- No stepwise-vs-batch study for AI-generated code with understanding or defect outcomes was found.
- Kazemitabaar et al.'s full results (per-measure effects) were not read in full; I used the abstract and search snippets.

---

## Q3. Code review chunk size and incremental review of AI-generated PRs (understanding, defect detection)

### Takeaway
Classic code-review experiments (Baum 2019; di Biase 2019) show that smaller changes improve review effectiveness, and that decomposition does not improve understanding or defect detection. No controlled study on incremental review of AI-generated PRs was found. The "AI PRs are larger and harder to review" evidence is practitioner blog content, which I did not use as evidence.

### Cited Findings
- Baum et al. (2019) and di Biase et al. (2019): see Q2.
- Gullstrand Heander et al. (2026), Bacchelli & Bird (2013) and di Biase (2019) are listed in the archive as "review is about understanding; size hurts". I did not re-check these full texts for this note.
- Practitioner posts about larger AI-generated PRs (for example Brodzinski, 2026) report observations, not controlled data. They are not used here. — [Source](https://brodzinski.com/2026/07/3x-pull-request-size-ai.html)

### Inferences
- The chunking literature supports "smaller is more effective" but "decomposition does not change understanding". This is an argument for measuring placement and content, not only size.

### Gaps
- No controlled study of incremental review of AI-generated PRs was found. The search for "AI-generated pull request" + "user study" returned only practitioner content and tool papers.

---

## Q4. 2025–2026 human-in-the-loop checkpoints for agents (Claude Code, Codex, Cursor, Devin, SWE-agent style) with a user study

### Takeaway
Several 2025–2026 papers have user studies on agent oversight, but most vary oversight structure or visibility rather than the timing of a review of a finished unit of work. The most relevant are Zhou et al. (2026), Chen et al. (2026), and Kumar et al. (2026). Vibetrace (Yan et al., Nov 2026) is the closest coding-agent system with a user study that targets intermediate steps.

### Cited Findings
- **Pu, Lazaro & Arawjo (CHI 2025), "Assistance or Disruption? Exploring and Evaluating the Design and Trade-offs of Proactive AI Programming Support", arXiv 2502.18658 (DOI 10.1145/3706598.3713357).** Codellaborator, within-subjects N=18, three interface variants (prompt-only, proactive agent, proactive agent with presence and context). Proactive agents increased efficiency but caused more workflow disruptions. The manipulated variable is when the agent initiates assistance, not when the user reviews agent output. — [Source](https://arxiv.org/abs/2502.18658)
- **Mozannar et al. (2025), "Magentic-UI: Towards Human-in-the-loop Agentic Systems", arXiv 2507.22358.** Open-source research prototype with six interaction mechanisms (co-planning, co-tasking, multi-tasking, action guards, long-term memory). Evaluated via benchmarks, simulated user testing, qualitative studies with real users, and safety assessments. No controlled timing comparison in the abstract. — [Source](https://arxiv.org/abs/2507.22358)
- **Yan, Lei & Shi (Nov 2026), "From Watching to Steering: Enabling Human–Coding Agent Collaboration through Execution Traces" (Vibetrace), arXiv 2611.04466.** Trace visualisation with fork-from-prior-step and targeted correction on OpenCode. Formative study with 12 developers. User studies "demonstrate improved accuracy and efficiency over conventional log-based interaction." The sample size of the user study was not extracted. The manipulated variable is the interface (trace vs. logs), not review timing; the fork-from-step capability is a retrospective intervention point. — [Source](https://arxiv.org/abs/2611.04466)
- **Wu, Wermke, Li, Stolee & Xu (Nov 2026), "From Delegation to Action Approval", arXiv 2611.10058.** Survey of 203 developers. 61% of developers who carefully review most or all generated code still often approve at least one agent action without review. Survey, not experiment. — [Source](https://arxiv.org/abs/2611.10058)
- **VibeJam (Balepur, Baumler & Chen, Aug 2026), arXiv 2608.29889.** Browser-based study platform with diff review, chat and plan modes; pilot with 55 participants. Platform paper, no manipulated timing variable found. — [Source](https://arxiv.org/abs/2608.29889)
- **Zhang et al. (Oct 2026), "Rethinking Verification in Agent Harnesses", arXiv 2610.34577.** Compares 17 verification designs (mid-turn reminders, completion gates, independent review) on Terminal-Bench and SWE-bench with models, not humans. Relevant as a timing comparison for automated checks only. — [Source](https://arxiv.org/abs/2610.34577)
- **Dhanorkar et al. 2026 (already known).** The arXiv paper "Human oversight of agentic systems in practice" (arXiv 2606.05391) matches the four forms in the archive description (a priori control, co-planning, real-time monitoring, post hoc review), as shown in a search snippet. I did not read the full text or check authorship. — [Source](https://arxiv.org/html/2606.05391v1)
- **Wang et al. 2026 (already known), arXiv 2608.12355.** Confirmed: position paper, submitted 4 Jul 2026, no user study. It calls for verification and steerability mechanisms and does not report a study. — [Source](https://arxiv.org/abs/2608.12355)

### Inferences
- Human-in-the-loop coding-agent studies from 2025–2026 mostly manipulate interface features (visibility, proactive triggers, plan modes) and not review timing. This matches the archive's note that the field is interview- and survey-heavy.

### Gaps
- No user study with a coding agent that varies the timing of a blocking review was found.
- Sample sizes for Vibetrace and Magentic-UI user studies were not extracted.

---

## Related work on calibration and comprehension of generated code (not timing, but relevant to the outcomes)

- **Kaufman, Brun & Murali (Jul 2026), "Programmers Are Poor and Overconfident Judges of LLM-Generated Assertions", arXiv 2607.08885.** Controlled experiment, N=86 Python programmers, plus a think-aloud follow-up. Accuracy was 74% for correct assertions vs. 49% for incorrect ones (OR=2.94), with similarly high confidence in both (about 4/5). Relevant for the confidence calibration outcome. — [Source](https://arxiv.org/abs/2607.08885)
- **Oertel, Klünder & Hebig (Nov 2026), "The Comprehension Gap in LLM-Assisted Software Development: An Experiment", arXiv 2611.24216.** Crossover experiment with 35 participants comparing comprehension of generated code with self-written and unseen code. The snippet reports that participants solved the comprehension task about 20% faster for self-written code than for generated code; I did not read the full results. Relevant as a comprehension-measure reference, not for timing. — [Source](https://arxiv.org/abs/2611.24216)
- **Zhou R. et al. (2025/2026), "Improving Human Verification of LLM Reasoning through Interactive Explanation Interfaces", arXiv 2510.22922.** N=125; interactive explanation formats (for example iGraph) improved verification accuracy compared with a text baseline; iGraph 85.6%. Step-level verification of LLM reasoning, not agent timing. — [Source](https://arxiv.org/abs/2510.22922)
- **Song (Mar 2026), "Cross-Context Review", arXiv 2603.12123.** Controlled experiment with LLM reviewers only (30 artifacts, 150 injected errors); second review helps only in a fresh session. No human participants. Adjacent: placement of review in time, but automated. — [Source](https://arxiv.org/abs/2603.12123)
- **Khojah et al. (Jun 2026), "Same Scrutiny, More Time: Eye Tracking Insights into Reviewing LLM-Labelled Code", arXiv 2606.26505.** Wizard-of-Oz experiment, N=32; code labelled as LLM-generated vs. unlabelled. Review behaviour and eye tracking, not timing. — [Source](https://arxiv.org/abs/2606.26505)

---

## Ranking of all findings by relevance to the thesis

| Rank | Finding | Relevance | Reason |
|---|---|---|---|
| 1 | Zhou et al., CHI 2026 (arXiv 2510.05307) | **High** | Same comparison (end-of-task vs. intermediate checkpoints, within-subjects N=48) in agent tasks; must be cited; differences: GUI not code, preference/time outcomes, cost-optimal placement not decision-point placement. |
| 2 | di Biase et al. 2019 (PeerJ CS) | **High** (already in archive) | Chunking/decomposition did not change understanding or defect detection (N=28); sets expectations for H1 and forces a placement-not-size argument. |
| 3 | Baum et al. 2019 (EMSE) | **High** (already in archive) | Smaller changes → higher effectiveness (N=50); order effect unresolved; confound to control in the thesis design. |
| 4 | Kazemitabaar et al. 2024 UIST (arXiv 2407.02651) (already known) | **High** | Closest on stepwise verification; manipulates decomposition granularity, not review timing. |
| 5 | Chen et al. 2026 (arXiv 2604.04918) | **Medium–High** | Within-subjects N=48 on oversight structure with plan-level vs. action-level engagement; CUA not code; no end-review baseline; supports "recognizable moment" concept. |
| 6 | Kumar et al. 2026 Plan Mode (arXiv 2607.23670) | **Medium** | Within-subjects N=24; one upfront checkpoint; spreadsheets; outcomes: refinement, perception. |
| 7 | Kirmayr et al. 2026 (arXiv 2602.15569) | **Medium** | Controlled N=45 on feedback timing in an agentic system (in-car); intermediate feedback improved trust and load; not code, no understanding measure. |
| 8 | Yan et al. 2026 Vibetrace (arXiv 2611.04466) | **Medium** | Coding agent, fork-from-step intervention, user study vs. logs; N not extracted; manipulates interface. |
| 9 | Pu et al. 2025 Codellaborator (arXiv 2502.18658) | **Medium–Low** | N=18 within-subjects on when the agent interjects; about agent-initiated help, not reviewing output. |
| 10 | Kaufman et al. 2026 (arXiv 2607.08885) | **Medium–Low** | N=86 calibration of judgments on generated code; outcome relevant for confidence calibration; no timing variable. |
| 11 | Dhanorkar et al. 2026 (arXiv 2606.05391) (already known) | **Medium** (known) | Interview study of oversight forms; confirms that developers chunk tasks and skip real-time monitoring. |
| 12 | Wang et al. 2026 (arXiv 2608.12355) (already known) | **Medium** (known) | Position paper; supports the gap framing, no study. |
| 13 | Magentic-UI 2025 (arXiv 2507.22358) | **Low–Medium** | Co-planning and action guards; qualitative user studies; no timing comparison. |
| 14 | Oertel et al. 2026 (arXiv 2611.24216) | **Low–Medium** | Comprehension measures for generated code; no timing. |
| 15 | Zhang et al. 2026 Rethinking Verification (arXiv 2610.34577) | **Low** | Automated checks at different times; no human participants. |
| 16 | Wu et al. 2026 survey (arXiv 2611.10058) | **Low** | Survey N=203; approvals vs. review; no experiment. |
| 17 | Zhou R. et al. 2026 (arXiv 2510.22922) | **Low** | Step-level explanation formats for reasoning; no agent timing. |
| 18 | Khojah et al. 2026 (arXiv 2606.26505) | **Low** | Labelling effect on review of LLM code; eye tracking. |
| 19 | Song 2026 CCR (arXiv 2603.12123) | **Low** | Review placement with LLM reviewers only. |
| 20 | VibeJam 2026 (arXiv 2608.29889) | **Low** | Platform paper; no manipulated timing. |

---

## Suggested wording for the thesis (gap claim)

The current wording, "to my knowledge, no controlled study compares intermediate checkpoints with end-of-task review for coding agents," still holds for coding agents as far as these searches show. But it will be read as too broad once Zhou et al. (2026) are known. Suggested replacement:

> To my knowledge, no controlled study compares placements of a blocking review during a coding agent's run (end of task vs. after a decision point vs. after a similar-sized subtask) and measures developers' understanding of the produced code. Zhou et al. (2026) compare end-of-task confirmation with intermediate confirmation in GUI agent tasks, with preference and completion time as outcomes; Kazemitabaar et al. (2024) compare stepwise decomposition; and code-review studies show that chunking alone does not improve understanding (di Biase et al., 2019).

Points the thesis should make explicit because the nearest studies do not address them:
1. Placement by decision point (where the agent silently settled a question) versus placement by expected error cost (Zhou et al.).
2. Chunk size held constant across conditions (Baum et al., 2019).
3. Outcomes: prediction of behaviour with code hidden, fault detection, calibration. Zhou et al. report preference and time.

## Limits of this search

- About 40 tool calls, beyond the ~15 suggested in the research guidance, because the gap claim needed several passes.
- ACM DL returned 403, so CHI/UIST/CSCW pages were checked only through search snippets.
- arXiv API quoted-phrase queries returned few hits; results came mainly through web search.
- Full text read: Zhou et al. (partial: formative study, intro, verification description; results tables not read), Chen et al. (partial: abstract, intro, design space; quantitative numbers not extracted), Kirmayr et al. (partial: abstract and IV1 design). Other items are from abstracts or search snippets.
- No Semantic Scholar or Google Scholar forward-citation tracing was done; Wang et al. (2026) and Kazemitabaar et al. (2024) were not traced forward systematically. This should be done before submission.
