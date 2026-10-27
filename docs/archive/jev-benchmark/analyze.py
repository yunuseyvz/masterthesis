import json, re, sys, statistics as st, collections, os
rows = [json.loads(l) for l in open(sys.argv[1])]
CORPUS = "/home/yunus/uni/masterthesis/code/server/corpus"
bad = [r for r in rows if r["status"] != 200 or not r["body"]]
print("requests", len(rows), "non-200", len(bad))
rows = [r for r in rows if r["status"] == 200 and r["body"]]
MTYPE = {"US1": "m1", "US5": "m1", "US2": "m2", "US6": "m2", "US3": "m3", "US4": "m3"}

def A(r, q, k=None):
    a = r["body"]["answers"][q]
    return a[k] if k else a

def feats(r):
    a = r["body"]["answers"]
    return {
        "scaff": a["is_scaffolding_step"]["noul"],
        "m1": a["m1_unspecified_case"]["noul"],
        "m2": a["m2_foundation"]["noul"],
        "m3": a["m3_test_blind_spot"]["noul"],
        "urg": a["intervention_urgency"]["score"] / 3,
        "not_scaff": 1 - a["is_scaffolding_step"]["noul"],
        "any_m": max(a["m1_unspecified_case"]["noul"], a["m2_foundation"]["noul"], a["m3_test_blind_spot"]["noul"]),
        "choice": a["checkpoint_classification"]["choice"],
        "ch_probs": a["checkpoint_classification"]["probabilities"],
    }
for r in rows: r["f"] = feats(r)

def auroc(pos, neg):
    if not pos or not neg: return float("nan")
    w = sum((p > q) + 0.5 * (p == q) for p in pos for q in neg)
    return w / (len(pos) * len(neg))

def fmt(x): return f"{x:.2f}"
for cond in ["step", "ctx"]:
    R = [r for r in rows if r["cond"] == cond]
    print(f"\n=== condition: {cond}  (n={len(R)}) ===")
    # per-step means
    print("mean scores by step (Correct+Flawed, all stories):")
    print("step kind        scaff   m1    m2    m3   urg")
    for n in [1, 2, 3, 4]:
        S = [r for r in R if r["n"] == n]
        print(f"{n}   {S[0]['kind']:<11} " + "  ".join(fmt(st.mean(r['f'][k] for r in S)) for k in ["scaff", "m1", "m2", "m3", "urg"]))
    pos = [r for r in R if r["kind"] == "milestone"]; neg = [r for r in R if r["kind"] != "milestone"]
    print("AUROC milestone vs other (positives n=%d, negatives n=%d):" % (len(pos), len(neg)))
    for k in ["not_scaff", "urg", "any_m", "m1", "m2", "m3"]:
        print(f"  {k:<10} {fmt(auroc([r['f'][k] for r in pos], [r['f'][k] for r in neg]))}")
    # top-1 step per story/variant by urgency (mean over reps)
    for k in ["urg", "not_scaff"]:
        hit = tot = 0
        for sid in sorted({r["id"] for r in R}):
            for v in ["Correct", "Flawed"]:
                means = {n: st.mean(r["f"][k] for r in R if r["id"] == sid and r["variant"] == v and r["n"] == n) for n in [1, 2, 3, 4]}
                top = max(means, key=means.get); tot += 1; hit += top == 2
        print(f"  top-1 step == milestone by {k}: {hit}/{tot}")
    # choice distribution by kind
    print("checkpoint_classification choice by step kind (counts):")
    for kind in ["scaffold", "milestone", "completion"]:
        c = collections.Counter(r["f"]["choice"] for r in R if r["kind"] == kind)
        print(f"  {kind:<10} {dict(c)}")
    # which M at milestone
    ms = [r for r in R if r["kind"] == "milestone"]
    ok_choice = sum(r["f"]["choice"].startswith(MTYPE[r["id"]]) for r in ms)
    ok_arg = sum(max(["m1", "m2", "m3"], key=lambda k: r["f"][k]) == MTYPE[r["id"]] for r in ms)
    print(f"  milestone type correct: choice {ok_choice}/{len(ms)}, argmax(m1,m2,m3) {ok_arg}/{len(ms)}  (chance 1/3; mapping from the exposé)")
    # variant sensitivity at milestone
    print("Flawed - Correct at milestone (mean over stories), per question:")
    for k in ["scaff", "m1", "m2", "m3", "urg"]:
        d = []
        for sid in sorted({r["id"] for r in R}):
            c = [r["f"][k] for r in ms if r["id"] == sid and r["variant"] == "Correct"]
            f = [r["f"][k] for r in ms if r["id"] == sid and r["variant"] == "Flawed"]
            d.append(st.mean(f) - st.mean(c))
        print(f"  {k:<6} mean {fmt(st.mean(d)):>6}  per-story {[fmt(x) for x in d]}")
    lat = sorted(r["ms"] for r in R)
    print(f"latency ms: mean {st.mean(lat):.0f}  median {st.median(lat):.0f}  p95 {lat[int(.95*len(lat))-1]:.0f}  min {lat[0]:.0f} max {lat[-1]:.0f}")
    print(f"tokens/request: in {st.mean(r['body']['usage']['input_tokens'] for r in R):.0f} out {st.mean(r['body']['usage']['output_tokens'] for r in R):.0f}; state chars mean {st.mean(r['stateChars'] for r in R):.0f}")

