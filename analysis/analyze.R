# The planned analysis. Runs on the harness's trials.csv, real or simulated.
#
# Usage: Rscript analysis/analyze.R trials.csv [excluded participant IDs, comma-separated]
# As a library (power.R): source("analysis/analyze.R"); fit_feature(items_long(read_trials(path)))
suppressPackageStartupMessages({
  library(lme4)
  library(lmerTest)
})

REGIMES <- c("MILESTONE", "BATCH", "NON_MILESTONE") # MILESTONE first: the reference of every contrast
# The smallest difference in share correct that matters, in percentage points; fixed before data (equivalence test).
SESOI_POINTS <- 5
ctrl <- glmerControl(optimizer = "bobyqa", optCtrl = list(maxfun = 1e5))

read_trials <- function(path, exclude = character()) {
  # An empty cell is a missing value (an answer the script could not grade).
  d <- read.csv(path, stringsAsFactors = FALSE, na.strings = c("NA", ""))
  d <- d[!d$participant_id %in% exclude, ]
  for (c in names(d)) if (all(d[[c]] %in% c("true", "false", NA))) d[[c]] <- d[[c]] == "true"
  # Trials where the agent left the feature unfinished or the pause was missed are excluded.
  if ("featureComplete" %in% names(d)) {
    dropped <- !d$featureComplete | (if ("pauseMissed" %in% names(d)) d$pauseMissed else FALSE)
    if (any(dropped)) message(sprintf("excluded %d trial(s) (unfinished feature or missed pause)", sum(dropped)))
    d <- d[!dropped, ]
  }
  d$regime <- factor(d$regime, levels = REGIMES)
  d$flawed <- as.integer(d$variant == "Flawed")
  # The flaw as played at the first decision (H3). Where its step was not written yet, the decision could not depend
  # on it, so the assigned variant stands; "unknown" (the code does something else) is left out.
  d$flawed_played <- ifelse(d$flawAtDecision %in% c("present", "absent"), as.integer(d$flawAtDecision == "present"),
                            ifelse(d$flawAtDecision == "unwritten", d$flawed, NA))
  d$reject <- as.integer(d$initialDecision == "reject")
  d$position_c <- d$position - 3.5
  # Where the flaw subtask lies relative to what the review showed: in it (BATCH always), written before the pause
  # (in the files, not in the review), or not yet written (H3).
  d$flaw_rel <- factor(ifelse(d$regime == "BATCH" | d$flawStep == d$pauseStep, "in review",
                              ifelse(d$flawStep < d$pauseStep, "before", "after")), levels = c("in review", "before", "after"))
  d
}

# One row per understanding item: trial x item k. An item is "reviewed" when the pause followed the step it asks about
# (BATCH has no pause: 0). Answers the script could not grade on the code as played are missing, not wrong: left out.
items_long <- function(d, quiet = FALSE) {
  n_items <- sum(grepl("^u[0-9]+_correct$", names(d)))
  items <- do.call(rbind, lapply(seq_len(n_items), function(k) data.frame(
    participant_id = d$participant_id, story = d$story, regime = d$regime, position_c = d$position_c, item = k,
    role = d[[paste0("u", k, "_role")]],
    correct = as.integer(d[[paste0("u", k, "_correct")]]),
    confidence = d[[paste0("u", k, "_confidence")]],
    item_type = factor(ifelse(d[[paste0("u", k, "_milestone")]], "milestone", "other"), levels = c("milestone", "other")),
    reviewed = as.integer(d$regime != "BATCH" & d$pauseStep == d[[paste0("u", k, "_step")]]),
    adapted = as.logical(d[[paste0("u", k, "_adapted")]])
  )))
  missing <- is.na(items$correct)
  if (any(missing) && !quiet) message(sprintf("left out %d ungraded answer(s): %s", sum(missing),
    paste(names(table(items$regime[missing])), table(items$regime[missing]), sep = " ", collapse = ", ")))
  items[!missing, ]
}

holm <- function(p) p.adjust(p, "holm")

