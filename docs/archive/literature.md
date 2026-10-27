# Related Literature: Knowing When to Pause

**Compiled:** 18 October 2026 · **For:** the exposé in [`expose.md`](expose.md) (pair-programming-driven verification checkpoints, parallel System-1 review, agentic coding)

**Sources:** the old material in `archive/` (`literature-links.md`, `literature-matrix.md`, `literature-audit.md`, `literature-with-dois.md`) plus new searches for the gaps (pair programming, interruption timing, agent oversight and monitoring).

**Verification:** every entry's DOI or arXiv ID was resolved against Crossref / the arXiv API, and the author, year, title and venue shown come from those records. The _Role_ lines are my short annotations, based on titles, abstracts and the earlier archive notes. **I have not read the full texts**, so check a paper before you cite a specific claim or number from it. Blogs, surveys and industry reports are marked as such and have no DOI.

## Where to start (core 15)

| Need | Read first |
|---|---|
| Why checkpoint timing matters | Dhanorkar et al. 2026 (§7), Ye et al. 2026 (§7), Yu et al. 2026 (§7) |
| What navigators do and when | Bryant et al. 2008, Plonka et al. 2015, Zieris & Prechelt 2016 (§2) |
| Review is about understanding; size hurts | Bacchelli & Bird 2013, Gullstrand Heander et al. 2026, di Biase et al. 2019 (§4) |
| What the gate should contain | Buçinca et al. 2021, Ghosh et al. 2026, Sovrano et al. 2026 (§5) |
| When to interrupt | Horvitz 1999, Iqbal & Bailey 2006, Chen et al. 2025 "Need Help?" (§6) |
| How to measure it | Schoeffer et al. 2025, Stanislaw & Todorov 1999 (§9) |

## Corrections to the exposé's reference list

| Item | Problem | Fix |
|---|---|---|
| Mozannar et al., CHI 2024 | DOI `10.1145/3613904.3642936` is wrong | Use `10.1145/3613904.3641936` (§3) |
| Sovrano, Dominici & Bacchelli, FSE 2026 | DOI `10.1145/3715740` points to an unrelated paper (adaptive random testing); the title "Mitigating cognitive biases in AI-assisted software engineering" also differs from the record | Use `10.1145/3808115`, "Mitigating Prompt-Induced Cognitive Biases in General-Purpose AI for Software Engineering" (§5) |
| Hart & Staveland | Title and year don't match the DOI: `10.1177/154193120605000909` is the 2006 retrospective ("NASA-TLX: 20 years later"), not "Development of NASA-TLX" | Pick one: the 1988 original (§10) or the 2006 paper |
| Gullstrand Heander et al., EMSE 2026 | Title in the exposé ("A model of reviewer cognition") differs from the record | Use the Crossref title (§4) |
| Faros AI Engineering Report 2026, Sonar State of Code 2026 | Cited in the exposé; I found no stable link or DOI | Add the URL or a PDF snapshot before citing |

## Checked against the full texts (18 October 2026)

Fourteen PDFs from `papers/` were read. "Page" refers to the PDF's own pagination.