# determinism: identical request repeated
print("\n=== repeat consistency (same state, same cond, rep0 vs rep1) ===")
by = collections.defaultdict(dict)
for r in rows: by[(r["id"], r["variant"], r["n"], r["cond"])][r["rep"]] = r
diffs = {k: [] for k in ["scaff", "m1", "m2", "m3", "urg"]}; flips = 0; tot = 0
for key, d in by.items():
    if 0 in d and 1 in d:
        for k in diffs: diffs[k].append(abs(d[0]["f"][k] - d[1]["f"][k]))
        tot += 1; flips += d[0]["f"]["choice"] != d[1]["f"]["choice"]
for k, v in diffs.items(): print(f"  {k:<6} mean |Δ| {st.mean(v):.3f}  max {max(v):.2f}")
print(f"  choice label flips: {flips}/{tot}")
# step-1 states identical across conditions
ident = [(by[(i, v, 1, 'step')], by[(i, v, 1, 'ctx')]) for (i, v, n, c) in list(by) if n == 1 and c == "step"]
dd = [abs(a[0]["f"]["scaff"] - b[0]["f"]["scaff"]) for a, b in ident if 0 in a and 0 in b]
print(f"  identical-state check (step 1, cond step vs ctx): mean |Δscaff| {st.mean(dd):.3f}, max {max(dd):.2f}")

# baselines
print("\n=== baselines (milestone vs other, per story/variant/step) ===")
tok = re.compile(r"\b(if|for|while|throw|switch)\b|[-+*/]=|\?\?|\|\||&&|Math\.|\.match|\.filter|\.push|\.delete|\.set\(")
def code_score(sid, n):
    d = json.load(open(f"{CORPUS}/{sid}/story.json"))
    tot = 0
    for f in d["steps"][n - 1]["files"]:
        src = f["source"]; src = src["Correct"] if isinstance(src, dict) else src
        if "test" in f["path"]: continue
        tot += len(tok.findall(open(f"{CORPUS}/{sid}/{src}").read()))
    return tot
pos = [code_score(s, 2) for s in MTYPE]
neg = [code_score(s, n) for s in MTYPE for n in (1, 3, 4)]
print(f"  control-flow/arithmetic token count: AUROC {fmt(auroc(pos, neg))}  (pos {pos}, neg {neg})")
print("  step-index prior (step == 2): AUROC 1.00 by construction. Every story has the same step layout, so position alone solves this benchmark.")
