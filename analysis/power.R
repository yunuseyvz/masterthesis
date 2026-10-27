# Power by simulation: many fictitious studies under assumed effects, each analysed as planned (analyze.R).
#
# Usage: Rscript analysis/power.R [simulations per scenario] [N,N,...]
# Needs design files from design.ts: analysis/scenario/design-<N>.csv (written if missing).
suppressPackageStartupMessages(library(parallel))
source("analysis/simulate.R")
source("analysis/analyze.R")

args <- commandArgs(trailingOnly = TRUE)
nsim <- if (length(args) >= 1) as.integer(args[1]) else 200
sizes <- if (length(args) >= 2) as.integer(strsplit(args[2], ",")[[1]]) else c(30, 60)

# Effect on a milestone item when the agent paused there, relative to BATCH, in log-odds:
# reviewed + milestone_pause (vs NON_MILESTONE the same, since NON never pauses at the milestone).
scenarios <- list(
  "none (0)"          = modifyList(truth_default, list(reviewed = 0, milestone_pause = 0,
                                                         dprime = c(BATCH = 1, MILESTONE = 1, NON_MILESTONE = 1))),
  "small (+0.4, about +9 points)"  = modifyList(truth_default, list(milestone_pause = 0.1)),
  "medium (+0.8, about +18 points)" = truth_default,
  "large (+1.2, about +26 points)" = modifyList(truth_default, list(milestone_pause = 0.9))
)

one <- function(design, truth) {
  path <- tempfile(fileext = ".csv")
  write_trials(simulate_trials(design, truth), path)
  d <- read_trials(path)
  unlink(path)
  p1 <- tryCatch(primary_contrasts(suppressMessages(fit_primary(items_long(d))))$p_holm, error = function(e) c(NA, NA))
  p2 <- tryCatch(sdt_contrasts(suppressMessages(fit_sdt(d)))$p_holm, error = function(e) c(NA, NA))
  c(h1_batch = p1[1], h1_non = p1[2], h2_batch = p2[1], h2_non = p2[2])
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
      `H2 d' M vs B` = sig["h2_batch"], `H2 d' M vs N` = sig["h2_non"],
      failed = sum(is.na(p[, 1])), check.names = FALSE, row.names = NULL)
    cat(sprintf("N=%d %s done\n", n, name), file = stderr())
  }
}
res <- do.call(rbind, rows)
res[3:7] <- lapply(res[3:7], function(x) sprintf("%.0f %%", 100 * x))
cat(sprintf("Power (share of %d simulated studies with p_holm < .05)\n\n", nsim))
print(res, row.names = FALSE)
