# Agent decisions, assumptions and steering: how coding agents surface decisions to humans

Scope: research up to 20 Nov 2026. Each paper below was checked against an arXiv abstract page, the arXiv HTML full text, or a search record (the source is named per entry). Papers marked *snippet only* were seen in a search result and were not opened. Papers marked *already known* are in the thesis list (`docs/archive/literature.md`) and are noted here only where they matter for the question.

### Relevance ranking (all findings)

| Rank | Item | Relevance | Why |
|---|---|---|---|
| 1 | Yuan et al. 2026, Verifiable Literate Programming (arXiv:2607.02333) | high | Only item found that automatically flags underspecified / intent-mismatched lines in agent-written code and sends them to a human; abstract only, human evaluation details not read |
| 2 | Edwards & Schuster 2026, Ask or Assume? (arXiv:2603.26233) | high (already known) | Measures when agents should ask vs. assume on underspecified SWE-bench; the existing anchor for question (b). Not re-read here |
| 3 | Yan et al. 2026, Vibetrace / "From Watching to Steering" (arXiv:2611.04466) | high | Human study on fork-and-correct steering at decision points in agent traces; controlled study N=20 vs. native logs |
| 4 | Kazemitabaar et al. 2024, UIST, Steering and Verification via Interactive Task Decomposition (arXiv:2407.02651; DOI 10.1145/3654777.3676345) | medium-high | Human-centred steering of AI-assisted analysis via decomposed subtasks, which is structurally close to the thesis' four subtasks; full text not read here |
| 5 | Zhao et al. 2026, AgentGUI (arXiv:2607.26300) | medium | Human study of trajectory comprehension (N=8); no decision-surfacing, but a measured effect on understanding |
| 6 | Chen & Zhu 2025, Need Help? (arXiv:2410.04596, CHI 2025) | medium (already known) | Timing of proactive suggestions; the basis for question (b), not re-read here |
| 7 | Patel et al. 2026, PAUSE (arXiv:2610.29870) | medium (method, no humans) | Intervenes once, before the first source edit; the structural analogue of "one pause at a planned point", but automated only |
| 8 | Wang et al. 2026, Humans are Missing (arXiv:2608.12355) | medium (already known) | Position paper naming task alignment and clarification as a bottleneck; supports the framing |
| 9 | Darji 2025, LLM coding assistant asking clarification questions (arXiv:2507.21285) | low-medium | Asks clarification questions in a review-like loop; snippet only, 3 citations per search record |
| 10 | Developer Interaction Patterns with Proactive AI: A Five-Day Field Study (TU Delft; PDF at research.tudelft.nl, not opened) | medium | Field study of when proactive suggestions are accepted; PDF returned HTTP 403, so only the title and heading were seen |
| 11 | Ma et al. 2026, Understanding and Managing Underspecification in LLM Prompts (ACL 2026; cmu.edu PDF) | low-medium | Prompt-side analysis of underspecification; snippet only |
| 12 | How to Steer Your Multi-Agent System: Human-LLM Collaborative Planning (arXiv:2605.23023; authors not seen) | low-medium | Human-LLM collaborative planning user study (N unknown); snippet only |
| 13 | Opinion: Coding-Agent Benchmarks Should Match Their Users' Task Flows (arXiv:2610.09633) | low | Task flows incl. planning and steering across 4,782 sessions; snippet only |
| 14 | SWE-Milestone (arXiv:2603.13428) | low | "Milestones" here are commit-graph groups, not decision points and not for human review |

---

## KQ1: Which studies with users surface an agent's assumptions or design decisions and measure understanding, verification or steering?

### Takeaway
The closest human study is Vibetrace (Yan et al. 2026): a trace view with fork-and-correct steering, tested against native logs in a controlled study with N=20. It measures understanding and error diagnosis, not decisions as such. No paper found surfaces the agent's *silent design decisions* as a first-class object and measures whether users catch them.