# The two contrasts of H1 and H2 from the regime coefficients (BATCH - MILESTONE, NON_MILESTONE - MILESTONE in
# log-odds), turned around so that a positive value favours MILESTONE.
regime_contrasts <- function(m) {
  s <- coef(summary(m))[c("regimeBATCH", "regimeNON_MILESTONE"), ]
  data.frame(contrast = c("MILESTONE vs BATCH", "MILESTONE vs NON_MILESTONE"),
             log_odds = -s[, "Estimate"], odds_ratio = exp(-s[, "Estimate"]), z = -s[, "z value"],
             p = s[, "Pr(>|z|)"], p_holm = holm(s[, "Pr(>|z|)"]), row.names = NULL)
}

# H1 (primary): all items of the feature.
fit_feature <- function(items) {
  glmer(correct ~ regime + position_c + (1 | participant_id) + (1 | story) + (1 | story:item),
        data = items, family = binomial, control = ctrl)
}

# H1b beyond the paused step: the two pause regimes only, with "the pause followed the item's step" as a covariate.
# MILESTONE has more items about its paused step (14 of 30) than NON_MILESTONE (10), so H1b could come from that alone.
fit_beyond <- function(items) {
  paused <- droplevels(items[items$regime != "BATCH", ])
  glmer(correct ~ regime + reviewed + position_c + (1 | participant_id) + (1 | story) + (1 | story:item),
        data = paused, family = binomial, control = ctrl)
}
beyond_contrast <- function(m) {
  s <- coef(summary(m))[c("regimeNON_MILESTONE", "reviewed"), ]
  data.frame(term = c("MILESTONE vs NON_MILESTONE", "pause followed the item's step"),
             log_odds = c(-s[1, "Estimate"], s[2, "Estimate"]), z = c(-s[1, "z value"], s[2, "z value"]),
             p = s[, "Pr(>|z|)"], row.names = NULL)
}

# Equivalence (two one-sided tests) for the H1 contrasts, so that a non-significant one can be read: the contrast is
# equivalent when its 90 % CI lies within +-SESOI_POINTS, turned into log-odds at MILESTONE's share correct for a
# typical participant and item (random effects at zero, centred position).
equivalence <- function(m) {
  p0 <- plogis(fixef(m)[["(Intercept)"]])
  low <- qlogis(p0) - qlogis(min(p0 + SESOI_POINTS / 100, 0.999)) # the other regime 5 points better
  high <- qlogis(p0) - qlogis(max(p0 - SESOI_POINTS / 100, 0.001)) # the other regime 5 points worse
  s <- coef(summary(m))[c("regimeBATCH", "regimeNON_MILESTONE"), ]
  est <- -s[, "Estimate"]
  se <- s[, "Std. Error"]
  p <- pmax(pnorm((est - low) / se, lower.tail = FALSE), pnorm((est - high) / se))
  data.frame(contrast = c("MILESTONE vs BATCH", "MILESTONE vs NON_MILESTONE"), log_odds = est,
             ci90_low = est - qnorm(0.95) * se, ci90_high = est + qnorm(0.95) * se, bound_low = low, bound_high = high,
             p_tost = p, equivalent = p < 0.05, row.names = NULL)
}

# H2: the milestone item. Milestone is the reference item type, so the regime coefficients are the contrasts on it.
fit_decision <- function(items) {
  glmer(correct ~ regime * item_type + position_c + (1 | participant_id) + (1 | story) + (1 | story:item),
        data = items, family = binomial, control = ctrl)
}

