# Designing and Measuring Code Comprehension Questions (focus: AI-generated code, question abstraction level)

Compiled 20 November 2026 for the supervisor question on the abstraction level of the five post-feature MCQ items (behaviour level: "scenario → what happens?", code hidden, confidence rating per item).

**Verification note.** Full text was read for Kaufman et al. 2026 (methods section; limitations not extracted) and Oertel et al. 2026 (methods section). For Wyrich et al. 2023 the PDF fetch failed, so only the arXiv abstract was checked. For Schulte 2008, Pennington 1987, Lopez et al. 2008, Lister et al. 2006 and Whalley et al. 2006 I used search snippets, ACM/ScienceDirect metadata and partial text. Where a claim rests only on a snippet or on my background knowledge, it says so. Items marked **[already known]** were on the list I was given. I did not re-verify them.

---

## 1. Which frameworks classify comprehension questions by level?

### Takeaway
Three frameworks give the thesis a vocabulary for levels: Schulte's Block Model (text surface / execution / function, each at several levels), the SOLO/Bloom line of work for code-reading MCQs (Lister, Whalley, Lopez), and Letovsky's goal–implementation–annotation model (purpose/intent level). Together they say that behaviour questions (tracing, "what happens") sit at a low-to-middle level, while intent and design questions sit higher. The SOLO authors also say MCQs cannot reliably reveal the level of understanding a respondent has.

