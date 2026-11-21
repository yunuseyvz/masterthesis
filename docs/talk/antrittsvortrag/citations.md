# Citations in the kick-off talk

Every source on the slides, checked against the paper itself (abstract, and the full text where the claim needed it)
on 16.11.2026. For each: what the paper is, what it found, what the slide says, and what to watch out for if asked.

## Slide 2 · Looks good to me…

### Dhanorkar, Passi & Vorvoreanu (2026)

*Human oversight of agentic systems in practice: Examining the oversight work, challenges, and heuristics of developers
using software agents.* FAccT '26. doi:10.1145/3805689.3812402 (preprint arXiv:2606.05391). Microsoft Research.

- **What it is:** Interviews with 17 experienced developers who use software agents.
- **Findings:** Four forms of oversight: control up front, co-planning, real-time monitoring and review afterwards.
  Reviewing agent code is hard, and developers fall back on heuristics. One heuristic: they treat passing tests as a
  guarantee of correctness.
- **Slide:** "Passing tests are taken as proof." ✓ Matches the abstract almost word for word.
- **Watch out:** It's a qualitative interview study with 17 people. Say "developers report", not "most developers".

### Yu et al. (2026)

*Habituation at the Gate: Rising Approval and Declining Scrutiny in Human Review of AI Agent Code.* arXiv:2606.22721.

- **What it is:** A longitudinal analysis of 400 reviewers and 11,429 reviews of agent PRs on GitHub (AIDev dataset),
  over seven months.
- **Findings:** For the same reviewer, the approval rate rises from 30.1 % to 36.8 %. Inline comments drop by 22 %.
  Human PRs over the same period show no such rise. The authors read it as habituation under workload.
- **Slide:** "Approval rises, scrutiny falls." ✓ That is the title of the paper.
- **Watch out:** It's a preprint, and the data is observational. Habituation is the authors' interpretation, not a
  measurement.

### Duma, Wróblewski, Bobińska, Winiarska & Przymus (2026)

*These Aren't the Reviews You're Looking For: How Humans Review AI-Generated Pull Requests.* arXiv:2605.02273.

- **What it is:** Compares the reviews of AI PRs and human PRs in the same GitHub repositories (AIDev dataset).
- **Findings:** Most AI PRs get no review at all. When they are reviewed, other AI agents dominate the review. Humans
  tend to steer the agent rather than evaluate the code themselves.
- **Slide:** "Most agent PRs get no human review." ✓ The paper's claim is even stronger: most get no review at all.
- **Watch out:** It's a preprint about open-source GitHub projects. Company workflows may differ.

## Slide 3 · Research question

### Buçinca, Malaya & Gajos (2021)

*To Trust or to Think: Cognitive Forcing Functions Can Reduce Overreliance on AI in AI-assisted Decision-making.*
Proc. ACM HCI (CSCW). doi:10.1145/3449287

- **What it is:** An experiment with 199 participants on AI-assisted decisions, outside programming. It compares three
  cognitive forcing designs with simple AI explanations.
- **Findings:** Cognitive forcing reduced over-reliance significantly. The trade-off: participants liked the most
  effective designs least. People with a higher need for cognition benefited more.
- **Slide:** "Forcing people to think reduces over-reliance on AI." ✓
- **Watch out:** The paper measures over-reliance, not understanding. ⚠ Your new script says the interventions can
  "increase understanding and over-reliance on AI". That is wrong in two ways: over-reliance goes **down**, and the
  paper does not measure understanding.

### Ghosh, Sarkar, Lindley & Poelitz (2026)

*An Experimental Comparison of Cognitive Forcing Functions for Execution Plans in AI-Assisted Writing.*
arXiv:2601.18033. Microsoft Research.

- **What it is:** A controlled experiment with AI-generated plans for writing tasks. Four conditions: an assumption
  check, a what-if question, both, and none. Plus a think-aloud follow-up study.
- **Findings:** The assumption check reduced over-reliance most, without extra cognitive load. Participants found the
  what-if question most helpful.
- **Slide:** "Questions about assumptions reduce over-reliance most." ✓
- **Watch out:** ⚠ Your script says "generic prompts can even make it worse". The abstract doesn't say that. It only
  appears in your literature notes, which list Ghosh as not yet checked against the full text. Safer: "It depends on
  the design: questions about assumptions work best." The study is about writing, not code. What links it to your
  work is plan review.

## Slide 4 · The agent decided for you

### Mu et al. (2024)

*ClarifyGPT: A Framework for Enhancing LLM-Based Code Generation via Requirements Clarification.* Proc. ACM Softw. Eng.
(FSE). doi:10.1145/3660810 (preprint arXiv:2310.10996).

- **What it is:** A framework. It detects ambiguous requirements through a code consistency check and has the LLM ask
  targeted questions before writing code.
- **Findings:** Asking helps. GPT-4's Pass@1 on MBPP-sanitized rises from 70.96 % to 80.80 %. The introduction states
  that current LLMs rarely ask and instead "directly generate programs" from unclear requirements.
- **Slide:** "Models code from unclear specs instead of asking." ✓ This is the paper's motivation (with a reference to
  Kuhn et al. 2023), not its own measurement. What it measures itself is that asking helps.
- **Watch out:** Models from 2023 and function-level benchmarks. Today's agents ask more in plan mode. Your answer is
  in "If asked" under "Why not let the agent ask in plan mode?".

### Yang et al. (2026)

*Clarity Is Not Assumed: Understanding LLM-Based Code Generation under Ambiguous Requirements.* ASE '26.
doi:10.1145/3832783.3834403 (preprint arXiv:2604.21505).