# H3. Equal-variance signal detection as a probit model: the flawed coefficient is d', the intercept is -c.
# With MILESTONE as reference, regimeX:flawed is d'(X) - d'(MILESTONE) when the flaw subtask was in the review;
# flawed:flaw_rel takes out the trials where it was not. `flawed` is the flaw as played (as_played) or as assigned.
as_played <- function(d) {
  d <- d[!is.na(d$flawed_played), ]
  d$flawed <- d$flawed_played
  d
}
fit_sdt <- function(d) {
  rel <- if (length(unique(d$flaw_rel)) > 1) " + flawed:flaw_rel" else ""
  glmer(as.formula(paste0("reject ~ regime * flawed", rel, " + position_c + (1 | participant_id) + (1 | story)")),
        data = d, family = binomial(link = "probit"), control = ctrl)
}
sdt_contrasts <- function(m) {
  s <- coef(summary(m))[c("regimeBATCH:flawed", "regimeNON_MILESTONE:flawed"), , drop = FALSE]
  data.frame(contrast = c("d' MILESTONE vs BATCH", "d' MILESTONE vs NON_MILESTONE"),
             difference = -s[, "Estimate"], z = -s[, "z value"], p = s[, "Pr(>|z|)"], p_holm = holm(s[, "Pr(>|z|)"]),
             row.names = NULL)
}
dprime_by_regime <- function(m) {
  b <- fixef(m)
  data.frame(regime = REGIMES,
             dprime = b["flawed"] + c(0, b["regimeBATCH:flawed"], b["regimeNON_MILESTONE:flawed"]),
             criterion = -(b["(Intercept)"] + c(0, b["regimeBATCH"], b["regimeNON_MILESTONE"])), row.names = NULL)
}

pct <- function(x) sprintf("%.0f %%", 100 * mean(x))

# How often a correct answer has higher confidence than a wrong one (ties count half); pooled over people.
auroc <- function(score, positive) {
  r <- rank(score)
  n1 <- sum(positive == 1)
  n0 <- sum(positive == 0)
  (sum(r[positive == 1]) - n1 * (n1 + 1) / 2) / (n1 * n0)
}

