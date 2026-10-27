# The planned analysis (docs/analysis-plan.md). Runs on the harness's trials.csv, real or simulated.
#
# Usage: Rscript analysis/analyze.R trials.csv [excluded participant IDs, comma-separated]
# As a library (power.R): source("analysis/analyze.R"); fit_primary(items_long(read_trials(path)))
suppressPackageStartupMessages({
  library(lme4)
  library(lmerTest)
})

REGIMES <- c("MILESTONE", "BATCH", "NON_MILESTONE") # MILESTONE first: the reference of every contrast
ctrl <- glmerControl(optimizer = "bobyqa", optCtrl = list(maxfun = 1e5))

read_trials <- function(path, exclude = character()) {
  d <- read.csv(path, stringsAsFactors = FALSE)
  d <- d[!d$participant_id %in% exclude, ]
  for (c in names(d)) if (all(d[[c]] %in% c("true", "false", NA))) d[[c]] <- d[[c]] == "true"
  d$regime <- factor(d$regime, levels = REGIMES)
  d$flawed <- as.integer(d$variant == "Flawed")
  d$reject <- as.integer(d$initialDecision == "reject")
  d$position_c <- d$position - 3.5
  d
}

# One row per understanding item: trial x subtask k.
items_long <- function(d) {
  do.call(rbind, lapply(1:4, function(k) data.frame(
    participant_id = d$participant_id, story = d$story, regime = d$regime, position_c = d$position_c, item = k,
    correct = as.integer(d[[paste0("u", k, "_correct")]]),
    confidence = d[[paste0("u", k, "_confidence")]],
    item_type = factor(ifelse(d[[paste0("u", k, "_milestone")]], "milestone", "other"), levels = c("milestone", "other")),
    reviewed = as.integer(d$regime != "BATCH" & d$pauseStep == k)
  )))
}

holm <- function(p) p.adjust(p, "holm")

# H1 (primary). Coded so that the regime coefficients are the contrasts on milestone items:
# BATCH - MILESTONE and NON_MILESTONE - MILESTONE, in log-odds.
fit_primary <- function(items) {
  glmer(correct ~ regime * item_type + position_c + (1 | participant_id) + (1 | story) + (1 | story:item),
        data = items, family = binomial, control = ctrl)
}
primary_contrasts <- function(m) {
  s <- coef(summary(m))[c("regimeBATCH", "regimeNON_MILESTONE"), ]
  data.frame(contrast = c("MILESTONE vs BATCH", "MILESTONE vs NON_MILESTONE"),
             log_odds = -s[, "Estimate"], odds_ratio = exp(-s[, "Estimate"]), z = -s[, "z value"],
             p = s[, "Pr(>|z|)"], p_holm = holm(s[, "Pr(>|z|)"]), row.names = NULL)
}

# H2. Equal-variance signal detection as a probit model: the flawed coefficient is d', the intercept is -c.
# With MILESTONE as reference, regimeX:flawed is d'(X) - d'(MILESTONE).
fit_sdt <- function(d) {
  glmer(reject ~ regime * flawed + position_c + (1 | participant_id) + (1 | story),
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

report <- function(d) {
  items <- items_long(d)
  cat(sprintf("%d participants, %d trials, %d understanding items\n\n", length(unique(d$participant_id)), nrow(d), nrow(items)))

  cat("== Understanding: share correct (regime x item type)\n")
  print(with(items, tapply(correct, list(regime, item_type), function(x) round(100 * mean(x)))))
  cat("\n== H1 (primary): milestone items\n")
  m1 <- fit_primary(items)
  print(primary_contrasts(m1), digits = 3)

  cat("\n== Exploratory: milestone or just reviewed? (items, all regimes)\n")
  m1b <- glmer(correct ~ reviewed * item_type + position_c + (1 | participant_id) + (1 | story) + (1 | story:item),
               data = items, family = binomial, control = ctrl)
  print(coef(summary(m1b))[-1, ], digits = 3)

  cat("\n== H2: fault detection (initial decision)\n")
  m2 <- fit_sdt(d)
  print(dprime_by_regime(m2), digits = 3)
  print(sdt_contrasts(m2), digits = 3)
  cat("\nOnly reviews that contained the flaw subtask:\n")
  seen <- d[d$flawStepReviewed, ]
  print(table(regime = seen$regime, variant = seen$variant))
  m2s <- fit_sdt(seen)
  print(dprime_by_regime(m2s), digits = 3)

  cat("\n== H3: confidence vs correctness (overconfidence = confidence - correct, in points)\n")
  items$over <- items$confidence - 100 * items$correct
  print(with(items, tapply(over, list(regime, item_type), function(x) round(mean(x), 1))))
  m3 <- lmer(over ~ regime * item_type + position_c + (1 | participant_id) + (1 | story), data = items)
  print(coef(summary(m3))[c("regimeBATCH", "regimeNON_MILESTONE"), ], digits = 3)

  cat("\n== H4: reversals after the behaviour question\n")
  print(with(d, tapply(decisionReversed, list(regime, variant), function(x) sprintf("%d/%d", sum(x), length(x)))))
  if (sum(d$decisionReversed) >= 10) {
    m4 <- glmer(decisionReversed ~ regime + (1 | participant_id), data = d, family = binomial, control = ctrl)
    print(coef(summary(m4))[-1, ], digits = 3)
  } else cat("fewer than 10 reversals: descriptive only\n")

  cat("\n== Descriptive: time (median minutes) and mental effort (Paas, mean)\n")
  print(data.frame(
    review_before_decision = tapply(d$stage1DwellMs, d$regime, function(x) round(median(x) / 60000, 1)),
    final_review = tapply(d$finalReviewMs, d$regime, function(x) round(median(x) / 60000, 1)),
    paas = tapply(d$paas, d$regime, function(x) round(mean(x), 1))
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