- **What it is:** Orchid, the first code-generation benchmark with ambiguous requirements: 1,304 function-level tasks
  covering four types of ambiguity.
- **Findings:** Ambiguity consistently degrades the performance of all evaluated LLMs, most strongly in the most
  advanced models. For the same ambiguous requirement, models produce functionally different implementations, and they
  cannot identify or resolve the ambiguity on their own.
- **Slide:** "Ambiguity degrades every model tested." ✓
- **Watch out:** These are single functions, not agents working on a whole project. But the finding fits your
  argument: the same open requirement leads to different code, and the model doesn't notice.

### Kravchuk-Kirilyuk, Graciolli & Amin (2025)

*The Modular Imperative: Rethinking LLMs for Maintainable Software.* LMPL '25 (SIGPLAN workshop).
doi:10.1145/3759425.3763392. Harvard.

- **What it is:** A position paper with small exploratory experiments, such as a dashboard built with Cursor and Claude
  Sonnet 4.
- **Findings:** Even with modular guidelines, LLM code often looked modular at first glance. It still had hidden
  dependencies between components, needless complexity and breaking changes.
- **Slide:** "LLM code looks modular but hides dependencies." ✓ Close to the paper's own wording.
- **Watch out:** It's a position paper, not a systematic study. Call it a "case", not "evidence".

### Iqbal & Bailey (2006)

*Leveraging characteristics of task structure to predict the cost of interruption.* CHI '06.
doi:10.1145/1124772.1124882

- **What it is:** An experiment with interruptions at different subtask boundaries, with resumption lag as the cost
  measure. It produced a model that predicts the cost of an interruption from the task structure.
- **Findings:** The cost differs between subtask boundaries and can be predicted from the task structure. In the
  background section, the authors report from their own earlier work that boundaries are much cheaper than moments
  within a subtask.
- **Slide:** "Some subtask boundaries are better to interrupt at." ✓ That is this paper's own finding, and it fits
  your thesis especially well: among the boundaries, the place still matters.
- **Watch out:** "Boundaries are cheaper than the middle of a subtask" comes from their earlier work, not from this
  paper. That's why the slide line changed. This is office tasks from 2006, not programming with agents.

## Slide 5 · One pause, three places

### Wang et al. (2026)

*Humans are Missing from AI Coding Agent Research.* arXiv:2608.12355. Authors include John Yang, Kilian Lieret,
Lingming Zhang, Karthik Narasimhan, Ludwig Schmidt and Graham Neubig.

- **What it is:** A position paper. It argues for human-centered rather than autonomous coding agents, along four
  dimensions: task alignment, verifiability, steerability and adaptability.
- **Findings:** Section 3.2 on steerability: "steerable agents must recognize meaningful decision points in a task,
  operate at appropriate levels of abstraction, and structure execution to expose decision boundaries".
- **Slide:** "Agents should recognize meaningful decision points and expose them." ✓ Almost a direct quote.
- **Watch out:** It's a position paper, so it's a demand, not evidence. Their "decision points" are broader than
  yours. They mean every point where the user could steer, not only open requirements.

## Only on the references slide

### Ahmad (2026)

*Comprehension Debt in GenAI-Assisted Software Engineering Projects.* arXiv:2604.13277.

- **What it is:** A qualitative study of 621 reflective diaries from 207 students in a software project over eight
  weeks.
- **Findings:** It defines comprehension debt as the growing gap between what a team knows about its code and what it
  needs to know. It describes four patterns that build this debt, such as accepting AI code as a black box and skipping
  verification, and one pattern that counters it: using AI as a scaffold for understanding.
- **Slide:** Not cited on any content slide anymore, only on the references slide. You say "comprehension debt" out
  loud in the opening, and this is the source if anyone asks.
- **Watch out:** Students, not professional developers.

## Only in the "If asked" notes

These are not on the slides. Each was checked against its abstract in this session.

| Source | What you say | Basis |
| --- | --- | --- |
| Wu et al. 2026, arXiv:2611.10058 | 57 % want a pause when instructions are ambiguous, 65 % before critical code; 51 % find problems in plausible code hard to spot; 69 % say line-by-line review can't keep up | Survey, n = 203 developers |
| Shen & Tamkin 2026, arXiv:2601.20245 | AI group 17 % lower on the quiz, biggest gap in debugging; people who had the code explained to them did better | RCT, n = 52, mostly juniors, learning a new library, chat assistant rather than an agent; the part about explanations is a qualitative pattern, not a causal result |
| Edwards & Schuster 2026, EMNLP Findings (arXiv:2603.26233) | Agents ask less than they should; asking helps most when the work itself exposes the gap | Underspecified SWE-bench Verified, simulated user |
| Peralta et al. 2026, arXiv:2605.22534 | 79 % of merged agent PRs show no visible feedback loop | Manual sample of 364 merged PRs |
| Rahman et al. 2026, arXiv:2610.11179 | Reviewers want a known human owner before accepting AI PRs | Survey, n = 239 practitioners; the 41.8 % is the share who require it |
| Anthropic, March 2026 | Users approve 93 % of permission prompts | Vendor figure from an engineering blog post, not peer-reviewed; cite it as such |

## Open points in your script

1. **Slide 3, sentence 1:** "can increase understanding and over-reliance" → suggestion: "Research shows that making
   people think can reduce over-reliance on AI."
2. **Slide 3, sentence 2:** "generic prompts can even make it worse" → suggestion: "It depends on the design though:
   questions about assumptions work best."
