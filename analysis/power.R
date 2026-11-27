# Power by simulation: many fictitious studies under assumed effects, each analysed as planned (analyze.R).
#
# Usage: Rscript analysis/power.R [simulations per scenario] [N,N,...]
# Needs design files from design.ts: analysis/scenario/design-<N>.csv (written if missing).
suppressPackageStartupMessages(library(parallel))
source("analysis/simulate.R")
source("analysis/analyze.R")

args <- commandArgs(trailingOnly = TRUE)
nsim <- if (length(args) >= 1) as.integer(args[1]) else 200
sizes <- if (length(args) >= 2) as.integer(strsplit(args[2], ",")[[1]]) else c(30, 36)

# A pause at the milestone, in log-odds: feature_pause on every item of the feature (H1), and on the milestone item
# reviewed + feature_pause + milestone_pause (H2; the same against both regimes, since neither pauses at the milestone).
# The d' in H3 stay as in truth_default except in "none" and "reviewed only".
scenarios <- list(
  "none"   = modifyList(truth_default, list(reviewed = 0, feature_pause = 0, milestone_pause = 0,
                                            dprime = c(BATCH = 1, MILESTONE = 1, NON_MILESTONE = 1))),
  "small"  = modifyList(truth_default, list(feature_pause = 0.2, milestone_pause = 0)),
  "medium" = truth_default,
  "large"  = modifyList(truth_default, list(feature_pause = 0.5, milestone_pause = 0.4)),
  # A pause helps the items about the step it follows, the milestone nothing beyond: what H1b and H2b find from where
  # the items lie alone (MILESTONE pauses after the step of 14 of 30 items, NON_MILESTONE of 10). Last, so the seeds of
  # the others stay.
  "reviewed only" = modifyList(truth_default, list(feature_pause = 0, milestone_pause = 0,
                                                   dprime = c(BATCH = 1, MILESTONE = 1, NON_MILESTONE = 1)))
)

one <- function(design, truth) {
  path <- tempfile(fileext = ".csv")
  write_trials(simulate_trials(design, truth), path)
  d <- read_trials(path)
  unlink(path)
  items <- items_long(d)
  f1 <- tryCatch(suppressMessages(fit_feature(items)), error = function(e) NULL)
  p1 <- if (is.null(f1)) c(NA, NA) else regime_contrasts(f1)$p_holm
  # p of the equivalence test for H1b: below .05 means "no difference of 5 points or more"
  pe <- if (is.null(f1)) NA else equivalence(f1)$p_tost[2]
  pb <- tryCatch(beyond_contrast(suppressMessages(fit_beyond(items)))$p[1], error = function(e) NA)
  p2 <- tryCatch(regime_contrasts(suppressMessages(fit_decision(items)))$p_holm, error = function(e) c(NA, NA))
  p3 <- tryCatch(sdt_contrasts(suppressMessages(fit_sdt(d)))$p_holm, error = function(e) c(NA, NA))
  c(h1_batch = p1[1], h1_non = p1[2], h1_beyond = pb, h1_equiv = pe, h2_batch = p2[1], h2_non = p2[2], h3_batch = p3[1], h3_non = p3[2])
}

rows <- list()
for (n in sizes) {
  f <- sprintf("analysis/scenario/design-%d.csv", n)
  if (!file.exists(f)) system2("npx", c("tsx", "analysis/design.ts", n), stdout = f)
  design <- read_design(f)
  for (name in names(scenarios)) {
    RNGkind("L'Ecuyer-CMRG"); set.seed(n * 1000 + match(name, names(scenarios)))
    p <- do.call(rbind, mclapply(seq_len(nsim), function(i) suppressWarnings(one(design, scenarios[[name]])),
                                 mc.cores = detectCores(), mc.set.seed = TRUE))
    sig <- colMeans(p < 0.05, na.rm = TRUE)
    rows[[length(rows) + 1]] <- data.frame(
      N = n, effect = name,
      `H1 M vs B` = sig["h1_batch"], `H1 M vs N` = sig["h1_non"],
      `H1 both` = mean(p[, "h1_batch"] < 0.05 & p[, "h1_non"] < 0.05, na.rm = TRUE),
      `H1b beyond pause` = sig["h1_beyond"], `H1b equivalent` = sig["h1_equiv"],
      `H2 M vs B` = sig["h2_batch"], `H2 M vs N` = sig["h2_non"],
      `H3 d' M vs B` = sig["h3_batch"], `H3 d' M vs N` = sig["h3_non"],
      failed = sum(is.na(p[, 1])), check.names = FALSE, row.names = NULL)
    cat(sprintf("N=%d %s done\n", n, name), file = stderr())
  }
}
res <- do.call(rbind, rows)
res[3:11] <- lapply(res[3:11], function(x) sprintf("%.0f %%", 100 * x))
cat(sprintf("Power (share of %d simulated studies with p < .05: Holm within each hypothesis; H1b beyond pause unadjusted; H1b equivalent: the equivalence test)\n\n", nsim))
print(res, row.names = FALSE)
