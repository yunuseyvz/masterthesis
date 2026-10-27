# Fictitious data for the study: draws outcomes onto the real design (design.ts) from assumed effects, and writes
# them in the harness's trials.csv format, so analyze.R runs on them unchanged.
#
# Usage: Rscript analysis/simulate.R design.csv trials.csv [seed]
# As a library (power.R): source("analysis/simulate.R"); simulate_trials(design, truth)

# The assumed truth. Logits for understanding items, d' and criterion for the accept/reject decision.
truth_default <- list(
  base = qlogis(0.65),      # an item about a subtask nobody paused at
  milestone_gap = -0.5,     # milestone items are harder: the agent's silent decisions sit there
  reviewed = 0.3,           # any pause helps the item about the paused subtask
  milestone_pause = 0.5,    # pausing at the milestone helps its item beyond that (the hypothesis)
  sd_participant = 0.7, sd_story = 0.3, sd_item = 0.4,
  dprime = c(BATCH = 0.8, MILESTONE = 1.3, NON_MILESTONE = 1.0), # when the flaw subtask was in the review
  dprime_unseen = 0.1,      # when it was not
  criterion = 0.4, sd_criterion = 0.3,
  confidence_pause = 4      # a pause raises confidence on every item, right or wrong
)

# Column order of study-harness/server/src/export.ts.
csv_columns <- c(
  "participant_id", "study_seed", "group",
  "position", "story", "regime", "variant", "milestoneStep", "flawStep", "pauseStep", "flawStepReviewed", "probeStep",
  "initialDecision", "finalDecision", "decisionReversed", "reviewedLines", "planMs", "stage1DwellMs",
  "changesViewMsStage1", "diffCoverageStage1", "filesOpenedStage1", "terminalCommandsStage1", "testRunsStage1",
  "testFailRunsStage1", "hunksStage1", "hunksViewedStage1", "flawRegionMsStage1", "flawRegionSeenStage1",
  "unfocusedMsStage1", "idleMsStage1", "chatScrollBacksStage1", "toolExpandsStage1", "stage2ProbeLatencyMs",
  "terminalCommandsProbe", "probeAnswer", "probeCorrect", "finalReviewMs", "changesViewMsFinal", "hunksFinal",
  "hunksViewedFinal", "flawRegionMsFinal", "flawRegionSeenFinal", "unfocusedMsFinal", "idleMsFinal",
  "understandingScore", "paas",
  as.vector(t(outer(1:4, c("answer", "correct", "confidence", "milestone", "ms", "changes"), function(k, c) paste0("u", k, "_", c))))
)

read_design <- function(path) {
  d <- read.csv(path, stringsAsFactors = FALSE)
  d$flawStepReviewed <- d$flawStepReviewed == "true"
  d
}

simulate_trials <- function(design, truth = truth_default) {
  d <- design
  n <- nrow(d)
  people <- unique(d$participant_id)
  stories <- unique(d$story)
  u_p <- setNames(rnorm(length(people), 0, truth$sd_participant), people)
  u_s <- setNames(rnorm(length(stories), 0, truth$sd_story), stories)
  u_i <- matrix(rnorm(length(stories) * 4, 0, truth$sd_item), ncol = 4, dimnames = list(stories, 1:4))
  conf_p <- setNames(rnorm(length(people), 0, 6), people)
  crit_p <- setNames(rnorm(length(people), truth$criterion, truth$sd_criterion), people)
  paused <- d$regime != "BATCH"

  out <- as.data.frame(setNames(replicate(length(csv_columns), rep(NA, n), simplify = FALSE), csv_columns))
  out[names(d)] <- d
  for (k in 1:4) {
    milestone <- d$milestoneStep == k
    reviewed <- paused & d$pauseStep == k
    eta <- truth$base + truth$milestone_gap * milestone + truth$reviewed * reviewed +
      truth$milestone_pause * (reviewed & milestone) + u_p[d$participant_id] + u_s[d$story] + u_i[cbind(d$story, k)]
    correct <- rbinom(n, 1, plogis(eta)) == 1
    conf <- 70 + 8 * correct + 4 * reviewed + truth$confidence_pause * paused + conf_p[d$participant_id] + rnorm(n, 0, 10)
    out[[paste0("u", k, "_correct")]] <- correct
    out[[paste0("u", k, "_confidence")]] <- pmin(100, pmax(50, round(conf)))
    out[[paste0("u", k, "_milestone")]] <- milestone
  }
  out$understandingScore <- rowSums(out[paste0("u", 1:4, "_correct")])

  flawed <- d$variant == "Flawed"
  dprime <- ifelse(d$flawStepReviewed, truth$dprime[d$regime], truth$dprime_unseen)
  reject <- rbinom(n, 1, pnorm(-crit_p[d$participant_id] + dprime * (flawed - 0.5))) == 1
  # The behaviour question asks about the flaw subtask when the review contained it; on flawed code that can
  # reveal the flaw and turn an accept into a reject.
  revealing <- flawed & d$flawStepReviewed & !reject
  reversed <- rbinom(n, 1, ifelse(revealing, 0.3, 0.05)) == 1
  out$initialDecision <- ifelse(reject, "reject", "accept")
  out$finalDecision <- ifelse(xor(reject, reversed), "reject", "accept")
  out$decisionReversed <- reversed
  out$probeStep <- ifelse(paused, d$pauseStep, d$flawStep)

  out$stage1DwellMs <- round(exp(log(ifelse(paused, 100, 200)) + rnorm(n, 0, 0.5)) * 1000)
  out$finalReviewMs <- round(exp(log(ifelse(paused, 120, 60)) + rnorm(n, 0, 0.5)) * 1000)
  out$paas <- pmin(9, pmax(1, round(5 + 0.5 * !paused + rnorm(n, 0, 1.2))))
  out
}

# The harness writes booleans as true/false.
write_trials <- function(df, path) {
  for (c in names(df)) if (is.logical(df[[c]])) df[[c]] <- ifelse(is.na(df[[c]]), NA, ifelse(df[[c]], "true", "false"))
  write.csv(df, path, row.names = FALSE, quote = FALSE, na = "")
}

if (sys.nframe() == 0) {
  args <- commandArgs(trailingOnly = TRUE)
  if (length(args) < 2) stop("usage: Rscript analysis/simulate.R design.csv trials.csv [seed]")
  set.seed(if (length(args) >= 3) as.integer(args[3]) else 1)
  write_trials(simulate_trials(read_design(args[1])), args[2])
}
