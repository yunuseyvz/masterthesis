# Intervention Timing: Evidence That Timing Matters, and Theory for Decision Points

Research date: 20 November 2026. Scope: experiments that varied *when* an intervention, advice, review prompt or AI involvement occurred. Verified = I opened the paper or a publisher/index record in this session. Snippet-level = only a search-result excerpt was seen; treat as unverified until the full text is read.

Already known (from the thesis archive, not re-listed as new): Iqbal & Bailey 2006, Adamczyk & Bailey 2004, Horvitz 1999, Buçinca et al. 2021, Kazemitabaar et al. 2025, Parnin & Rugaber 2009/2010, Züger & Fritz 2015. McFarlane 2002 and Gold et al. 2013 were not re-checked here.

## Key question 1: AI-assisted decision making, timing of advice or of the human's own judgement

### Takeaway
Two recent randomized experiments vary whether the person commits to their own judgement before the AI advice appears. Both find that the sequence changes reliance, but in opposite directions for correct and incorrect advice. Judging first protected against misleading advice in one study. Delaying advice to a conditional trigger reduced overreliance but also cost correct-advice acceptance in the other. Neither studied a coding agent.

### Cited Findings
- Independent judgement before AI advice: N = 240 preservice teachers randomized to three arms (judge-then-AI, AI-then-judge, no AI); 218 kept in the main analysis. With misleading recommendations, judge-then-AI had higher expert-keyed joint accuracy, OR = 1.912, 95% CI [1.413, 2.589], p < .001. With expert-keyed recommendations the difference was not significant, OR = 0.821, 95% CI [0.598, 1.128], p = .225. — [Frontiers in Psychology 17:1936522, 2026, doi:10.3389/fpsyg.2026.1936522 (first author not confirmed; PMC13655004)](https://pmc.ncbi.nlm.nih.gov/articles/PMC13655004) — verified full text.
- Same study: the judge-first group was less likely to reproduce a misleading recommendation completely, OR = 0.403, 95% CI [0.296, 0.549]. — [same source](https://pmc.ncbi.nlm.nih.gov/articles/PMC13655004) — verified.
- Same study, important caveat from the authors: the sequence manipulation "also differed in whether participants generated a pre-AI response, formed an initial commitment, and encountered a neutral review stage. The experiment therefore estimates the effect of the independent-first versus recommendation-first procedure as implemented, rather than an isolated temporal-distance effect." — [same source](https://pmc.ncbi.nlm.nih.gov/articles/PMC13655004) — verified.
- Same study: the authors name a competing mechanism, that an early judgement creates commitment and so anchoring or confirmation bias may reduce revision even when advice is correct. Not measured. — [same source](https://pmc.ncbi.nlm.nih.gov/articles/PMC13655004) — verified.
- Same study design details: recommendation quality varied within subjects (6 expert-keyed, 6 misleading, fixed order, so item order is confounded with position); AI texts were GPT-4 drafts revised by the researcher; analysis plan not preregistered; post-test without AI after about two weeks was exploratory (n = 192 analysed, 12.5% attrition). — [same source](https://pmc.ncbi.nlm.nih.gov/articles/PMC13655004) — verified.
- Face matching, three pre-registered online experiments (Prolific, Germany; N not extracted for Exp. 1a/1b). Concurrent advice was compared with on-demand advice and with conditional advice (shown only when the first unaided decision contradicts the AI). Overall performance did not differ between concurrent and non-concurrent conditions in Exp. 1. — [Cognitive Research: Principles and Implications, published 5 Feb 2026, doi:10.1186/s41235-026-00707-z](https://link.springer.com/article/10.1186/s41235-026-00707-z) — verified.
- Face matching, Exp. 2 (N = 86 analysed of 88; 120 trials, three within-subject blocks, AI accuracy 92.5%): conditional advice gave 93.17% accuracy vs 92.5% for AI alone (marginal, not significant). Performance with conditional and concurrent advice did not differ overall. Conditional advice was better when the AI was correct and worse when it was incorrect, partly because cases where the first decision matched the wrong AI prediction never triggered advice. — [same source](https://link.springer.com/article/10.1186/s41235-026-00707-z) — verified.
- Face matching, abstract: "participants were less likely to follow AI advice when presented after their initial unaided decision contradicted the AI prediction," and "non-concurrent paradigms have potential to reduce overreliance, but at the cost of underreliance on correct advice." — [same source](https://link.springer.com/article/10.1186/s41235-026-00707-z) — verified.
- Face matching, internal inconsistency I did not resolve: the Exp. 2 results paragraph gives underreliance on correct advice as 5.58% vs 4.01% and says both figures are "significantly lower in the conditional advice condition". That reads opposite to the abstract's claim of more underreliance. The column order in the text is ambiguous. Check Fig. 6b before citing a number. — [same source](https://link.springer.com/article/10.1186/s41235-026-00707-z) — verified text, unresolved.
- Working paper (CESifo WP 10518), snippet only: people may use algorithmic advice "significantly more" when it is presented before they form their own belief, because they can look for evidence. — [CESifo Working Paper 10518](https://cesifo.org/DocDL/cesifo1_wp10518.pdf) — snippet-level, not read.
- Rastogi et al. 2022 (CSCW/PACM HCI, doi:10.1145/3512930): allocating more decision time reduced anchoring on AI advice. This varies decision time, not advice timing, so it is only tangential. — [Rastogi et al. 2022](http://krvarshney.github.io/pubs/RastogiZWVDT_cscw2022.pdf) — snippet-level.

### Inferences
- The strongest direct evidence that *when the human commits* matters is the judge-first effect in the preservice-teacher study. It is one study, and it is a scenario task with a fixed order and no preregistration. Treat it as a hypothesis-generating result with a clear mechanism, not as settled.
- The face-matching results suggest a general trade-off. Any delay or conditional gating that reduces overreliance also reduces acceptance of correct advice. For the thesis, a pause that is not conditional on the agent's output avoids that trade-off but may not reduce overreliance by itself.
- For the thesis: the preservice-teacher study's caveat is directly useful. A "pause before the decision is shown" and a "pause after" differ in more than timing (commitment, neutral review). The thesis should keep the pause identical across conditions and vary only the position.

### Gaps
- No study found that varies the timing of a reflection prompt or review pause within an AI coding-agent workflow.
- Exp. 1a/1b sample sizes and the author list of the Frontiers 2026 preservice-teacher study were not extracted from the full text. Check before citing.
- Full-text reading of the CESifo working paper was not done.

## Key question 2: Programming and AI-generated code, timing of engagement

### Takeaway
The closest precedent for the thesis's before/after manipulation is Kazemitabaar et al. 2025 (already known), which varied whether a cognitive engagement task came before or after the AI code was revealed. I did not extract its outcome numbers in this session. I found no new programming study that varies the timing of a review step relative to an agent's decision.

### Cited Findings
- Kazemitabaar et al. (arXiv 2410.08922 version): seven cognitive engagement techniques, each placed "either before or after revealing the AI-generated code" (engage-then-reveal vs reveal-then-engage). — [arXiv 2410.08922](https://arxiv.org/html/2410.08922v1) — snippet-level for the design; the outcome numbers were not re-read here.
- Ma et al. 2024, "Breaking the Flow: A Study of Interruptions During Software Engineering Activities" (ICSE 2024, doi:10.1145/3597503.3639079): in-person and on-screen interruptions, combined, "significantly affect the time spent on code review". — [ACM DL](https://dl.acm.org/doi/pdf/10.1145/3597503.3639079?utm_source=consensus) and [luneresearch summary](https://luneresearch.com/papers/7288faec-24a1-403b-9a7e-8b8ea5d55aa5) — snippet-level. The interruption was of programming work in general, not of a review of agent output. Medium relevance for the review-interruption link.
- Mozannar et al. 2024 (AAAI, "When to Show a Suggestion?") is listed in the archive as "learning when to show suggestions". Not checked here.

### Inferences
- Kazemitabaar's before/after reveal manipulation is the closest design to a timing study in this area, and the thesis should cite it as the precedent for the variable, not as evidence that the moment matters.
- Ma et al. 2024 supports the claim that interruptions of code review cost time, which fits the idea that review is interruptible in a measurable way. It does not test a boundary or a decision point.

### Gaps
- Kazemitabaar 2025's outcome numbers for timing are not extracted. Read the full text before citing any effect size.
- No study found that compares reviewing an agent's output after a consequential decision with reviewing it at the end.

## Key question 3: Interruption research, task boundaries and breakpoints (2015–2026, programmers and reviewing)

### Takeaway
The best recent evidence (Hirsch et al. 2025) supports the "subtask boundary is cheap" claim only partly. Interruptions were most costly before the third of six subtasks, and the cost at the second boundary was not higher than at the fourth. The cost depends on the task's hierarchy, not on whether a boundary exists. The older Adamczyk & Bailey and Iqbal & Bailey results are still the basis for the boundary claim. None of these papers studies programmers reviewing agent output.

### Cited Findings
- Hirsch et al. 2025, "Opportune moments for task interruptions: examining the cognitive mechanisms underlying interruption-timing effects", Frontiers in Psychology 15:1465323, doi:10.3389/fpsyg.2024.1465323. Lab study, N = 42 in the analysis after exclusions (some tests report df = 43, so the count should be checked). Six speeded categorization subtasks in a fixed sequence, arranged as two lag-2 triplets. Interruptions occurred before subtask 2, 3 or 4, lasting 2 s or 4 s (between-subjects). Result: resumption costs were higher for interruptions before subtask 3 than before subtasks 2 and 4. The interruption-position effect did not differ between repetition and switch sequences. Long interruptions increased resumption cost only marginally. Interruptions increased sequence errors but not non-sequence errors. — [PMC11775001](https://pmc.ncbi.nlm.nih.gov/articles/PMC11775001/) — verified full text.
- Hirsch et al. 2025 on theory: the authors cite Adamczyk & Bailey's coarse vs fine breakpoints (coarse breakpoints predicted to cost less because the next chunk must be identified and retrieved). They say that subtask boundaries are the likely lowest-workload points and that "task models should consider the cognitive operation during different moments of the task". — [PMC11775001](https://pmc.ncbi.nlm.nih.gov/articles/PMC11775001/) — verified.
- Iqbal, Adamczyk, Zheng & Bailey 2005 (CHI, doi:10.1145/1056808.1056948): interrupting at moments predicted to have low mental workload gave less resumption lag and annoyance. Outside the 2015–2026 window, but directly relevant. — [ACM DL](https://dl.acm.org/doi/10.1145/1056808.1056948) — snippet-level.
- Adamczyk & Bailey 2004 (already known): the archive note records no effect on resumption lag. Hirsch et al. 2025 restate the same result, so it is confirmed in a second source.

### Inferences
- Hirsch et al. weaken the simple version of the boundary claim. A decision point in the thesis should be defined by the dependency structure of the work (later steps build on it), not by "any subtask boundary". This is a reason to make the decision point's position in the hierarchy explicit in the design.
- Hirsch et al. use speeded categorization, not comprehension of code. Their timing effect is a performance cost, and the thesis's outcome is understanding. Transfer is an inference.

### Gaps
- Replication: the archive lists Poreba & Sobernig 2026 as a replication of Züger & Fritz. Not checked in this session. Check before saying the interruptibility work still replicates.
- No 2015–2026 study was found that interrupts programmers at task boundaries to review AI output.

## Key question 4: Automation and handover, when to hand control back

### Takeaway
Takeover-request lead time has a well-studied effect on driver situation awareness (SA), and the effect levels off at about 16–30 s in one web-based study. The variable is lead time before a handover, not the position of a review within a task, so the transfer to a pause in a coding agent is weak.

### Cited Findings
- Tan et al. 2022 (ScienceDirect S0001457522000299): web-based study of Level-3 automated vehicles, with 12 takeover-request lead times from 6 to 60 s (randomized). Longer lead times improved driver SA for resuming control to exit a freeway. The effect levelled off at 16–30 s, and participants postponed takeover further when given more lead time. — [PubMed 35180465](https://pubmed.ncbi.nlm.nih.gov/35180465) — snippet-level abstract; full text not read.
- Zhang et al. 2019 meta-analysis of 129 experimental studies on takeover time. Cited in a 2020 paper; not checked at source. — [Take over! video-clip study, ScienceDirect S1369847820304356](https://sciencedirect.com/science/article/pii/S1369847820304356) — snippet-level, secondary.
- Wan et al. 2026 (TSE, tdaf028): longer intervals between monitoring and takeover requests improved takeover performance and SA. — [OUP](https://academic.oup.com/tse/article/8/2/tdaf028/8262254) — snippet-level.

### Inferences
- The lesson that transfers is that the handover moment should give enough time to rebuild situational awareness. In the thesis, a pause that sits right after a decision gives the person the context of that decision. This is an analogy, not a finding about code review.

### Gaps
- No driving or supervisory-control study was found that varies handover timing relative to a sequence of decisions, as opposed to the lead time before an event.
- Gold et al. 2013 (already known in the archive) was not re-checked here.

## Key question 5: Theory, why a decision point might be a good moment to review

### Takeaway
The best-supported theory here is event segmentation. Boundaries in an ongoing task regulate attention and memory, so a review placed at a boundary should be encoded more deeply. This is well-established for perception and memory. Applying it to code review after an agent's decision is an inference. The claim that early review reduces error-propagation cost has no source found in this session.

### Cited Findings
- Zacks, Speer, Swallow, Braver & Reynolds 2007, "Event perception: A mind-brain perspective", Psychological Bulletin 133(2), 273–293. The theory proposes that perception of event boundaries "arises from ongoing perceptual processing and regulates attention and memory." — [APA record](https://psycnet.apa.org/record/2007-02367-005) and [PubMed 17338600](https://pubmed.ncbi.nlm.nih.gov/17338600/) — verified citation and abstract statement. DOI not confirmed in this session.
- Hirsch et al. 2025 explain chunking of six subtasks into two triplets with hierarchical task models and "memory for goals" (Altmann & Trafton 2002, in the archive, not checked). Their interpretation is that resumption cost comes from memory-based processes, not general attention. — [PMC11775001](https://pmc.ncbi.nlm.nih.gov/articles/PMC11775001/) — verified.
- The Frontiers 2026 preservice-teacher study proposes two competing pathways. Protection: an initial judgement creates a comparison standard. Harm: commitment to the first judgement increases anchoring. — [PMC13655004](https://pmc.ncbi.nlm.nih.gov/articles/PMC13655004) — verified.

### Inferences
- Event segmentation predicts that a review at the end of a decision's chunk is encoded as a new event, so its content is more memorable. This does not by itself predict better understanding.
- The commitment pathway predicts the opposite risk for a pause placed right after a decision. If the person has already accepted the agent's choice, the pause may only confirm it. The thesis should measure whether the pause changes the choice, not only whether it is answered.
- An error-propagation account (a defect found early is cheaper to fix because later steps build on it) is plausible for code, but I found no empirical source in this session. Do not cite the software-engineering cost-of-change literature for this claim without checking it.

### Gaps
- No source found for the error-propagation or early-defect-detection argument in an AI-coding context.
- Kurby & Zacks 2008 (event segmentation and memory) was not checked. It would be the next source to verify.
- Zacks 2007 DOI was not confirmed; get it from the publisher before citing.

## Ranking

| Finding | Relevance | Reason |
|---|---|---|
| Preservice-teacher study, judge-first vs AI-first (Frontiers 2026) | High | Direct manipulation of when a person commits relative to AI advice, with a sizable effect for misleading advice. Its confound (commitment, neutral review) is the same issue the thesis faces. |
| Face matching 2026, concurrent vs conditional advice (Cognitive Research) | High | Three pre-registered experiments varying when advice appears; shows the overreliance vs correct-advice trade-off. |
| Hirsch et al. 2025, interruption timing in a six-subtask sequence | High | Recent, theory-driven timing manipulation; shows boundaries are not uniformly cheap, which bears on defining a decision point. |
| Kazemitabaar et al. 2025, before vs after reveal | High (already known) | The closest programming precedent for the variable. Outcome numbers still to be read. |
| Zacks et al. 2007, event perception | High | Gives the mechanism for why a boundary may help encoding. |
| Ma et al. 2024, Breaking the Flow (ICSE) | Medium | Interruptions cost code-review time in software work; does not test boundaries. |
| Iqbal et al. 2005, opportune moments (CHI) | Medium | Predicted low-workload moments; older and outside the window, but directly on point. |
| Tan et al. 2022, takeover lead time and SA | Medium-low | Relevant to handover, but the manipulation is lead time before an event, not position within a task. |
| Wan et al. 2026, takeover intervals | Low | Snippet only; same logic as Tan et al. |
| Rastogi et al. 2022, decision time and anchoring | Low | Varies decision time, not advice timing. |
| CESifo WP 10518, advice-first | Low-medium | Working paper, snippet only; relevant if verified. |

## Not yet done
- Read the full text of Kazemitabaar et al. 2025 for the timing outcome numbers.
- Check the Poreba & Sobernig 2026 replication and Mozannar et al. 2024 (both in the archive).
- Resolve the underreliance column inconsistency in the face-matching Exp. 2 results.
- Verify the Zacks 2007 DOI and the CESifo working paper.