report <- function(d) {
  items <- items_long(d)
  cat(sprintf("%d participants, %d trials, %d understanding items\n\n", length(unique(d$participant_id)), nrow(d), nrow(items)))

  cat("== Understanding: share correct (regime x item type)\n")
  print(with(items, tapply(correct, list(regime, item_type), function(x) round(100 * mean(x)))))
  cat("\n== H1 (primary): all items of the feature\n")
  print(regime_contrasts(fit_feature(items)), digits = 3)
  cat("\nSensitivity: without the flaw item\n")
  print(regime_contrasts(fit_feature(items[items$role != "flaw", ])), digits = 3)
  cat("\nSensitivity: without items whose options the code as played changed\n")
  print(regime_contrasts(fit_feature(items[!items$adapted, ])), digits = 3)
  cat("\nSensitivity: H1b beyond the paused step (pause regimes only)\n")
  print(beyond_contrast(fit_beyond(items)), digits = 3)
  cat(sprintf("\nEquivalence (TOST, +-%d points; read a non-significant H1 contrast only through this)\n", SESOI_POINTS))
  print(equivalence(fit_feature(items)), digits = 3)

  cat("\n== H2: the milestone item\n")
  print(regime_contrasts(fit_decision(items)), digits = 3)

  cat("\n== Exploratory: milestone or just reviewed? (items of the pause regimes)\n")
  m1b <- glmer(correct ~ reviewed * item_type + position_c + (1 | participant_id) + (1 | story) + (1 | story:item),
               data = items[items$regime != "BATCH", ], family = binomial, control = ctrl)
  print(coef(summary(m1b))[-1, ], digits = 3)

  cat("\n== Exploratory: share correct by item role\n")
  print(with(items, tapply(correct, list(regime, role), function(x) round(100 * mean(x)))))
  cat("\n== Exploratory: what builds on the milestone (dependency items)\n")
  dep <- items[items$role == "dependency", ]
  m1c <- tryCatch(suppressMessages(glmer(correct ~ regime + position_c + (1 | participant_id) + (1 | story), data = dep, family = binomial, control = ctrl)),
                  error = function(e) NULL)
  if (is.null(m1c)) cat("model did not fit\n") else print(coef(summary(m1c))[-1, ], digits = 3)

  cat("\n== The trial as played\n")
  print(table(variant = d$variant, at_decision = d$flawAtDecision))
  print(table(variant = d$variant, at_end = d$flawAtEnd))
  cat(sprintf("open case as scripted: %s; a reviewed step accepted after failing its check: %d trial(s)\n",
              pct(d$openCaseAsScripted[!is.na(d$openCaseAsScripted)]), sum(d$pauseStepForced)))
  print(with(d, tapply(pauseStepForced, regime, sum)))

  cat("\n== H3: fault detection (initial decision), d' when the flaw subtask was in the review; flaw as played\n")
  print(table(regime = d$regime, flaw = d$flaw_rel))
  m2 <- fit_sdt(as_played(d))
  print(dprime_by_regime(m2), digits = 3)
  print(sdt_contrasts(m2), digits = 3)
  b <- fixef(m2)
  cat(sprintf("d' lower by %.2f when the flaw subtask was written before the pause, by %.2f when after\n",
              -b["flawed:flaw_relbefore"], -b["flawed:flaw_relafter"]))
  cat("\nOnly reviews that contained the flaw subtask:\n")
  seen <- as_played(d[d$flawStepReviewed, ])
  print(table(regime = seen$regime, flawed = seen$flawed))
  m2s <- fit_sdt(seen)
  print(dprime_by_regime(m2s), digits = 3)
  cat("\nSensitivity: the flaw as assigned (variant)\n")
  print(sdt_contrasts(fit_sdt(d)), digits = 3)

  cat("\n== H4: confidence vs correctness (overconfidence = confidence - correct, in points)\n")
  items$over <- items$confidence - 100 * items$correct
  print(with(items, tapply(over, list(regime, item_type), function(x) round(mean(x), 1))))
  m3 <- lmer(over ~ regime * item_type + position_c + (1 | participant_id) + (1 | story) + (1 | story:item), data = items)
  print(coef(summary(m3))[c("regimeBATCH", "regimeNON_MILESTONE"), ], digits = 3)
  cat("\nExploratory: Brier score (0 is best) and resolution (AUROC of confidence for a correct answer, .5 = none)\n")
  print(data.frame(
    brier = tapply((items$confidence / 100 - items$correct)^2, items$regime, mean),
    resolution = sapply(split(items, items$regime), function(x) auroc(x$confidence, x$correct))
  ), digits = 3)

  cat("\n== H5: reversals after the behaviour question\n")
  print(with(d, tapply(decisionReversed, list(regime, variant), function(x) sprintf("%d/%d", sum(x), length(x)))))
  if (sum(d$decisionReversed) >= 10) {
    m4 <- glmer(decisionReversed ~ regime + (1 | participant_id), data = d, family = binomial, control = ctrl)
    print(coef(summary(m4))[-1, ], digits = 3)
  } else cat("fewer than 10 reversals: descriptive only\n")

  cat("\n== Descriptive: time (median minutes), mental effort (Paas 1-9) and the review statements (1-7), means\n")
  avg <- function(x) tapply(x, d$regime, function(v) round(mean(v), 1))
  print(data.frame(
    review_before_decision = tapply(d$stage1DwellMs, d$regime, function(x) round(median(x) / 60000, 1)),
    final_review = tapply(d$finalReviewMs, d$regime, function(x) round(median(x) / 60000, 1)),
    paas = avg(d$paas), good_moment = avg(d$pauseTiming), helped = avg(d$pauseHelped), interrupted = avg(d$pauseDisrupted)
  ))
  cat("\nFinal decision correct (reject flawed, accept correct):",
      paste(sapply(REGIMES, function(r) { x <- d[d$regime == r, ]; paste(r, pct((x$finalDecision == "reject") == (x$variant == "Flawed"))) }), collapse = ", "), "\n")
}

if (sys.nframe() == 0) {
  args <- commandArgs(trailingOnly = TRUE)
  if (length(args) < 1) stop("usage: Rscript analysis/analyze.R trials.csv [excluded,ids]")
  exclude <- if (length(args) >= 2) strsplit(args[2], ",")[[1]] else character()
  report(read_trials(args[1], exclude))
}
