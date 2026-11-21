# Intervention design across domains

Prepared for the kick-off discussion (17.11.2026). ✓ = checked against the paper's abstract or full text today;
(unverified) = from memory, check before citing.

## The design dimensions

Across domains, interventions that make people engage instead of rubber-stamping differ on five dimensions. My study
fixes four and varies one (timing).

| Dimension | Options seen in the literature | My study |
| --- | --- | --- |
| **What** the person must do | read info · see a recommendation · decide first · answer a question · do a task (trace, explain, fix) | answer one behaviour question (predict, can run the code) |
| **Strength** | passive notice · soft stop (acknowledge to continue) · hard stop (cannot continue) | hard stop: the agent waits |
| **Who triggers it** | immediate · negotiated · mediated (rules decide) · scheduled (McFarlane) | mediated by the study (decision point set by hand) |
| **Frequency** | every action · per task · rare, targeted | once per feature |
| **Timing** | before vs. after the AI output · at which subtask boundary | **the factor: END · DECISION · OTHER STEP** |

## By domain

### AI-assisted decision-making (HCI / CSCW / IUI)

- **Buçinca, Malaya & Gajos 2021** (CSCW) ✓: cognitive forcing (on demand, decide first then update, wait) reduces
  over-reliance vs. simple explainable AI; the most effective designs were liked least; high need-for-cognition people
  benefit more.
- **Gajos & Mamykina 2022** (IUI) ✓: recommendation + explanation improves decisions but produces no learning; "decide
  first, then see AI" also no learning; **explanation only, no recommendation** → better decisions and learning. Again
  larger gains for high need for cognition. → *What the person must do matters more than what they see.*
- **Danry et al. 2023** (CHI, n ≈ 200) ✓: AI that **asks a question** instead of explaining ("does it follow that…?")
  improves discernment of flawed logic more than causal explanations. → Supports a question over a plain diff.
- **Ghosh et al. 2026** ✓ (see `citations.md`): questions about assumptions reduce over-reliance most.
- Related, (unverified): Park et al. 2019 "slow algorithm" (waiting improves judgement); Rastogi et al. 2022 (time
  allocation and anchoring); Vasconcelos et al. 2023 (explanations reduce over-reliance when verifying is cheap).

### Programming with AI

- **Kazemitabaar et al. 2025** (IUI, arXiv:2410.08922) ✓ full text read 18.11.2026: seven "cognitive engagement
  techniques" for AI-generated code (type-over, code puzzle, find injected bugs, pseudo-code, explain before use,
  lead-and-reveal, trace-and-predict), placed in a design space of **Bloom level × ICAP engagement × engagement timing**
  (Engage & Reveal vs. Reveal & Engage). Trace-and-predict is "Apply | Constructive | Reveal & Engage", like my
  behaviour question.
  - Study 1 (between, N = 82): no technique beat the baseline significantly. Lead-and-reveal had the highest mean
    (58.3 vs. 31.5, p = .058, Bonferroni α = .007), then code puzzle and trace-and-predict (54.1 each). Underpowered:
    153 needed for 90 % power.
  - Study 2 (within, N = 42, counterbalanced, V2 of both): no performance difference (Friedman p = .150; means
    trace-and-predict 64.3, baseline 57.6, lead-and-reveal 55.0). Lead-and-reveal: only significant perceived/actual
    ability alignment (r = .26), task load like the baseline, 1.82× time. Trace-and-predict: highest task load
    (TLX 67.1 vs. 58.9) and temporal demand, 2.66× time; 15 participants reluctant to use it.
  - Line-level tracing was too easy, so V2 asks about blocks and adds an explanation.
  - Limits: novices in a data-structures course, Python algorithms, AI code assumed correct (no flaws), outcome is
    transfer to isomorphic manual tasks, not understanding of the same code. Study 2 reports N = 30 in one Friedman
    test although 42 were recruited.
  - Discussion (7.2.2–7.2.3): when AI decides for the programmer, they should reflect on the decisions; friction could
    suit productivity settings; lead-and-reveal "could be designed to incorporate intervention points that allows users
    to progressively verify and correct the AI's output".
  → *Closest relative of my behaviour question; they vary the technique, I vary the place.*