### Cited Findings
- Vibetrace: a formative study with 12 developers who regularly use Claude Code, Codex, Cursor and OpenCode found that users need execution transparency, and that "monitoring practices varied with task complexity and confidence": most reviewed after completion, some monitored intermediate steps for ambiguous or high-risk tasks — [Yan et al. 2026](https://arxiv.org/abs/2611.04466)
- Vibetrace: a controlled study with 20 participants with coding-agent experience (13 female, age M=24.1) compared trace visualisations with OpenCode's native logs, on 10 real agent traces; the abstract reports that trace visualisation "improves execution understanding and error diagnosis" — [Yan et al. 2026](https://arxiv.org/abs/2611.04466). Exact effect sizes not extracted.
- Vibetrace: users can fork execution from a prior step and give targeted corrections without restarting validated progress; the corrections are then distilled into skills (SWE-bench Verified pass rate 65.0% → 68.0%, cost −15.5%) — [Yan et al. 2026](https://arxiv.org/abs/2611.04466)
- AgentGUI: within-participant study with N=8 on two Hermes trajectories. Time per question fell from 145 s to 90 s (38% faster, p=0.023); accuracy rose from 80% to 93% (p=0.031); the authors call the N "small and rather homogeneous" — [Zhao et al. 2026](https://arxiv.org/html/2607.26300). The study tests *lookup* of trajectory information, not whether users notice decisions.
- AgentGUI's automated "manager" decomposes the task into verifiable criteria, checks them against the transcript and workspace, and resumes the agent with feedback. In a 50-run-per-model proof of concept, one audit raised completion (e.g. 44% → 78% for a 4B model); no humans were involved — [Zhao et al. 2026](https://arxiv.org/html/2607.26300)
- Kazemitabaar et al. (UIST 2024) build two systems in which "decomposition" is the focal point of the interface, to improve steering and verification in AI-assisted data analysis; the paper has 141 citations per the Semantic Scholar record — [arXiv:2407.02651](https://arxiv.org/abs/2407.02651). I did not read the user-study numbers.
- Dhanorkar et al. 2026 (already known) report developers treating passing tests as proof of correctness, which is the verification gap that decision surfacing would address — [DOI 10.1145/3805689.3812402] (in thesis list).

### Inferences
- Trace-based views are the best-measured kind of decision surfacing so far, but they make the *whole* trajectory legible. None tests whether a specific, pre-identified decision is noticed more often when it is highlighted at a pause. That is the thesis' gap.
- Vibetrace's fork-and-correct loop is the closest existing mechanism to "pause at a decision point and steer". If the thesis cites it, it should be cited as a trace inspector with post-hoc correction, not as a timed intervention.

### Gaps
- I could not extract Vibetrace's per-measure statistics or the exact pause/inspection timing; the full text should be read before citing numbers.
- I found no paper that measures how often users catch an agent's silent decision, with or without a highlighted pause.
- No study found that compares a blocking pause with a non-blocking review feed for the same agent run.

---

## KQ2: Which work studies when an agent should interrupt the user to ask (clarification timing, proactive agents, "need help?")?

### Takeaway
Two anchors exist: Edwards & Schuster 2026 (ask vs. assume, uncertainty-aware, on underspecified SWE-bench) and Chen & Zhu 2025 "Need Help?" (timing of proactive suggestions in programming, CHI 2025). A 2026 field study on developer interaction patterns with proactive AI exists, but I could not open it. Overall, timing of agent-initiated *decision* interruptions in coding work is thinly studied.

### Cited Findings
- Edwards & Schuster 2026 (already known): "systematically evaluate[s] the clarification-seeking abilities of LLM agents on an underspecified variant of SWE-bench Verified" — [arXiv:2603.26233](https://arxiv.org/abs/2603.26233); v3 revised 7 Sep 2026. Not re-read for this note.
- Chen & Zhu 2025 (already known): "a randomized experimental study examining the impact of various design elements of the proactive assistant on programmer productivity and user experience" — [arXiv:2410.04596](https://arxiv.org/abs/2410.04596), CHI 2025.
- TU Delft 2026, "Developer Interaction Patterns with Proactive AI: A Five-Day Field Study" (research.tudelft.nl/files/282927106/3742413.3789148.pdf). The PDF returned HTTP 403 when fetched; only the title and an acknowledgement heading were visible in search. Treat as *found, not read*; check the title's venue and numbers before use.
- Darji 2025 (arXiv:2507.21285, *snippet only*): an LLM coding assistant that asks clarification questions in a review-like loop; 3 citations per the search record.
- Position paper Wang et al. 2026 (already known, arXiv:2608.12355): names "task alignment", including clarification and incorrect assumptions, as a central user pain point — [arXiv:2608.12355](https://arxiv.org/abs/2608.12355).
- The archive's annotation of SWE-chat (Baumann et al. 2026, arXiv:2604.20779, in the thesis list) says agents rarely ask clarifying questions in real sessions. I did not open that paper for this note; the claim is from the archive, not verified here.

### Inferences
- The clarification literature mostly asks *whether* to ask (Edwards & Schuster) or *how often* to offer help (Chen & Zhu). Neither ties the interruption to a point in the work sequence, which is what a pause at a subtask boundary needs. Iqbal & Bailey 2006 (known) is the best support for the boundary argument.
- The "need help?" framing is about the programmer asking, while the thesis has the agent pausing the programmer. Cite Chen & Zhu for the design-space parallels, but not as evidence for the timing claim.

### Gaps
- No programming study found that compares interruption timings for a *decision* (versus a suggestion or a generic check).
- I did not verify the TU Delft field study's findings; this should be checked before citing it.

---

## KQ3: Which work detects ambiguity or underspecification in requirements, or silent decisions in agent trajectories, automatically, and evaluates against human judgement?

### Takeaway
Yuan et al. 2026 (VLP) is the most relevant automatic detector. It finds intent–code mismatches in LLM-generated code and routes review to suspicious lines, and it reports a human-in-the-loop evaluation. It does not detect decisions in an agent's *trajectory*. Edwards & Schuster (already known) detect uncertainty about what to ask, but do not work on silent decisions in generated code.

### Cited Findings
- Yuan et al. 2026, VLP: a bug study of LLM-generated code found that "failures often stem from underspecified requirements or subtle semantic deviations". The framework uses "LLM-based fine-grained mismatch detection" to focus users' review on suspicious documentation lines; code pass@1 rose from 28.7%–73.2% to 65.4%–93.5% "with reasonable user effort" — [arXiv:2607.02333](https://arxiv.org/abs/2607.02333). I read the abstract only; the human-evaluation design (N, tasks, measures) is not known to me.
- Yuan et al. 2026 also say that existing methods "involve users only in partial software artifacts such as prompts and test cases, which may overlook corner cases and program details" — [arXiv:2607.02333](https://arxiv.org/abs/2607.02333). This is the same gap the thesis addresses from the timing side.
- Underspecification in code generation: "Underspecification does not imply Incoherence" argues that under-specified prompts "cannot be reliably detected using the LLMs' interpretations" by clustering execution behaviour — [arXiv:2607.01953](https://arxiv.org/html/2607.01953v1). Snippet only; it argues against self-detection, which matters for the thesis' LLM-judge future-work idea.
- Edwards & Schuster (already known): the agent is evaluated on whether it asks or assumes, using uncertainty — [arXiv:2603.26233](https://arxiv.org/abs/2603.26233).
- A blog (Medium, "When agents learn to ask") cites AwN (arXiv:2409.00557) and Active Task Disambiguation (arXiv:2502.04485). I did not open these papers; treat them as leads only.

### Inferences
- The VLP result is a reason to expect that *automatic* suspicion scoring helps human review, but it is evidence from a code-to-documentation pipeline, not from a live agent. The thesis' LLM judge would be a weaker version: it runs on the trajectory, not on a spec.
- The "does not imply incoherence" result suggests that a judge reading the agent's own output may miss under-specification, which is a risk for the decision-point detector. It should be cited as a caution.

### Gaps
- I found no automatic detector of silent decisions in *agent trajectories* that is evaluated against human judgements of decisions.
- VLP's human evaluation needs to be read in full before the thesis uses it as support.

---

## KQ4: Is there work that defines something like a "decision point" or "semantic milestone" in agent work and uses it to schedule human review?

### Takeaway
No paper found defines a decision point or semantic milestone in agent work *and* uses it to time a human review. The closest matches are structural: PAUSE (Patel et al. 2026) intervenes once, before the first source edit, and SWE-Milestone groups commits into milestones. Neither uses human judgement of decisions.

### Cited Findings
- PAUSE (Patel et al. 2026): "Agents reach their first source-code edit at a median of 60% of trajectory progress, after exploration, bug reproduction, and testing. PAUSE intercepts this edit request before it executes" — [arXiv:2610.29870](https://arxiv.org/abs/2610.29870). Automated Planner; no human study; resolution gains of 16.8% (Verified, OpenHands) and 14.7% (Multilingual, SWE-agent) are reported in the abstract. Relevant as a single, well-placed intervention; not a human-review schedule.
- SWE-Milestone (arXiv:2603.13428): milestones are "semantic release intent" in a human-annotated DAG compared with commit-topology groups — [arXiv:2603.13428](https://arxiv.org/html/2603.13428v4). This is a benchmark of agent software evolution, not a review trigger. Low relevance, but it shows that "milestone" is used in agent evaluation with human annotation, which is a naming collision to avoid.
- Zhao et al. 2026 (AgentGUI): the audit "first decomposes the agent task into verifiable criteria" and checks each against evidence — [arXiv:2607.26300](https://arxiv.org/html/2607.26300). Criteria-based checkpoints are a neighbouring concept to decision points, but the criteria are task-level, not decisions.

### Inferences
- The thesis' "semantic milestone" term is not in the literature found here, and it would collide with SWE-Milestone. If the term is kept, it should be defined in the thesis as a subtask boundary plus a decision flag, and cited against PAUSE's "before first edit" rule.
- PAUSE is the strongest argument that a single, planned intervention can be effective; the thesis' human-facing version is a different claim and needs its own evidence.

### Gaps
- I searched for "decision points", "semantic milestones", and human review scheduling for agent work; I found nothing that matches. This is a real gap, but the search was limited to the sources above, and the wording "checkpoint" or "review gate" may hit other work not covered here.

---

## Notes on the search and what remains open

- Tool calls used: about 15 (web search, arXiv abstract and HTML fetches, one saved-output grep). Papers marked *snippet only* or *found, not read* must be opened before they are cited.
- Read in full text or full HTML: Vibetrace (arXiv:2611.04466, HTML; key numbers extracted, per-measure stats not), AgentGUI (arXiv:2607.26300, HTML; all numbers above come from the paper). Abstract only: VLP (arXiv:2607.02333), PAUSE (arXiv:2610.29870).
- Not read in full: Kazemitabaar et al. 2024 (UIST), Edwards & Schuster 2026 (already known), Chen & Zhu 2025 (already known), TU Delft 2026 field study (PDF 403).
- Suggested next steps: (1) read the full VLP paper for its user-study design; (2) read Kazemitabaar et al. 2024 for its N and steering measures, since it is closest to the subtask structure; (3) check the TU Delft field study; its PDF file name suggests DOI 10.1145/3742413.3789148, which is unconfirmed; (4) search Semantic Scholar forward citations of Edwards & Schuster 2026 and Chen & Zhu 2025 for 2026 papers on interruption timing.
- Thesis-list cross-check: the 9 known items named in the brief were checked against the archive file and the search results; none was re-verified in full text for this note.