### Cited Findings
- **Block Model (Schulte, 2008, ICER 2008).** Introduces the Block Model as an educational model of program comprehension, used to plan and analyse lessons. DOI 10.1145/1404520.1404535 — [ACM DL](https://dl.acm.org/doi/pdf/10.1145/1404520.1404535) (metadata verified; the ICER venue is inferred from the ACM proceedings ID 1404520 = ICER'08 proceedings, which Lopez et al. 2008 also use). The model has three dimensions — text surface, program execution, and function (macro structure) — and levels that run from atoms through relations to macro structure — [ResearchGate figure](https://www.researchgate.net/figure/Key-elements-of-program-comprehension-models_fig1_229681961); [ResearchGate abstract](https://www.researchgate.net/publication/247927531_Block_Model_an_educational_model_of_program_comprehension_as_a_tool_for_a_scholarly_approach_to_teaching). A KSU teaching text describes it as "three dimensions in four levels" — [KSU textbook](https://textbooks.cs.ksu.edu/tlcs/4-designing-cs-lessons/06-the-block-model/). The ICPC 2025 paper "Students' Program Comprehension Processes in a Large Code Base" uses Text / Execution vocabulary to code student think-aloud data — [IEEE CS page](https://www.computer.org/csdl/proceedings-article/icpc/2025/022300a182/27CwOe0H6es) (snippet only).
- **Lister et al. 2006 — SOLO for code reading.** "Not seeing the forest for the trees: Novice programmers and the SOLO taxonomy", ITiCSE 2006, Bologna. Uses SOLO levels (prestructural → multistructural → relational) on code-reading exercises. States: "With multiple choice questions, it is not possible to assign a student's response to a SOLO level when only provided with the response" — the authors need the reasoning behind the chosen option; the Leeds group's MCQs yielded about half "educated guesses" (snippet of the full text, [CiteSeerX PDF](https://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.563.903&rep=rep1&type=pdf)). Argues that a "relational" answer (summarising what the code computes) must be the natural reading of "explain in plain English" before the question measures what it intends. DOI not verified.
- **Whalley et al. 2006 — Bloom and SOLO for reading questions.** "An Australasian Study of Reading and Comprehension Skills in Novice Programmers, using the Bloom and SOLO Taxonomies", ACE 2006 (CRPIT vol. 52, pp. 243–252). Builds a question set on Bloom and SOLO and tests novices — [ACM DL](https://dl.acm.org/doi/10.5555/1151869.1151901) (metadata); pages and CRPIT volume are taken from the reference list in Lister et al. 2006 and Lopez et al. 2008 (not checked against CRPIT itself).
- **Lopez et al. 2008 — reading, tracing and writing (ICER 2008).** DOI 10.1145/1404520.1404531, [ACM DL](https://dl.acm.org/doi/10.1145/1404520.1404531); PDF at [UTS](https://opus.lib.uts.edu.au/bitstream/10453/10806/1/2008001530.pdf). Exam data: tracing performance correlates with writing; "explain in plain English" performance correlates with writing. Path analysis suggests a hierarchy: programming constructs → tracing and "explain in English" → writing. The text describes the Leeds MCQ types ("fixed code" = state the output of a variable after execution; "skeleton code" = pick missing lines) and reports that about 25% of students in the Leeds study "performed at a level consistent with guessing" (text snippet, UTS PDF).
- **Sillito, Murphy & De Volder 2006 — questions programmers ask.** FSE 2006, DOI 10.1145/1181775.1181779 (in the literature list). Catalogue of 44 question types from software evolution tasks — [ACM DL](https://dl.acm.org/doi/10.1145/1181775.1181779). The fuller version is Sillito, Murphy & De Volder, "Asking and Answering Questions during a Programming Change Task", IEEE TSE 34(4):434–451, 2008 (venue and volume from [IEEE CS](https://www.computer.org/csdl/journal/ts/2008/04/tts2008040434/13rRUxASuwY); DOI not checked). Use the 2008 TSE paper when citing the catalogue in full.
- **Letovsky 1987 — purpose/intent level.** "Cognitive processes in program comprehension", J. Systems and Software (1987); [ScienceDirect](https://www.sciencedirect.com/science/article/pii/016412128790032X) (metadata). Mental model has three parts: specification (goals of the program), implementation (actions and data structures), and annotation (links between goal and implementation). Developers may follow "systematic" or "as-needed" strategies, yielding weak or strong mental models. Summarised by [Source Code Comprehension: A Contemporary Definition and Conceptual Model (arXiv 2310.11301)](https://arxiv.org/html/2310.11301v1), which also quotes Letovsky & Soloway 1986: "the goal of program understanding is to recover the intentions behind the code", and Pennington 1987: comprehension is "the assignment of meaning to a particular program". That arXiv paper is a secondary source; I did not check its authors.
- **Pennington 1987 — program vs. situation model.** Cognitive Psychology 19(3):295–341 ([ScienceDirect](https://www.sciencedirect.com/science/article/pii/0010028587900077); DOI 10.1016/0010-0285(87)90007-7 is derived from the PII, not checked on Crossref). The program-model / situation-model distinction is from my background knowledge; I did not verify that wording in the text.

### Inferences
- The thesis's behaviour-level items map to the **execution** dimension of the Block Model and to the **tracing** tasks in Lopez et al. 2008. This is a middle level, not the lowest one, but it is not the level of purpose.
- A "purpose" or "why was this decided" item maps to Letovsky's **specification** and to the SOLO **relational** response. Lister et al. 2006 say that an "explain what it does" prompt only gets relational answers if the wording asks for purpose, so question wording matters as much as level.
- Lister et al.'s point that an MCQ cannot show the reasoning behind a choice is a direct validity challenge to the thesis's MCQ-only measure, and it should be in the limitations.

### Gaps
- I did not read Schulte 2008, Pennington 1987 or Letovsky 1987 in full. Only metadata and secondary descriptions were checked.
- No source checked here gives a validated mapping from Block Model levels to MCQ items.

---

## 2. Empirical AI-related studies on developers' understanding of AI-generated code (2023–2026)

### Takeaway
Few studies measure comprehension of AI-generated code with MCQs. The recent ones use mutation or bug finding (Oertel et al. 2026), a four-item quiz on novice code (White et al. 2026), or judgements of assertions (Kaufman et al. 2026). None of the ones I found uses multiple-choice behaviour prediction. Wyrich et al.'s mapping of 95 comprehension experiments (1979–2019) found none that measured comprehension of participants' own code, as Oertel et al. state.

### Cited Findings
- **Oertel, Klünder & Hebig 2026 — "The Comprehension Gap in LLM-Assisted Software Development: An Experiment"**, arXiv:2611.24216 (submitted 18 Nov 2026; preprint, not peer reviewed) — [arXiv](https://arxiv.org/abs/2611.24216). Crossover experiment, N=35 (students, academic staff, developers). Participants write code with LLM chat, self, or unseen. Comprehension task: find introduced mutations in the code (4 per piece, 5 for unseen code), with time and count measured, plus a self-rated comprehension rating and interviews. Findings: 36% report better understanding of self-written code; participants were 20% faster on self-written code and found 11% more mutations; high LLM reliance and low task engagement were associated with lower comprehension. Instrument rationale (methods section): the task is identical across modes, judging is easier than free-text answers, and mutations can be applied independently of the solution. Validity points they raise include variable strategies and individual perspectives. Related work: [Wyrich, Bogner & Wagner (arXiv 2206.11102)] is quoted as finding none of the 95 studies measured comprehension of participants' own code.
- **White et al. 2026 — "Feeling Easier, Working Harder: Cognitive Load in AI-Assisted Code Comprehension"**, arXiv:2611.12019 (9 Nov 2026; the arXiv comment says accepted to ICSE 2027) — [arXiv](https://arxiv.org/abs/2611.12019). 3×2 within-subjects, N=20 novice CS students, Java snippets read with or without AI, then an AI-unassisted four-question quiz. Measures: Detection-Response Task reaction times (+11.2% with AI), NASA-TLX and SEQ. Quiz scores were high in both conditions with no evident benefit; the authors name a ceiling effect as limiting power on harder snippets. Participants did not perceive the extra load. Validity notes: small N, novices, ceiling. Relevant to the "quiz as instrument" question and to the difficulty calibration of items.
- **Kaufman, Brun, Murali & Endres 2026 — "Programmers Are Poor and Overconfident Judges of LLM-Generated Assertions"**, arXiv:2607.08885 (9 Jul 2026; preprint) — [arXiv](https://arxiv.org/abs/2607.08885). Controlled experiment, 86 Python programmers, each judging 10 stimuli (function + docstring + generated postcondition assertion + optional comment). Judgements of whether the assertion is correct, and how complete, with 0–5 confidence. Correct assertions judged correctly 74%, incorrect 49%; confidence similar in both (OR for correct judgements 2.94, p<0.001). NL explanations gave no overall benefit. Low-quality explanations reduced specification-assessment accuracy (OR 0.58, p=0.037). Methods section read in full.
  - **Inconsistency to check before citing:** the abstract says low-quality explanations increased confidence "(p = 0.005, 3.99/5 vs. 4.25/5)". As printed, 3.99 is lower than 4.25, so the direction in the text does not match the claim. Check the results section.
- **Shen & Tamkin 2026 (Anthropic, arXiv:2601.20245)** — **[already known]**. Randomised trial, 52 junior engineers learning a Python library. Quiz on concepts used minutes earlier, covering debugging, code reading and conceptual understanding. AI group scored 17% lower; delegation groups scored below 40%, and those who asked conceptual questions scored 65% or more (figures from [Anthropic's page](https://www.anthropic.com/research/AI-assistance-coding-skills) and [InfoQ](https://www.infoq.com/news/2026/02/ai-coding-skill-formation/); not re-checked in the paper).
- **Kazemitabaar 2025 and Ahmad 2026 ("comprehension debt")** — **[already known]**. Not searched in this pass.
- **Perry, Srivastava, Kumar & Boneh 2023 — "Do Users Write More Insecure Code with AI Assistants?"**, ACM CCS 2023, DOI 10.1145/3576915.3623157 ([ACM DL](https://dl.acm.org/doi/10.1145/3576915.3623157); arXiv 2211.03622). Participants with an AI assistant wrote less secure code and were more likely to believe they had written secure code. Calibration evidence; not a comprehension test.
- **Prather et al. 2024 — "The Widening Gap: The Benefits and Harms of Generative AI for Novice Programmers"**, arXiv 2405.17739 ([arXiv](https://arxiv.org/html/2405.17739v1)). Metacognitive difficulties with AI for novices. Snippet only; not read in full.

### Inferences
- Kaufman et al. are the closest match for the thesis's confidence rating. Their confidence was flat across correct and incorrect items, so a confidence measure may not separate understood from misunderstood code. This is a design argument for analysing confidence against accuracy per item, not for dropping it.
- Oertel et al.'s "mutation finding" is a detection task, not a prediction question. It could be used as a second instrument to check whether behaviour-MCQ results generalise to a different task type.

### Gaps
- No MCQ-based study of AI-generated code comprehension was found. Searches returned only blog posts and industry pieces, which were not used.
- Kazemitabaar 2025 and Ahmad 2026 need a separate check before they are cited.
- The Kaufman limitations section and the White et al. quiz items were not extracted.

---

## 3. Tests as a comprehension or review instrument

### Takeaway
Tests are a credible comprehension measure, but the evidence I found is for human-written test code (Yu et al. 2019), not for AI-generated tests or for reviewing code through its tests. I found no study that uses reading or predicting test outcomes as an understanding measure for AI-generated code. This is the main gap in the literature for the supervisor's question.

### Cited Findings
- **Yu, Treude & Aniche 2019 — "Comprehending Test Code: An Empirical Study"**, ICSME 2019 (per the arXiv comment), arXiv:1907.13365 ([arXiv](https://arxiv.org/abs/1907.13365)). 44 developers. Three dependent variables: reading time for a test suite, ability to identify the overall purpose of the test suite, and ability to write additional test cases. Prior project knowledge and experience with automated tests affected results. Abstract read in full.
- Blog and industry sources (augmentcode, Forbes, dev.to) say AI-generated tests can encode the same blind spots as the code they check. These are opinion pieces with no data, so they are not cited as findings.

### Inferences
- Yu et al.'s "identify the purpose of the test suite" is a purpose-level question on test code. It could be a template for a test-based item in the thesis: give the reader the tests, ask what the feature is for or which case is untested.
- A test-based item tests a different ability (inferring specification from examples) from a behaviour prediction item (tracing the code). Kaufman et al.'s assertion-judging task is closer to that and gives the most direct precedent in the literature.

### Gaps
- No empirical study of tests as the comprehension instrument for AI-generated code was found. Document this in the thesis as a gap.

---

## 4. Confidence and calibration in code comprehension

### Takeaway
Developers are poor at judging the correctness of AI output and do not change their confidence to match. This supports collecting confidence alongside correctness, and suggests analysing calibration per item (not just mean confidence) to show whether the measure discriminates.

### Cited Findings
- **Kaufman et al. 2026** (see §2): accuracy 74% for correct vs 49% for incorrect assertions, with similar confidence in both.
- **Perry et al. 2023** (see §2): AI users wrote less secure code and were more confident of its security.
- **Cloude et al. 2024 (LAK '24)**, "Novice programmers inaccurately monitor the quality of their work and …" ([PDF](https://learninganalytics.upenn.edu/ryanbaker/LAK24_paper_73.pdf)). Overconfidence in novices' monitoring of their own work. Snippet only; not read in full.

### Inferences
- The thesis already plans a confidence rating per item. The design should report confidence × correctness per item and, if possible, a calibration index per participant. Kaufman et al. show the reliability of this rating cannot be assumed.

### Gaps
- No calibration study I found covers MCQ comprehension of AI code specifically. Metacognitive monitoring work for novices is well established, but I did not verify its measures.

---

## 5. Measurement design for MCQs (item-writing validity)

### Takeaway
A general MCQ item-writing reference exists. It warns that much item-writing advice has little empirical backing.

### Cited Findings
- Haladyna, Downing & Rodriguez 2002, "A Review of Multiple-Choice Item-Writing Guidelines for Classroom Assessment", Applied Measurement in Education 15(3):309–333, DOI 10.1207/S15324818AME1503_5 ([Taylor & Francis](https://www.tandfonline.com/doi/abs/10.1207/S15324818AME1503_5)). Reviews the item-writing guidelines and notes that many lack empirical support. Quoted from search snippets and an [ERIC record](https://eric.ed.gov/?id=EJ660246) that mentions a 31-guideline taxonomy; I did not read the full article. Also: Haladyna's own experiments on two item rules found no evidence for either option (partial-sentence stems; "none of the above") (ResearchGate abstract, snippet).

### Inferences
- Distractors for behaviour items should be built from the misconceptions Lopez/Whalley/Lister describe (e.g., stopping the loop early, reading the wrong variable). Otherwise guesses are rewarded, as in the Leeds study (~25% at guessing level).

### Gaps
- I did not check the psychometrics of code MCQs (item difficulty, discrimination) beyond what these snippets show.

---

## Ranked findings for the thesis

| # | Finding | Relevance | Reason |
|---|---|---|---|
| 1 | Lister et al. 2006; Lopez et al. 2008; Whalley et al. 2006 (SOLO/Bloom, explain-in-English, MCQ limits) | **High** | Direct justification and challenge for the MCQ + abstraction-level question; provides a vocabulary and a warning that MCQs cannot show the level of reasoning. |
| 2 | Kaufman, Brun, Murali & Endres 2026 (arXiv 2607.08885) | **High** | Closest study: judgement accuracy and confidence on generated code, flat confidence. Check the inconsistency in the confidence numbers. |
| 3 | Oertel, Klünder & Hebig 2026 (arXiv 2611.24216) | **High** | Recent comprehension-of-AI-code experiment with a stated instrument rationale; mutation finding as an alternative task; preprint. |
| 4 | Letovsky 1987 (specification / implementation / annotation) | **High** | Gives the purpose/intent level that the supervisor asked about; cited via arXiv 2310.11301. |
| 5 | Schulte 2008 Block Model (ICER 2008, DOI 10.1145/1404520.1404535) | **High** | Standard framework for levels (text surface, execution, function); lets the thesis map its five roles onto levels. Full text not read. |
| 6 | Wyrich, Bogner & Wagner 2023 (ACM CSUR, DOI 10.1145/3626522; arXiv 2206.11102) | **High** | Systematic mapping of 95 comprehension experiments; shows the gap (no own-code comprehension studies). Only the abstract was checked. |
| 7 | White et al. 2026 (arXiv 2611.12019) | **Medium** | Four-item quiz on AI-assisted reading; ceiling effects; novices; useful as a warning about item difficulty. |
| 8 | Yu, Treude & Aniche 2019 (arXiv 1907.13365) | **Medium** | Tests as a comprehension instrument (purpose, extension); human-written test code only. |
| 9 | Sillito et al. 2006/2008 (44 question types) | **Medium** | Catalogue of questions programmers ask; useful for writing roles as realistic questions. |
| 10 | Pennington 1987 (program vs situation model) | **Medium** | Classical basis for behaviour vs. situation levels; not verified in text. |
| 11 | Perry et al. 2023 (CCS, DOI 10.1145/3576915.3623157) | **Medium** | Overconfidence with AI assistants (security); supports the confidence measure, not comprehension. |
| 12 | Haladyna et al. 2002 (DOI 10.1207/S15324818AME1503_5) | **Medium** | Item-writing guidance with a caveat about empirical support. |
| 13 | arXiv 2310.11301 (contemporary comprehension definition) | **Medium** | Secondary summary of Letovsky, Brooks and Pennington; authors not checked. |
| 14 | Shen & Tamkin 2026 (arXiv 2601.20245) — **[already known]** | **High** (already in the thesis) | Quiz gap between AI and no-AI groups; question type matters (conceptual vs delegation). |
| 15 | Prather et al. 2024 (arXiv 2405.17739); Cloude et al. 2024 (LAK) | **Low** | Metacognition with AI; snippets only. |
| 16 | Kazemitabaar 2025; Ahmad 2026 — **[already known]** | **Not checked here** | Listed as known; not re-verified in this pass. |

## Answer to the supervisor's question (inference from the above)

- **Direct code questions (text surface, e.g., "what does line X do?")**: lowest level. Lister and Lopez tie this to novice reading and tracing; for AI code, it checks surface reading, which is the failure mode the thesis is about. Weak on its own.
- **Behaviour questions (current design: "scenario → what happens?")**: the Block Model's execution level and Lopez's tracing. Valid for "can the reader predict the code", but Lister warns that the MCQ form cannot show *why* the reader chose an option.
- **Tests questions ("here are the tests, what do they check?")**: Yu et al. show tests can measure purpose inference and extension. For generated tests, there is no evidence yet. Good candidate for one item per feature, as a separate level.
- **Higher abstraction (purpose, design decision, impact)**: Letovsky's specification and Lister's relational response. Recommended for at least one item per feature, phrased so the answer must state purpose ("Why does the agent ..." or "What is this for?") because wording decides the level.

**Suggested design direction (my recommendation, not a finding):** keep behaviour items for execution, add one purpose-level item and one test-based item per feature, report accuracy and confidence per level, and state in the limitations that MCQs show the choice but not the reasoning (Lister et al. 2006). Pilot the level mix against the Oertel-style mutation task if time allows.

## Gaps (summary)
- No MCQ or test-based comprehension study for AI-generated code was found that compares question levels.
- No validated mapping from Block Model or SOLO levels to MCQ items in the 2023–2026 AI literature.
- Full texts not read: Schulte 2008, Pennington 1987, Letovsky 1987, Wyrich et al. 2023 (PDF fetch failed), Lopez et al. 2008, Lister et al. 2006, Whalley et al. 2006, Yu et al. 2019, White et al. 2026, Prather et al. 2024, Cloude et al. 2024.
- Kaufman et al. 2026: confidence direction inconsistency in the abstract; limitations not extracted.
- Kazemitabaar 2025 and Ahmad 2026 not checked.