- **Kazemitabaar et al. 2024** (UIST) ✓: data analysis with AI; **Stepwise** (intervention points per step with
  editable assumptions) and **Phasewise** (assumptions → plan → code) vs. a chat baseline: more control, easier
  verification; no difference in task success. In 31 of 108 episodes people declared success with issues left. →
  *Decomposition creates intervention points; which point matters was not tested.*
- **Shen & Tamkin 2026** ✓ (see `citations.md`): AI use lowers quiz-measured understanding (17 %).
- **Wu et al. 2026** ✓: developers want agents to pause on ambiguity (57 %) and before critical code (65 %).

### Interruption research (HCI)

- **McFarlane 2002** (HCI journal, n = 36) ✓: four ways to coordinate an interruption: immediate, negotiated,
  mediated, scheduled. Negotiated best overall; immediate best only when timeliness is critical. → *My pause is
  mediated (the system decides when); negotiated ("pause available, you choose") is a natural alternative.*
- **Iqbal & Bailey 2006** (CHI) ✓: interruption cost depends on which subtask boundary; predictable from task
  structure. (Roles flipped compared to my study.)
- (unverified) Adamczyk & Bailey 2004, "If not now, when?": interrupting at boundaries reduces annoyance and
  frustration.

### Security warnings (usable security)

- **Egelman, Cranor & Hong 2008** (CHI, n = 60) ✓: **active** (blocking) phishing warnings were heeded by 79 %,
  the passive one by only one participant. People who had seen similar warnings before ignored them more
  (habituation). → *Blocking works, but repetition wears it down: argument for one targeted pause.*
- (unverified) Anderson et al. 2015/2016: habituation to warnings visible in fMRI; polymorphic warnings slow it.

### Clinical decision support (medicine)

- **Powers et al. 2018** (JAMIA, systematic review, 32 studies) ✓: **hard-stop** alerts improved health outcomes
  in 79 % and process outcomes in 88 % of studies that measured them (as given in the abstract); hard stops beat
  soft stops in 3 of 4 comparisons. Unintended consequences: workarounds, more alerts, delayed care. Good user
  experience only with heavy user involvement and iterative design. → *Closest analogue to a blocking pause:
  effective, but acceptance and workarounds are the risk.*
- Alert fatigue: clinicians override most interruptive alerts (unverified figures; often cited as 49–96 %).

### Automation and supervisory control (human factors)

- (unverified) Parasuraman & Manzey 2010: complacency and automation bias grow with reliability and workload.
- (unverified) Takeover requests in automated driving (e.g. Gold et al. 2013): **how early** the system hands back
  control changes takeover quality. → *A timing question in another domain: when to bring the human back in.*

### Design friction (HCI)

- (unverified) Cox et al. 2016, "Design frictions for mindful interactions": small deliberate obstacles
  (microboundaries) can prompt reflection instead of automatic action.

## What this means for the thesis

1. **Every domain finds the same trade-off:** stronger interventions work better but get disliked, worked around or
   habituated to (Buçinca, Powers, Egelman). So frequency and targeting matter, which is an argument for one pause at
   a reasoned place.
2. **What people must do matters:** active tasks and questions beat plain information (Gajos & Mamykina, Danry,
   Kazemitabaar 2025). That supports the behaviour question.
3. **Timing exists as a dimension but is rarely the tested factor:** Kazemitabaar names "engagement timing" as
   before vs. after the reveal; interruption research studies *which boundary*; driving studies *how early*. Nobody
   tested *which point in an agent's work* to stop at. That is the gap.
4. **Open design alternatives** for later studies: negotiated pause (McFarlane), naming the decision instead of
   showing the diff, lead-and-reveal style questions *before* the code.

## One sentence for the discussion

> Across domains, from phishing warnings to clinical hard stops to AI decision aids, the finding is the same: blocking
> and active tasks work, but people dislike them and get used to them. So the question is less whether to intervene
> and more where. That's the part nobody has tested for coding agents.
