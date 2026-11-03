// Question set shared with evaluate-jev-v3.mjs (copied verbatim from it).
const yn = (instructions, trueDesc, falseDesc) => ({ type: "noul", instructions, criteria: { true: trueDesc, false: falseDesc } });

const FILES = "`agent_step.files`";
const QUESTIONS = {
  // Step shape
  s_logic: yn(
    `Does any function in ${FILES} contain a conditional (if, switch, ternary, loop, or catch) that chooses between different outcomes?`,
    "At least one function chooses between outcomes with a conditional",
    "No function contains such a conditional; the code only declares types or forwards values",
  ),
  s_state: yn(
    `Does any function in ${FILES} change stored data that outlives the function call?`,
    "A function assigns to or mutates data that persists after it returns",
    "No function changes persistent data",
  ),
  s_tests_only: yn(`Do the files in ${FILES} consist only of test code?`, "Only test code", "At least one file is not test code"),
  // M1: three atomic conditions, combined in code
  m1_special_inputs: yn(
    `Does any function in ${FILES} treat a failure, empty, or boundary input differently from normal input?`,
    "A function has separate handling for a failure, empty, or boundary input",
    "No separate handling for such inputs",
  ),
  m1_story_silent: yn(
    "Does `user_story` leave unspecified what should happen for the failure, empty, or boundary inputs that the code in `agent_step.files` handles?",
    "The story does not say what should happen for those inputs",
    "The story states what should happen for those inputs",
  ),
  m1_plural_outcomes: yn(
    "Given `user_story`, is more than one outcome reasonable for the failure, empty, or boundary inputs that the code in `agent_step.files` handles?",
    "At least two different outcomes would be reasonable",
    "Only one outcome is reasonable",
  ),
  // M2
  m2_owns_state: yn(
    `Does any function in ${FILES} keep or enforce data or a rule that other code would need to respect?`,
    "The code keeps data or enforces a rule that other code relies on",
    "The code keeps no data and enforces no rule",
  ),
  m2_exported: yn(
    `Does ${FILES} export a function that other modules would need to call to deliver \`user_story\`?`,
    "An exported function is needed by other modules to deliver the story",
    "Nothing exported here is needed by other modules",
  ),
  m2_self_contained: yn(
    `Could the behaviour in ${FILES} be checked on its own, before any other file for \`user_story\` is written?`,
    "The behaviour can be checked without any other new file",
    "The behaviour cannot be checked without other new files",
  ),
  // M3 (needs visible_tests; false when absent)
  m3_input_kinds: yn(
    `Does the code in ${FILES} distinguish several kinds of input, each leading to a different result?`,
    "The code distinguishes at least three kinds of input with different results",
    "The code treats all inputs alike or distinguishes only two kinds",
  ),
  m3_tests_fewer: yn(
    "Do the tests in `visible_tests` exercise fewer kinds of input than the code in `agent_step.files` distinguishes? If `visible_tests` is missing, answer no.",
    "The tests cover fewer kinds of input than the code distinguishes",
    "The tests cover every kind of input the code distinguishes, or there are no tests",
  ),
  // Holistic references (kept for comparison with the composites)
  pause_point: yn(
    "Does this step complete one self-contained piece of behaviour that later steps will build on?",
    "The step completes a piece of behaviour that later work depends on",
    "The step does not complete such a piece",
  ),
  intervention_urgency: {
    type: "score",
    instructions: "How important is it to pause the coding agent so a human can check this step before the agent continues?",
    criteria: ["Do not pause: routine", "Low: routine wiring", "Moderate: reviewable logic", "Critical: pause now"],
  },
};
// Choice asked twice with the option order reversed, to check order sensitivity.
const OPTS = [
  ["scaffolding", "Types, imports, or plumbing with no new behavioural decisions"],
  ["tests_only", "Only adds or changes tests"],
  ["behaviour_decision", "Core code that decides behaviour for inputs the user story leaves unspecified"],
  ["core_state_logic", "Core code that keeps data or enforces a rule that later code relies on"],
  ["many_input_cases", "Code that distinguishes many kinds of input"],
];
const choiceQ = (opts) => ({ type: "choice", instructions: "Which description fits this agent step best?", criteria: Object.fromEntries(opts) });
QUESTIONS.cls_a = choiceQ(OPTS);
QUESTIONS.cls_b = choiceQ([...OPTS].reverse());

export { QUESTIONS };