| Paper | What the full text confirms | What it limits |
|---|---|---|
| **Bryant et al. 2008** (IJHCS) | Abstract and discussion: the navigator is *not* a constant reviewer (syntax-level utterances were scarce, 53% navigator vs 47% driver) and does not work at a different abstraction level; both partners speak most about blocks of the program; "tag team" model. | Opportunistic sample of XP pairs, verbal protocols only. The "intermediate-level talk" explanation is a hypothesis; the authors say further work is needed. |
| **Plonka et al. 2015** (IJHCS) | Six teaching strategies, "giving direct instructions" to "subtle hints"; roles of driver and navigator influence knowledge transfer. | Focus is expert–novice knowledge transfer. It contains no account of *when* to intervene (the word appears once, inside a quoted utterance). |
| **Zieris & Prechelt 2016** (ICSE '16 *Companion*) | Even expert pairs transfer knowledge; patterns RESYNC and PARALLEL (common understanding needs extra synchronisation). One session shows a pair discussing intended behaviour when the ticket stated no requirements. | Short companion paper; qualitative; findings illustrated with a single 2 h 19 min session; frequencies not estimated. |
| **Adamczyk & Bailey 2004** (CHI) | Moments predicted between *coarse breakpoints* gave lower annoyance, frustration, time pressure and effort and higher "respect" than worst or random moments. | 16 participants; tasks: editing, media, web search; **no** significant effect on task time or resumption lag. |
| **Iqbal & Bailey 2006** (CHI) | Interrupting at subtask boundaries gives a lower cost of interruption (resumption lag) than non-boundary moments; boundaries differ by workload; a model predicts cost class. | Goal-directed lab tasks, not programming or review. The paper does not use "coarse" as its own term. |
| **Dhanorkar et al. 2026** (FAccT) | 17 interviews; four forms of oversight (a priori control, co-planning, real-time monitoring, post hoc review); Heuristic 2 "Passing test results guarantee the correctness of agent-generated code"; "heuristics that prioritize efficiency over perfection". | Developers decomposed tasks into small chunks and often skipped real-time monitoring, so huge unreviewed batches may be less common than assumed. No pause or checkpoint design is studied. |
| **Mu et al. 2024** (ClarifyGPT, FSE) | States that LLMs directly generate code from unclear requirements instead of asking; a clarification framework raises Pass@1 (GPT-4: 70.96% to 80.80% on MBPP-sanitized). | Function-level benchmarks. The "LLMs rarely ask" sentence is an assertion in the introduction, citing other work. |
| **Yang et al. 2026** (Orchid, ASE '26; DOI `10.1145/3832783.3834403`) | 1,304 function-level tasks with four ambiguity types; ambiguity degrades all evaluated LLMs; models produce functionally divergent implementations and cannot identify or resolve ambiguity autonomously. | Function-level, not ticket-level. |
| **Tao et al. 2012** (FSE) | Engineers seek correctness, completeness, consistency, risk and "most importantly the rationale" of a change; decomposing composite changes into sub-changes per development issue is valuable. | About changes in general at Microsoft, not agent output. |
| **Rigby & Bird 2013** (FSE) | Convergent practice: small independent changes (median 25 to 44 lines in Apache, Linux, Android, AMD; Chrome 78; Bing, Office, SQL larger but unspecified; Lucent inspection 263), review just before commit, knowledge sharing (66% to 150% more files known). | Descriptive; no effectiveness claim for small changes. |
| **Fucci et al. 2017** (TSE) | 39 professionals, 82 data points: shorter, more uniform test-code cycles associated with higher quality and productivity; test-first order had no important influence. | TDD, not reviewing. |
| **Inozemtseva & Holmes 2014** (ICSE) | 31,000 test suites, five Java systems: coverage correlates low to moderately with effectiveness once size is controlled; useful to find under-tested parts, not as a quality target. | Java, generated suites. |
| **Jia & Harman 2011** (TSE) | Defines the mutation adequacy score as a measure of how well a test set detects faults. | Survey. |
| **Herzig & Zeller 2013** (MSR) | Up to 15% of bug fixes are tangled changes; they bias analyses of version histories. | **Does not support** claims about review; do not cite it for that. |

**Not yet checked against full texts:** Chong & Hurlbutt 2007, Bacchelli & Bird 2013, Sadowski et al. 2018, Gullstrand Heander et al. 2026, di Biase et al. 2019, Baum et al. 2019, Ghosh et al. 2026, Ye et al. 2026, Yu et al. 2026, Buçinca et al. 2021, Li et al. 2026, Danry et al. 2023, Sovrano et al. 2026.

---

## 1. Foundational Work: Automation, Reliance, Dual-Process and Cognitive Load

_Theory the thesis builds on: why humans over-/under-rely on automation, and the cognitive limits behind it._

- Lee, J. D., & See, K. A. (2004). **Trust in Automation: Designing for Appropriate Reliance.** Human Factors: The Journal of the Human Factors and Ergonomics Society. <https://doi.org/10.1518/hfes.46.1.50_30392>  
  _Role:_ Canonical appropriate-reliance framework (calibration, resolution, specificity).
- Parasuraman, R., & Riley, V. (1997). **Humans and Automation: Use, Misuse, Disuse, Abuse.** Human Factors: The Journal of the Human Factors and Ergonomics Society. <https://doi.org/10.1518/001872097778543886>  
  _Role:_ Use / misuse / disuse / abuse of automation.
- Parasuraman, R., Sheridan, T., & Wickens, C. (2000). **A model for types and levels of human interaction with automation.** IEEE Transactions on Systems, Man, and Cybernetics - Part A: Systems and Humans. <https://doi.org/10.1109/3468.844354>  
  _Role:_ Types and levels of automation; frame for how much autonomy the agent gets and where the human sits.
- SKITKA, L. J., MOSIER, K. L., & BURDICK, M. (1999). **Does automation bias decision-making?.** International Journal of Human-Computer Studies. <https://doi.org/10.1006/ijhc.1999.0252>  
  _Role:_ Automation bias: commission and omission errors.
- Mosier, K. L., Skitka, L. J., Heers, S., & Burdick, M. (1998). **Automation Bias: Decision Making and Performance in High-Tech Cockpits.** The International Journal of Aviation Psychology. <https://doi.org/10.1207/s15327108ijap0801_3>  
  _Role:_ Automation bias in cockpits; the 'verify vs. trust' tension.
- Hoff, K. A., & Bashir, M. (2014). **Trust in Automation: Integrating Empirical Evidence on Factors That Influence Trust.** Human Factors: The Journal of the Human Factors and Ergonomics Society. <https://doi.org/10.1177/0018720814547570>  
  _Role:_ Trust-in-automation review.
- Green, B., & Chen, Y. (2019). **The Principles and Limits of Algorithm-in-the-Loop Decision Making.** Proceedings of the ACM on Human-Computer Interaction. <https://doi.org/10.1145/3359152>  
  _Role:_ Algorithm-in-the-loop decision making; limits of 'human in the loop' as a safeguard.
- Bansal, G. et al. (2021). **Is the Most Accurate AI the Best Teammate? Optimizing AI for Teamwork.** Proceedings of the AAAI Conference on Artificial Intelligence. <https://doi.org/10.1609/aaai.v35i13.17359>  
  _Role:_ Optimising AI for the team rather than for accuracy alone.
- Bansal, G. et al. (2021). **Does the Whole Exceed its Parts? The Effect of AI Explanations on Complementary Team Performance.** Proceedings of the 2021 CHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/3411764.3445717>  
  _Role:_ Explanations did not yield complementary team performance.
- Evans, J. S. B. T., & Stanovich, K. E. (2013). **Dual-Process Theories of Higher Cognition: Advancing the Debate.** Perspectives on Psychological Science. <https://doi.org/10.1177/1745691612460685>  
  _Role:_ System 1 / System 2 critique and refinement; grounding for the 'System-1 reviewer' framing.
- Kahneman, D., & Frederick, S. (2002). **Representativeness Revisited: Attribute Substitution in Intuitive Judgment.** Heuristics and Biases. <https://doi.org/10.1017/cbo9780511808098.004>  
  _Role:_ Attribute substitution (Kahneman & Frederick); intuitive judgement as System 1.
- Sweller, J. (1988). **Cognitive Load During Problem Solving: Effects on Learning.** Cognitive Science. <https://doi.org/10.1207/s15516709cog1202_4>  
  _Role:_ Cognitive load theory; why large diffs overload the reviewer.
- Kahneman, D. (2011). **Thinking, Fast and Slow.** Farrar, Straus and Giroux (book). <https://us.macmillan.com/books/9780374533557/thinkingfastandslow>  
  _Role:_ Popular System 1 / System 2 reference (book, no DOI).
- Passi, S., & Vorvoreanu, M. (2022). **Overreliance on AI: Literature Review.** Microsoft Research Tech Report MSR-TR-2022-12. <https://www.microsoft.com/en-us/research/project/fostering-appropriate-reliance-on-ai/publications>  
  _Role:_ Overview of overreliance research.
- Vorvoreanu, M., Passi, S., Dhanorkar, S., Heger, A., & Walker, K. (2025). **Fostering Appropriate Reliance on GenAI: Lessons Learned from Early Research.** Microsoft Research Tech Report MSR-TR-2025-4. <https://www.microsoft.com/en-us/research/wp-content/uploads/2025/03/Appropriate-Reliance-Lessons-Learned-Published-2025-3-3.pdf>  
  _Role:_ Update on GenAI-specific reliance.

## 2. Pair Programming Literature (Human-Human)

_Evidence for what navigators do, when and why they intervene, and when pairing pays off. Core of the supervisor's 'wann andere intervenieren' request._

- Williams, L., Kessler, R., Cunningham, W., & Jeffries, R. (2000). **Strengthening the case for pair programming.** IEEE Software. <https://doi.org/10.1109/52.854064>  
  _Role:_ Early empirical case for pairing (quality, time).
- Williams, L. A., & Kessler, R. R. (2000). **All I really need to know about pair programming I learned in kindergarten.** Communications of the ACM. <https://doi.org/10.1145/332833.332848>  
  _Role:_ Practitioner account of pairing practice.
- Hannay, J. E., Dybå, T., Arisholm, E., & Sjøberg, D. I. (2009). **The effectiveness of pair programming: A meta-analysis.** Information and Software Technology. <https://doi.org/10.1016/j.infsof.2009.02.001>  
  _Role:_ Meta-analysis: small quality gain, effort cost; task complexity as moderator.
- Dybå, T. et al. (2007). **Are Two Heads Better than One? On the Effectiveness of Pair Programming.** IEEE Software. <https://doi.org/10.1109/ms.2007.158>  
  _Role:_ Summary of effectiveness evidence.
- Arisholm, E., Gallis, H., Dyba, T., & Sjoberg, D. I. (2007). **Evaluating Pair Programming with Respect to System Complexity and Programmer Expertise.** IEEE Transactions on Software Engineering. <https://doi.org/10.1109/tse.2007.17>  
  _Role:_ Pairing benefits depend on task complexity and expertise.
- Lui, K. M., & Chan, K. C. (2006). **Pair programming productivity: Novice–novice vs. expert–expert.** International Journal of Human-Computer Studies. <https://doi.org/10.1016/j.ijhcs.2006.04.010>  
  _Role:_ Novice/expert pairing productivity.
- Hannay, J., Arisholm, E., Engvik, H., & Sjoberg, D. (2010). **Effects of Personality on Pair Programming.** IEEE Transactions on Software Engineering. <https://doi.org/10.1109/tse.2009.41>  
  _Role:_ Pairing success depends on personality only modestly vs. expertise and task.
- Bryant, S., Romero, P., & du Boulay, B. (2008). **Pair programming and the mysterious role of the navigator.** International Journal of Human-Computer Studies. <https://doi.org/10.1016/j.ijhcs.2007.03.005>  
  _Role:_ Navigator as intermediate-level reviewer; basis for C1-C3 criteria.
- Plonka, L., Sharp, H., van der Linden, J., & Dittrich, Y. (2015). **Knowledge transfer in pair programming: An in-depth analysis.** International Journal of Human-Computer Studies. <https://doi.org/10.1016/j.ijhcs.2014.09.001>  
  _Role:_ Knowledge transfer and why partners speak up.
- Chong, J., & Hurlbutt, T. (2007). **The Social Dynamics of Pair Programming.** 29th International Conference on Software Engineering (ICSE'07). <https://doi.org/10.1109/icse.2007.87>  
  _Role:_ Social dynamics, roles and interruption in pairs.
- Zieris, F., & Prechelt, L. (2016). **Observations on knowledge transfer of professional software developers during pair programming.** Proceedings of the 38th International Conference on Software Engineering Companion. <https://doi.org/10.1145/2889160.2889249>  
  _Role:_ Professional pairs: when and how knowledge transfer / interventions occur.
- Zieris, F., & Prechelt, L. (2014). **On knowledge transfer skill in pair programming.** Proceedings of the 8th ACM/IEEE International Symposium on Empirical Software Engineering and Measurement. <https://doi.org/10.1145/2652524.2652529>  
  _Role:_ Knowledge transfer skill in pair programming.
- Salinger, S., Plonka, L., & Prechelt, L. (2008). **A Coding Scheme Development Methodology Using Grounded Theory for Qualitative Analysis of Pair Programming.** Human Technology: An Interdisciplinary Journal on Humans in ICT Environments. <https://doi.org/10.17011/ht/urn.200804151350>  
  _Role:_ Coding scheme for pair-programming dialogue; usable for coding navigator interventions.
- Plonka, L., Sharp, H., & van der Linden, J. (2012). **Disengagement in pair programming: Does it matter?.** 2012 34th International Conference on Software Engineering (ICSE). <https://doi.org/10.1109/icse.2012.6227166>  
  _Role:_ Disengagement in pairs; what happens when the navigator checks out.

## 3. Human-AI Pair Programming and AI-Assisted Programming

_How developers interact with, trust, and validate code-generating assistants._

- Ma, Q., Wu, T., & Koedinger, K. (2023). **Is AI the better programming partner? Human-Human Pair Programming vs. Human-AI pAIr Programming.** arXiv:2306.05153. <https://arxiv.org/abs/2306.05153>  
  _Role:_ Directly compares human-human pairing with human-AI pairing.
- Imai, S. (2022). **Is GitHub copilot a substitute for human pair-programming: an empirical study.** Proceedings of the ACM/IEEE 44th International Conference on Software Engineering: Companion Proceedings. <https://doi.org/10.1145/3510454.3522684>  
  _Role:_ Copilot vs. a human partner.
- Barke, S., James, M. B., & Polikarpova, N. (2023). **Grounded Copilot: How Programmers Interact with Code-Generating Models.** Proceedings of the ACM on Programming Languages. <https://doi.org/10.1145/3586030>  
  _Role:_ Acceleration vs. exploration modes of use.
- Vaithilingam, P., Zhang, T., & Glassman, E. L. (2022). **Expectation vs. Experience: Evaluating the Usability of Code Generation Tools Powered by Large Language Models.** CHI Conference on Human Factors in Computing Systems Extended Abstracts. <https://doi.org/10.1145/3491101.3519665>  
  _Role:_ Usability; difficulties understanding and debugging generated code.
- Xu, F. F., Vasilescu, B., & Neubig, G. (2022). **In-IDE Code Generation from Natural Language: Promise and Challenges.** ACM Transactions on Software Engineering and Methodology. <https://doi.org/10.1145/3487569>  
  _Role:_ In-IDE generation; promise and challenges.
- Liang, J. T., Yang, C., & Myers, B. A. (2024). **A Large-Scale Survey on the Usability of AI Programming Assistants: Successes and Challenges.** Proceedings of the IEEE/ACM 46th International Conference on Software Engineering. <https://doi.org/10.1145/3597503.3608128>  
  _Role:_ Survey of usability of AI programming assistants.
- Prather, J. et al. (2023). **“It’s Weird That it Knows What I Want”: Usability and Interactions with Copilot for Novice Programmers.** ACM Transactions on Computer-Human Interaction. <https://doi.org/10.1145/3617367>  
  _Role:_ Novice usability and interaction with Copilot.
- Mozannar, H., Bansal, G., Fourney, A., & Horvitz, E. (2024). **Reading Between the Lines: Modeling User Behavior and Costs in AI-Assisted Programming.** Proceedings of the CHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/3613904.3641936>  
  _Role:_ Telemetry-based taxonomy of user states and time costs. NB: the exposé lists DOI ...642936, which is wrong.
- Wang, R., Cheng, R., Ford, D., & Zimmermann, T. (2024). **Investigating and Designing for Trust in AI-powered Code Generation Tools.** The 2024 ACM Conference on Fairness, Accountability, and Transparency. <https://doi.org/10.1145/3630106.3658984>  
  _Role:_ Trust in AI code generation: design implications.
- Sabouri, S. et al. (2025). **Trust Dynamics in AI-Assisted Development: Definitions, Factors, and Implications.** 2025 IEEE/ACM 47th International Conference on Software Engineering (ICSE). <https://doi.org/10.1109/ICSE55347.2025.00199>  
  _Role:_ How trust evolves in AI-assisted development.
- Shah, A. et al. (2025). **Evolution of Programmers' Trust in Generative AI Programming Assistants.** Proceedings of the 25th Koli Calling International Conference on Computing Education Research. <https://doi.org/10.1145/3769994.3770029>  
  _Role:_ Evolution of programmer trust.
- Tang, N. et al. (2024). **Developer Behaviors in Validating and Repairing LLM-Generated Code Using IDE and Eye Tracking.** 2024 IEEE Symposium on Visual Languages and Human-Centric Computing (VL/HCC). <https://doi.org/10.1109/VL/HCC60511.2024.00015>  
  _Role:_ Eye-tracking study of validating/repairing LLM code.
- Ferdowsi, K. et al. (2024). **Validating AI-Generated Code with Live Programming.** Proceedings of the CHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/3613904.3642495>  
  _Role:_ Live programming as validation aid.
- Perry, N., Srivastava, M., Kumar, D., & Boneh, D. (2023). **Do Users Write More Insecure Code with AI Assistants?.** Proceedings of the 2023 ACM SIGSAC Conference on Computer and Communications Security. <https://doi.org/10.1145/3576915.3623157>  
  _Role:_ Users with AI assistants write less secure code and are more confident.
- Alakmeh, T. et al. (2026). **Grasping AI Reliance in Program Comprehension and Coding through the AIRELI Persona Taxonomy.** Proceedings of the 2026 34th IEEE/ACM International Conference on Program Comprehension. <https://doi.org/10.1145/3794763.3794804>  
  _Role:_ Taxonomy of AI-reliance personas in program comprehension.
- Valovy, M. (2025). **Human-AI Programming Role Optimization: Developing a Personality-Driven Self-Determination Framework.** arXiv:2511.00417. <https://arxiv.org/abs/2511.00417>  
  _Role:_ Role assignment (driver / navigator) between human and AI.
- Zhang, H., Cheng, W., Wu, Y., & Hu, W. (2024). **A Pair Programming Framework for Code Generation via Multi-Plan Exploration and Feedback-Driven Refinement.** arXiv:2409.05001. <https://arxiv.org/abs/2409.05001>  
  _Role:_ Navigator / driver split between LLM agents (system, not user study).

## 4. Code Review and Program Comprehension

_Why understanding is the bottleneck of review, and how change size and ordering affect reviewers._

- Bacchelli, A., & Bird, C. (2013). **Expectations, outcomes, and challenges of modern code review.** 2013 35th International Conference on Software Engineering (ICSE). <https://doi.org/10.1109/ICSE.2013.6606617>  
  _Role:_ Understanding, not defect hunting, is review's main challenge.
- Sadowski, C. et al. (2018). **Modern code review: a case study at google.** Proceedings of the 40th International Conference on Software Engineering: Software Engineering in Practice. <https://doi.org/10.1145/3183519.3183525>  
  _Role:_ Review at Google: education, norms, understanding.
- Gullstrand Heander, L., Söderberg, E., & Rydenfält, C. (2026). **Code review as decision-making - building a cognitive model from the questions asked during code review.** Empirical Software Engineering. <https://doi.org/10.1007/s10664-025-10791-2>  
  _Role:_ Cognitive model of reviewer decision making (CRDM).
- Rigby, P. C., & Bird, C. (2013). **Convergent contemporary software peer review practices.** Proceedings of the 2013 9th Joint Meeting on Foundations of Software Engineering. <https://doi.org/10.1145/2491411.2491444>  
  _Role:_ Convergent practices: small, frequent, asynchronous reviews.
- Bosu, A., Greiler, M., & Bird, C. (2015). **Characteristics of Useful Code Reviews: An Empirical Study at Microsoft.** 2015 IEEE/ACM 12th Working Conference on Mining Software Repositories. <https://doi.org/10.1109/msr.2015.21>  
  _Role:_ What makes a review comment useful.
- Beller, M., Bacchelli, A., Zaidman, A., & Juergens, E. (2014). **Modern code reviews in open-source projects: which problems do they fix?.** Proceedings of the 11th Working Conference on Mining Software Repositories. <https://doi.org/10.1145/2597073.2597082>  
  _Role:_ Which problems code review actually finds (mostly evolvability).
- McIntosh, S., Kamei, Y., Adams, B., & Hassan, A. E. (2014). **The impact of code review coverage and code review participation on software quality: a case study of the qt, VTK, and ITK projects.** Proceedings of the 11th Working Conference on Mining Software Repositories. <https://doi.org/10.1145/2597073.2597076>  
  _Role:_ Review participation and software quality.
- Baum, T., Schneider, K., & Bacchelli, A. (2019). **Associating working memory capacity and code change ordering with code review performance.** Empirical Software Engineering. <https://doi.org/10.1007/s10664-018-9676-8>  
  _Role:_ Working memory and change ordering affect review performance.
- di Biase, M., Bruntink, M., van Deursen, A., & Bacchelli, A. (2019). **The effects of change decomposition on code review—a controlled experiment.** PeerJ Computer Science. <https://doi.org/10.7717/peerj-cs.193>  
  _Role:_ Smaller (decomposed) changes review better; supports 'review the 25-line core, not 8,000 lines'.
- Rahman, M. S., Codabux, Z., & Roy, C. K. (2026). **Does Order Matter? An Empirical Investigation into the Impact of File Ordering on Code Review Effectiveness.** arXiv:2609.22610. <https://arxiv.org/abs/2609.22610>  
  _Role:_ File order affects review effectiveness.
- Fagan, M. E. (1976). **Design and code inspections to reduce errors in program development.** IBM Systems Journal. <https://doi.org/10.1147/sj.153.0182>  
  _Role:_ Software inspections (origin).
- Porter, A., Votta, L., & Basili, V. (1995). **Comparing detection methods for software requirements inspections: a replicated experiment.** IEEE Transactions on Software Engineering. <https://doi.org/10.1109/32.391380>  
  _Role:_ Inspection reading techniques.
- Basili, V. R. et al. (1996). **The empirical investigation of Perspective-Based Reading.** Empirical Software Engineering. <https://doi.org/10.1007/bf00368702>  
  _Role:_ Perspective-based reading.
- Jureczko, M., Kajda, Ł., & Górecki, P. (2020). **Code review effectiveness: an empirical study on selected factors influence.** IET Software. <https://doi.org/10.1049/iet-sen.2020.0134>  
  _Role:_ Factors in review effectiveness.
- Von Mayrhauser, A., & Vans, A. (1995). **Program comprehension during software maintenance and evolution.** Computer. <https://doi.org/10.1109/2.402076>  
  _Role:_ Program comprehension models.
- Sillito, J., Murphy, G. C., & De Volder, K. (2006). **Questions programmers ask during software evolution tasks.** Proceedings of the 14th ACM SIGSOFT international symposium on Foundations of software engineering. <https://doi.org/10.1145/1181775.1181779>  
  _Role:_ Questions programmers ask; shapes the understanding probes.
- Xia, X. et al. (2018). **Measuring Program Comprehension: A Large-Scale Field Study with Professionals.** IEEE Transactions on Software Engineering. <https://doi.org/10.1109/TSE.2017.2734091>  
  _Role:_ Measuring comprehension with professionals.
- Siegmund, J. (2016). **Program Comprehension: Past, Present, and Future.** 2016 IEEE 23rd International Conference on Software Analysis, Evolution, and Reengineering (SANER). <https://doi.org/10.1109/saner.2016.35>  
  _Role:_ Program comprehension overview.

## 5. Intervention Design: Cognitive Forcing, Friction and Verification Prompts

_What the gate itself should look like; content matters more than mere presence._

- Buçinca, Z., Malaya, M. B., & Gajos, K. Z. (2021). **To Trust or to Think: Cognitive Forcing Functions Can Reduce Overreliance on AI in AI-assisted Decision-making.** Proceedings of the ACM on Human-Computer Interaction. <https://doi.org/10.1145/3449287>  
  _Role:_ Cognitive forcing functions reduce overreliance (at a usability cost).
- Ghosh, A., Sarkar, A., Lindley, S., & Poelitz, C. (2026). **An Experimental Comparison of Cognitive Forcing Functions for Execution Plans in AI-Assisted Writing: Effects On Trust, Overreliance, and Perceived Critical Thinking.** arXiv:2601.18033. <https://arxiv.org/abs/2601.18033>  
  _Role:_ Generic 'what-if' prompt can worsen overreliance; concrete-assumption checks help.
- Li, S. et al. (2026). **Guided Reflection in AI-Assisted Decision-Making: Effects on AI Overreliance and Decision Accuracy.** Proceedings of the 2026 CHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/3772318.3790632>  
  _Role:_ Guided reflection as forcing function.
- Sovrano, F., Dominici, G., & Bacchelli, A. (2026). **Mitigating Prompt-Induced Cognitive Biases in General-Purpose AI for Software Engineering.** Proceedings of the ACM on Software Engineering. <https://doi.org/10.1145/3808115>  
  _Role:_ Generic debiasing ineffective; concrete assumptions help. NB: the exposé's DOI (...3715740) is wrong; this is the correct one.
- Danry, V., Pataranutaporn, P., Mao, Y., & Maes, P. (2023). **Don’t Just Tell Me, Ask Me: AI Systems that Intelligently Frame Explanations as Questions Improve Human Logical Discernment Accuracy over Causal AI explanations.** Proceedings of the 2023 CHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/3544548.3580672>  
  _Role:_ Questions beat statements for logical discernment.
- Vasconcelos, H. et al. (2023). **Explanations Can Reduce Overreliance on AI Systems During Decision-Making.** Proceedings of the ACM on Human-Computer Interaction. <https://doi.org/10.1145/3579605>  
  _Role:_ Explanations reduce overreliance only when verification is cheap.
- de Jong, S., Paananen, V., Tag, B., & van Berkel, N. (2025). **Cognitive Forcing for Better Decision-Making: Reducing Overreliance on AI Systems Through Partial Explanations.** Proceedings of the ACM on Human-Computer Interaction. <https://doi.org/10.1145/3710946>  
  _Role:_ Partial explanations as cognitive forcing.
- Cox, A. L. et al. (2016). **Design Frictions for Mindful Interactions: The Case for Microboundaries.** Proceedings of the 2016 CHI Conference Extended Abstracts on Human Factors in Computing Systems. <https://doi.org/10.1145/2851581.2892410>  
  _Role:_ Design frictions / microboundaries.
- Chen, Z., & Schmidt, R. (2024). **Exploring a Behavioral Model of “Positive Friction” in Human-AI Interaction.** Lecture Notes in Computer Science. <https://doi.org/10.1007/978-3-031-61353-1_1>  
  _Role:_ Behavioural model of positive friction.
- Zhu, L. et al. (2026). **Designing meaningful human oversight in AI.** AI and Ethics. <https://doi.org/10.1007/s43681-026-01147-7>  
  _Role:_ Solve-verify asymmetry in meaningful oversight.
- Bo, J. Y., Wan, S., & Anderson, A. (2025). **To Rely or Not to Rely? Evaluating Interventions for Appropriate Reliance on Large Language Models.** Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/3706598.3714097>  
  _Role:_ Which interventions yield appropriate reliance on LLMs.
- Kazemitabaar, M. et al. (2025). **Exploring the Design Space of Cognitive Engagement Techniques with AI-Generated Code for Enhanced Learning.** Proceedings of the 30th International Conference on Intelligent User Interfaces. <https://doi.org/10.1145/3708359.3712104>  
  _Role:_ Cognitive-engagement techniques with AI-generated code.
- Tran-Le, B. T., Thomas, P., Stiffler, N. M., & Nguyen, T. N. (2026). **How Does LLM-powered Coding Assistance Shape Incidental Learning? Exploring Cognitive Forcing Strategies in Programming Education.** Proceedings of the AAAI Conference on Artificial Intelligence. <https://doi.org/10.1609/aaai.v40i48.42121>  
  _Role:_ Forcing strategies with coding assistance.
- Kazemitabaar, M. et al. (2023). **Studying the effect of AI Code Generators on Supporting Novice Learners in Introductory Programming.** Proceedings of the 2023 CHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/3544548.3580919>  
  _Role:_ AI code generators and novice learning.
- Lee, H. P. (. et al. (2025). **The Impact of Generative AI on Critical Thinking: Self-Reported Reductions in Cognitive Effort and Confidence Effects From a Survey of Knowledge Workers.** Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/3706598.3713778>  
  _Role:_ Self-reported reduction in cognitive effort with GenAI.
- Collins, K. M. et al. (2024). **Modulating Language Model Experiences through Frictions.** arXiv:2407.12804. <https://arxiv.org/abs/2407.12804>  
  _Role:_ Friction design space for LMs.
- Swaroop, S., Buçinca, Z., Gajos, K. Z., & Doshi-Velez, F. (2025). **Personalising AI Assistance Based on Overreliance Rate in AI-Assisted Decision Making.** Proceedings of the 30th International Conference on Intelligent User Interfaces. <https://doi.org/10.1145/3708359.3712128>  
  _Role:_ Personalising assistance by overreliance rate.
- Chi, M. T. et al. (1989). **Self‐Explanations: How Students Study and Use Examples in Learning to Solve Problems.** Cognitive Science. <https://doi.org/10.1207/s15516709cog1302_1>  
  _Role:_ Self-explanation (basis for probe questions).
- Chi, M. T., De Leeuw, N., Chiu, M., & Lavancher, C. (1994). **Eliciting Self‐Explanations Improves Understanding.** Cognitive Science. <https://doi.org/10.1207/s15516709cog1803_3>  
  _Role:_ Prompting self-explanation improves understanding.
- Roediger, H. L., & Karpicke, J. D. (2006). **Test-Enhanced Learning: Taking Memory Tests Improves Long-Term Retention.** Psychological Science. <https://doi.org/10.1111/j.1467-9280.2006.01693.x>  
  _Role:_ Testing effect; basis for the post-story understanding questions.

## 6. Intervention Timing: Interruption, Breakpoints and Mixed-Initiative Interaction

_When to interrupt: cost of interruption, task-boundary effects, proactive assistants. Currently thin in the archive; central to the 'when' criteria._

- Horvitz, E. (1999). **Principles of mixed-initiative user interfaces.** Proceedings of the SIGCHI conference on Human factors in computing systems the CHI is the limit - CHI '99. <https://doi.org/10.1145/302979.303030>  
  _Role:_ Mixed-initiative principles: act on expected utility of acting vs. interrupting.
- Horvitz, E., & Apacible, J. (2003). **Learning and reasoning about interruption.** Proceedings of the 5th international conference on Multimodal interfaces. <https://doi.org/10.1145/958432.958440>  
  _Role:_ Models of interruptibility (attention cost).
- Adamczyk, P. D., & Bailey, B. P. (2004). **If not now, when: the effects of interruption at different moments within task execution.** Proceedings of the SIGCHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/985692.985727>  
  _Role:_ Interruptions at coarse task boundaries cost less.
- Iqbal, S. T., & Bailey, B. P. (2006). **Leveraging characteristics of task structure to predict the cost of interruption.** Proceedings of the SIGCHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/1124772.1124882>  
  _Role:_ Interruption cost predicted from task structure.
- Iqbal, S. T., & Bailey, B. P. (2007). **Understanding and developing models for detecting and differentiating breakpoints during interactive tasks.** Proceedings of the SIGCHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/1240624.1240732>  
  _Role:_ Detecting breakpoints from interaction logs.
- Mark, G., Gudith, D., & Klocke, U. (2008). **The cost of interrupted work: more speed and stress.** Proceedings of the SIGCHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/1357054.1357072>  
  _Role:_ Interrupted work: faster but more stress.
- Altmann, E. M., & Trafton, J. G. (2002). **Memory for goals: an activation‐based model.** Cognitive Science. <https://doi.org/10.1207/s15516709cog2601_2>  
  _Role:_ Memory for goals; why resumption after interruption costs.
- Parnin, C., & Rugaber, S. (2009). **Resumption strategies for interrupted programming tasks.** 2009 IEEE 17th International Conference on Program Comprehension. <https://doi.org/10.1109/icpc.2009.5090030>  
  _Role:_ Programmers resuming interrupted tasks.
- Parnin, C., & Rugaber, S. (2010). **Resumption strategies for interrupted programming tasks.** Software Quality Journal. <https://doi.org/10.1007/s11219-010-9104-9>  
  _Role:_ Journal version of the above.
- Chen, V. et al. (2025). **Need Help? Designing Proactive AI Assistants for Programming.** Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/3706598.3714002>  
  _Role:_ Proactive assistant; timing suggestions to avoid disrupting flow.
- Mozannar, H., Bansal, G., Fourney, A., & Horvitz, E. (2024). **When to Show a Suggestion? Integrating Human Feedback in AI-Assisted Programming.** Proceedings of the AAAI Conference on Artificial Intelligence. <https://doi.org/10.1609/aaai.v38i9.28878>  
  _Role:_ Learning when to show suggestions.
- Swaroop, S., Buçinca, Z., Gajos, K. Z., & Doshi-Velez, F. (2024). **Accuracy-Time Tradeoffs in AI-Assisted Decision Making under Time Pressure.** Proceedings of the 29th International Conference on Intelligent User Interfaces. <https://doi.org/10.1145/3640543.3645206>  
  _Role:_ Time pressure and AI-assisted decisions.
- Shukla, T. et al. (2026). **Hedwig: Dynamic Autonomy for Coding Agents Under Local Oversight.** arXiv:2605.11495. <https://arxiv.org/abs/2605.11495>  
  _Role:_ Developers prefer check-ins at milestones over constant interruption.
- Züger, M., & Fritz, T. (2015). **Interruptibility of Software Developers and its Prediction Using Psycho-Physiological Sensors.** Proceedings of the 33rd Annual ACM Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/2702123.2702593>  
  _Role:_ Predicting developer interruptibility from biometrics (91.5% accuracy in lab).
- Poreba, F., & Sobernig, S. (2026). **Interruptibility of software developers and its prediction using psycho-physiological sensors: a replication.** Empirical Software Engineering. <https://doi.org/10.1007/s10664-025-10739-6>  
  _Role:_ External replication of the above; check whether the accuracy held.
- Züger, M. et al. (2017). **Reducing Interruptions at Work: A Large-Scale Field Study of FlowLight.** Proceedings of the 2017 CHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/3025453.3025662>  
  _Role:_ FlowLight field study: 46% fewer interruptions.
- Meyer, A. N. et al. (2017). **The Work Life of Developers: Activities, Switches and Perceived Productivity.** IEEE Transactions on Software Engineering. <https://doi.org/10.1109/tse.2017.2656886>  
  _Role:_ Developers' activity switches and perceived productivity.
- Meyer, A. N., Fritz, T., Murphy, G. C., & Zimmermann, T. (2014). **Software developers' perceptions of productivity.** Proceedings of the 22nd ACM SIGSOFT International Symposium on Foundations of Software Engineering. <https://doi.org/10.1145/2635868.2635892>  
  _Role:_ What developers consider a productive day; interruptions as a factor.

## 7. Agentic Coding and Human Oversight of Agents

_The setting of the study: autonomous agents, oversight work, review of agent output._

- Dhanorkar, S., Passi, S., & Vorvoreanu, M. (2026). **Human oversight of agentic systems in practice: Examining the oversight work, challenges, and heuristics of developers using software agents.** Proceedings of the 2026 ACM Conference on Fairness, Accountability, and Transparency. <https://doi.org/10.1145/3805689.3812402>  
  _Role:_ Interviews: four forms of oversight; developers treat passing tests as proof.
- Ye, J., Zou, H., Yu, S., & Shi, W. (2026). **Coding with "Enemy": Can Human Developers Detect AI Agent Sabotage?.** arXiv:2606.05647. <https://arxiv.org/abs/2606.05647>  
  _Role:_ 94% of developers missed agent sabotage; passive flags ignored.
- Yu, H. et al. (2026). **Habituation at the Gate: Rising Approval and Declining Scrutiny in Human Review of AI Agent Code.** arXiv:2606.22721. <https://arxiv.org/abs/2606.22721>  
  _Role:_ Approval rises and scrutiny falls over time (habituation).
- Feng, K. J. K., McDonald, D. W., & Zhang, A. X. (2025). **Levels of Autonomy for AI Agents.** arXiv:2506.12469. <https://arxiv.org/abs/2506.12469>  
  _Role:_ Autonomy levels L1-L5 defined by the user's role.
- Chen, V., Talwalkar, A., Brennan, R., & Neubig, G. (2025). **Code with Me or for Me? How Increasing AI Automation Transforms Developer Workflows.** arXiv:2507.08149. <https://arxiv.org/abs/2507.08149>  
  _Role:_ Copilot vs. agent: users struggle to understand agent behaviour.
- Kumar, A. et al. (2025). **Why AI Agents Still Need You: Findings from Developer-Agent Collaborations in the Wild.** arXiv:2506.12347. <https://arxiv.org/abs/2506.12347>  
  _Role:_ In-IDE agent collaboration in the wild.
- Cynthia, S. T., Das, J. K., & Roy, B. (2026). **Are We All Using Agents the Same Way? An Empirical Study of Core and Peripheral Developers Use of Coding Agents.** arXiv:2601.20106. <https://arxiv.org/abs/2601.20106>  
  _Role:_ How core/peripheral developers verify agent PRs.
- Robbes, R. et al. (2026). **Agentic Much? Adoption of Coding Agents on GitHub.** arXiv:2601.18341. <https://arxiv.org/abs/2601.18341>  
  _Role:_ Adoption of coding agents on GitHub.
- Khelifi, S., Ouni, A., & Khemaja, M. (2026). **Behind Agentic Pull Requests: An Empirical Study on Developer Interventions in AI Agent-Authored Pull Requests.** Proceedings of the 23rd International Conference on Mining Software Repositories. <https://doi.org/10.1145/3793302.3793586>  
  _Role:_ Developer interventions in agent-authored PRs.
- Takerngsaksiri, W. et al. (2025). **Human-In-The-Loop Software Development Agents.** 2025 IEEE/ACM 47th International Conference on Software Engineering: Software Engineering in Practice (ICSE-SEIP). <https://doi.org/10.1109/icse-seip66354.2025.00036>  
  _Role:_ HULA: humans refine plans and review code at stages.
- Becker, J., Rush, N., Barnes, E., & Rein, D. (2025). **Measuring the Impact of Early-2025 AI on Experienced Open-Source Developer Productivity.** arXiv:2507.09089. <https://arxiv.org/abs/2507.09089>  
  _Role:_ METR RCT: experienced developers 19% slower while believing faster.
- Shen, J. H., & Tamkin, A. (2026). **How AI Impacts Skill Formation.** arXiv:2601.20245. <https://arxiv.org/abs/2601.20245>  
  _Role:_ AI assistance reduces skill formation.
- Ferino, S., Hoda, R., Grundy, J., & Treude, C. (2026). **Towards an Appropriate Level of Reliance on AI: A Preliminary Reliance-Control Framework for AI in Software Engineering.** arXiv:2604.10530. <https://arxiv.org/abs/2604.10530>  
  _Role:_ Reliance-control framework for SE.
- Wang, Z. Z. et al. (2026). **Humans are Missing from AI Coding Agent Research.** arXiv:2608.12355. <https://arxiv.org/abs/2608.12355>  
  _Role:_ Position paper: agents lack principled control points for users; false choice between autonomy and constant supervision. Closest statement of your gap.
- Park, Y. S. et al. (2026). **The Work Behind Delegation: A Framework for Supervising AI Coding Agents.** arXiv:2609.24234. <https://arxiv.org/abs/2609.24234>  
  _Role:_ Framework for supervising coding agents (delegation work).
- Baumann, J. et al. (2026). **SWE-chat: Coding Agent Interactions From Real Users in the Wild.** arXiv:2604.20779. <https://arxiv.org/abs/2604.20779>  
  _Role:_ Real-world agent sessions: agents rarely ask clarifying questions, users frequently interrupt or push back.
- He, H. et al. (2026). **AI Writes Faster Than Humans Can Review: A Longitudinal Study of an Enterprise 2x Mandate.** arXiv:2607.01904. <https://arxiv.org/abs/2607.01904>  
  _Role:_ Longitudinal enterprise study: review capacity as bottleneck.
- Monperrus, M. (2026). **The End of Code Review: Coding Agents Supersede Human Inspection.** arXiv:2606.13175. <https://arxiv.org/abs/2606.13175>  
  _Role:_ Counter-position: coding agents supersede human inspection. Needs a response in your motivation.

## 8. Automated Monitoring of Agents and Fast 'System-1' Reviewers

_Machine-side counterpart: monitors that decide when an agent step needs attention._

- Greenblatt, R., Shlegeris, B., Sachan, K., & Roger, F. (2023). **AI Control: Improving Safety Despite Intentional Subversion.** arXiv:2312.06942. <https://arxiv.org/abs/2312.06942>  
  _Role:_ Trusted monitoring with limited human audit budget.
- Sreevatsa, A., Prasanna, S., & Rushing, C. (2026). **Basic Legibility Protocols Improve Trusted Monitoring.** arXiv:2602.10153. <https://arxiv.org/abs/2602.10153>  
  _Role:_ Making agent actions legible to monitors.
- Liu, S. et al. (2026). **Online Monitoring and Corrective Steering of Programming Agents.** arXiv:2608.06701. <https://arxiv.org/abs/2608.06701>  
  _Role:_ Cheap rule-based monitor plus LLM advisor.
- Li, H. et al. (2026). **From Uncertainty to Action: Learning to Steer LLM Agents.** arXiv:2610.09115. <https://arxiv.org/abs/2610.09115>  
  _Role:_ Uncertainty signals find failing runs, not the best intervention step.
- Barazandeh, B., Swanson, C., Kulkarni, C., & Mungel, N. (2026). **OnTrack: Real-Time Monitoring and Intervention in LLM Agent Trajectories via Streaming Structure-Aware Optimal Transport.** arXiv:2610.12375. <https://arxiv.org/abs/2610.12375>  
  _Role:_ Millisecond streaming monitor.
- Liu, S. et al. (2025). **Process-Centric Analysis of Agentic Software Systems.** arXiv:2512.02393. <https://arxiv.org/abs/2512.02393>  
  _Role:_ Process monitoring of agent trajectories.
- Spiess, C. et al. (2024). **Calibration and Correctness of Language Models for Code.** arXiv:2402.02047. <https://arxiv.org/abs/2402.02047>  
  _Role:_ Calibration of code LMs.
- Jiang, J. et al. (2026). **Predicting Developer Acceptance of AI-Generated Code Suggestions.** arXiv:2601.21379. <https://arxiv.org/abs/2601.21379>  
  _Role:_ Predicting acceptance of suggestions.
- Awad, M. N. A., Ivanov, S., & Tikhonova, O. (2025). **Pre-Filtering Code Suggestions using Developer Behavioral Telemetry to Optimize LLM-Assisted Programming.** arXiv:2511.18849. <https://arxiv.org/abs/2511.18849>  
  _Role:_ Behavioural telemetry for pre-filtering suggestions.
- Almeida, D. / TypeSafe AI (2026). **Introducing System One Models and Jev.** TypeSafe AI blog. <https://typesafe.ai/blog/introducing-system-one-models-and-jev>  
  _Role:_ Calibrated decision model used as parallel reviewer.

## 9. Measuring Reliance: Signal Detection Theory and Statistics

_Method literature behind d' / c and the mixed-model analysis._

- Schöffer, J. et al. (2025). **AI Reliance and Decision Quality: Fundamentals, Interdependence, and the Effects of Interventions.** Journal of Artificial Intelligence Research. <https://doi.org/10.1613/jair.1.15873>  
  _Role:_ Reliance metrics can move with zero change in discrimination.
- Guo, Z., Wu, Y., Hartline, J. D., & Hullman, J. (2024). **A Decision Theoretic Framework for Measuring AI Reliance.** The 2024 ACM Conference on Fairness, Accountability, and Transparency. <https://doi.org/10.1145/3630106.3658901>  
  _Role:_ Decision-theoretic reliance framework.
- Langer, M., Baum, K., & Schlicker, N. (2024). **Effective Human Oversight of AI-Based Systems: A Signal Detection Perspective on the Detection of Inaccurate and Unfair Outputs.** Minds and Machines. <https://doi.org/10.1007/s11023-024-09701-0>  
  _Role:_ Oversight through signal detection.
- DeCarlo, L. T. (1998). **Signal detection theory and generalized linear models..** Psychological Methods. <https://doi.org/10.1037/1082-989X.3.2.186>  
  _Role:_ SDT as a probit GLM.
- Stanislaw, H., & Todorov, N. (1999). **Calculation of signal detection theory measures.** Behavior Research Methods, Instruments, & Computers. <https://doi.org/10.3758/bf03207704>  
  _Role:_ How to compute d' and c.
- Schemmer, M. et al. (2023). **Appropriate Reliance on AI Advice: Conceptualization and the Effect of Explanations.** Proceedings of the 28th International Conference on Intelligent User Interfaces. <https://doi.org/10.1145/3581641.3584066>  
  _Role:_ Appropriate reliance defined; effect of explanations.
- Schemmer, M. et al. (2022). **Should I Follow AI-based Advice? Measuring Appropriate Reliance in Human-AI Decision-Making.** arXiv:2204.06916. <https://arxiv.org/abs/2204.06916>  
  _Role:_ Measuring appropriate reliance.
- Raees, M., & Papangelis, K. (2026). **Trust to Reliance: Measurement Constructs for Human-AI Appropriate Reliance.** Proceedings of the Extended Abstracts of the 2026 CHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/3772363.3798835>  
  _Role:_ Reliance measurement constructs.
- Raees, M., Khan, V. J., Lykourentzou, I., & Papangelis, K. (2026). **Do People Appropriately Rely on AI-Advice? An Analytical Review of HCI Research on Human-AI Decision-Making.** Proceedings of the 2026 CHI Conference on Human Factors in Computing Systems. <https://doi.org/10.1145/3772318.3791467>  
  _Role:_ Analytical review of reliance in HCI.
- Eckhardt, S., Kühl, N., Dolata, M., & Schwabe, G. (2025). **A Survey of AI Reliance.** ACM Computing Surveys. <https://doi.org/10.1145/3776528>  
  _Role:_ Survey of AI reliance.
- Sommet, N., Weissman, D. L., Cheutin, N., & Elliot, A. J. (2023). **How Many Participants Do I Need to Test an Interaction? Conducting an Appropriate Power Analysis and Achieving Sufficient Power to Detect an Interaction.** Advances in Methods and Practices in Psychological Science. <https://doi.org/10.1177/25152459231178728>  
  _Role:_ Power for interactions.
- Lakens, D. (2022). **Sample Size Justification.** Collabra: Psychology. <https://doi.org/10.1525/collabra.33267>  
  _Role:_ Sample-size justification.

## 10. Instruments

_Questionnaires and scales planned for the study._

- Lins de Holanda Coelho, G., H. P. Hanel, P., & J. Wolf, L. (2018). **The Very Efficient Assessment of Need for Cognition: Developing a Six-Item Version.** Assessment. <https://doi.org/10.1177/1073191118793208>  
  _Role:_ NCS-6 (need for cognition, short).
- Cacioppo, J. T., & Petty, R. E. (1982). **The need for cognition..** Journal of Personality and Social Psychology. <https://doi.org/10.1037/0022-3514.42.1.116>  
  _Role:_ Original Need for Cognition.
- McGrath, M. J., Lack, O., Tisch, J., & Duenser, A. (2025). **Measuring trust in artificial intelligence: validation of an established scale and its short form.** Frontiers in Artificial Intelligence. <https://doi.org/10.3389/frai.2025.1582880>  
  _Role:_ Short trust scale.
- Hart, S. G., & Staveland, L. E. (1988). **Development of NASA-TLX (Task Load Index): Results of Empirical and Theoretical Research.** Advances in Psychology, 52, 139-183. <https://doi.org/10.1016/s0166-4115(08)62386-9>  
  _Role:_ NASA-TLX (1988). The exposé cites DOI ...154193120605000909, which is the 2006 retrospective; cite one deliberately.
- Paas, F. G. W. C. (1992). **Training strategies for attaining transfer of problem-solving skill in statistics: A cognitive-load approach..** Journal of Educational Psychology. <https://doi.org/10.1037/0022-0663.84.4.429>  
  _Role:_ Single-item mental effort scale.

## 11. Industry Evidence and Surveys

_Motivation: scale of the verification gap and comprehension debt (mostly grey literature; cite carefully)._

- Stack Overflow (2025). **2025 Developer Survey: AI.** Stack Overflow. <https://survey.stackoverflow.co/2025>  
  _Role:_ 66% cite 'almost right, but not quite'.
- DORA / Google Cloud (2025). **State of AI-assisted Software Development 2025.** DORA. <https://dora.dev/research/2025/dora-report/>  
  _Role:_ Industry adoption and outcomes.
- Osmani, A. (2026). **Comprehension Debt: The Hidden Cost of AI-Generated Code.** O'Reilly Radar. <https://www.oreilly.com/radar/comprehension-debt-the-hidden-cost-of-ai-generated-code>  
  _Role:_ Practitioner framing.
- Ahmad, M. O. (2026). **Comprehension Debt in GenAI-Assisted Software Engineering Projects.** arXiv:2604.13277. <https://arxiv.org/abs/2604.13277>  
  _Role:_ Comprehension debt in GenAI projects.
- Storey, M. (2026). **From Technical Debt to Cognitive and Intent Debt: Rethinking Software Health in the Age of AI.** arXiv:2603.22106. <https://arxiv.org/abs/2603.22106>  
  _Role:_ Cognitive and intent debt.
- Liu, Y. et al. (2026). **Debt Behind the AI Boom: A Large-Scale Empirical Study of AI-Generated Code in the Wild.** arXiv:2603.28592. <https://arxiv.org/abs/2603.28592>  
  _Role:_ Technical debt in AI-generated code in the wild.
- METR (2026). **METR: We Are Changing Our Developer Productivity Experiment Design.** METR blog. <https://metr.org/blog/2026-02-24-uplift-update>  
  _Role:_ Follow-up to the RCT.
- Cui, K. Z. et al. (2026). **The Effects of Generative AI on High-Skilled Work: Evidence from Three Field Experiments with Software Developers.** Management Science. <https://doi.org/10.1287/mnsc.2025.00535>  
  _Role:_ Field experiments: productivity gains from Copilot.

---

## Gaps and suggested next steps

- **Pair-programming-to-agent transfer is your claim, not established.** The human-AI pairing papers (§3) mostly cover autocomplete or chat. A second round of searches (Oct 2026) again found **no controlled study comparing intermediate checkpoints with end-of-task review for coding agents**. What exists: interview and survey work on oversight (Dhanorkar et al.; Hedwig), a position paper stating that agents lack principled control points (Wang et al. 2026, arXiv:2608.12355), a supervision framework (Park et al. 2026, arXiv:2609.24234), and practitioner write-ups proposing gates at plan, findings and diff (not peer-reviewed). Phrase the gap as "to my knowledge, no controlled study" and cite the position paper as support. Note the counter-position (Monperrus 2026, "The End of Code Review") and answer it in the motivation. Searches were web searches, not a systematic review, so re-run them before submission.
- **"Navigator interventions" evidence is qualitative.** Plonka, Zieris & Prechelt and Chong & Hurlbutt are observational. Your C1–C3 criteria are a *synthesis*, so say so explicitly rather than presenting them as established findings.
- **Change size vs. review effectiveness is mixed.** di Biase et al. (2019) found smaller changes helped on some measures but did not change the number of defects found. The "8,000-line problem" argument should cite this honestly.
- **Interruption literature is mostly general-purpose HCI.** Programming-specific work now included: Parnin & Rugaber, Züger & Fritz (interruptibility prediction, plus a 2026 replication with only 10 participants), FlowLight, Meyer et al., and the proactive-assistant papers. These study *human* interruptions of a developer's own work, not a developer being interrupted to *review an agent*, so the link to your milestones (C2 as a coarse breakpoint in Iqbal & Bailey's sense) is an argument you make, not something they show.
- **Agent monitoring papers (§8) are 2026 preprints**, several only a few weeks old. Treat them as related work, not as foundations, and re-check them for revisions before submission.
- **Not yet covered:** developer-facing agent UX papers (plan review, diff UX), explanation or provenance for AI diffs, and a CFF meta-analysis (the archive's matrix notes none was found).

---

## Appendix: archive files that overlap with this list

| File | Use |
|---|---|
| `archive/concepts/literature-matrix.md` | Detailed relation-typed matrix (novelty threats, falsifiers); more depth on the reliance/CFF side |
| `archive/concepts/literature-audit.md` | Earlier per-entry link/title audit (Sep 2026) |
| `archive/concepts/deep-research-2026-10.md` | Long annotated bibliography and gap analysis for the earlier (pre-15-Oct) framing |
