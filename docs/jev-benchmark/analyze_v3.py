"""Analysis for evaluate-jev-v3.mjs output. Composites are fixed here, before looking at results:
  M1 = min(m1_special_inputs, m1_story_silent, m1_plural_outcomes)      (fuzzy AND)
  M2 = min(m2_owns_state, m2_exported, m2_self_contained)
  M3 = min(m3_input_kinds, m3_tests_fewer)
  PRIMARY  = max(M1, M2, M3)           milestone vs the rest
  secondary: pause_point, intervention_urgency/3
Label: step kind == "milestone" (Step 2). Resampling unit for CIs is the story (6)."""
import collections, json, random, re, statistics as st, sys

rows = [json.loads(l) for l in open(sys.argv[1])]
CORPUS = "/home/yunus/uni/masterthesis/code/server/corpus"
bad = [r for r in rows if r["status"] != 200 or not r["body"]]
print("requests", len(rows), "non-200", len(bad))
rows = [r for r in rows if r["status"] == 200 and r["body"]]
MT = {"US1": "M1", "US5": "M1", "US2": "M2", "US6": "M2", "US3": "M3", "US4": "M3"}  # exposé mapping

def f(r):
    a = r["body"]["answers"]; g = lambda k: a[k]["noul"]
    M = {"M1": min(g("m1_special_inputs"), g("m1_story_silent"), g("m1_plural_outcomes")),
         "M2": min(g("m2_owns_state"), g("m2_exported"), g("m2_self_contained")),
         "M3": min(g("m3_input_kinds"), g("m3_tests_fewer"))}
    return {**{k: g(k) for k in a if a[k]["type"] == "noul"}, **M, "primary": max(M.values()),
            "urg": a["intervention_urgency"]["score"] / 3, "ca": a["cls_a"]["choice"], "cb": a["cls_b"]["choice"],
            "substantive": max(g("s_logic"), g("s_state"))}
for r in rows:
    r["f"] = f(r); r["served"] = r["body"]["model"]

def auroc(pos, neg):
    if not pos or not neg: return float("nan")
    return sum((p > q) + 0.5 * (p == q) for p in pos for q in neg) / (len(pos) * len(neg))

def auc_ci(R, key, B=2000):
    stories = sorted({r["id"] for r in R}); rnd = random.Random(1); vals = []
    for _ in range(B):
        s = [rnd.choice(stories) for _ in stories]
        pos = [r["f"][key] for x in s for r in R if r["id"] == x and r["kind"] == "milestone"]
        neg = [r["f"][key] for x in s for r in R if r["id"] == x and r["kind"] != "milestone"]
        vals.append(auroc(pos, neg))
    vals.sort(); return vals[int(.025 * B)], vals[int(.975 * B)]

print("served models:", dict(collections.Counter(r["served"] for r in rows)))
for model in sorted({r["model"] for r in rows}):
    for cond in ["step", "tests"]:
        R = [r for r in rows if r["model"] == model and r["cond"] == cond]
        print(f"\n=== {model} / state={cond}  (n={len(R)}) ===")
        print("step kind        subst   M1    M2    M3  PRIMARY pause  urg")
        for n in (1, 2, 3, 4):
            S = [r for r in R if r["n"] == n]
            print(f"{n}   {S[0]['kind']:<11} " + "  ".join(f"{st.mean(r['f'][k] for r in S):.2f}" for k in ["substantive", "M1", "M2", "M3", "primary", "pause_point", "urg"]))
        for k in ["primary", "pause_point", "urg", "substantive", "M1", "M2", "M3"]:
            pos = [r["f"][k] for r in R if r["kind"] == "milestone"]; neg = [r["f"][k] for r in R if r["kind"] != "milestone"]
            lo, hi = auc_ci(R, k)
            print(f"  AUROC {k:<11} {auroc(pos, neg):.2f}   95% CI over stories [{lo:.2f}, {hi:.2f}]")
        hit = tot = 0
        for sid in sorted({r["id"] for r in R}):
            for v in ["Correct", "Flawed"]:
                m = {n: st.mean(r["f"]["primary"] for r in R if r["id"] == sid and r["variant"] == v and r["n"] == n) for n in (1, 2, 3, 4)}
                hit += max(m, key=m.get) == 2; tot += 1
        print(f"  Step 2 is top PRIMARY step in {hit}/{tot} story-variants")
        ms = [r for r in R if r["kind"] == "milestone"]
        print("  milestone type by argmax(M1,M2,M3):", sum(max(["M1", "M2", "M3"], key=lambda k: r["f"][k]) == MT[r["id"]] for r in ms), "/", len(ms), "(chance 8/24)")
        print("  choice at milestone (cls_a):", dict(collections.Counter(r["f"]["ca"] for r in ms)))
        agree = sum(r["f"]["ca"] == r["f"]["cb"] for r in R)
        print(f"  choice stable under reversed option order: {agree}/{len(R)}")
        d = []
        for sid in sorted({r["id"] for r in ms}):
            c = [r["f"]["primary"] for r in ms if r["id"] == sid and r["variant"] == "Correct"]
            fl = [r["f"]["primary"] for r in ms if r["id"] == sid and r["variant"] == "Flawed"]
            d.append(st.mean(fl) - st.mean(c))
        print(f"  invariance Flawed-Correct (PRIMARY at milestone) mean {st.mean(d):+.3f}  per story {[f'{x:+.2f}' for x in d]}")
        lat = sorted(r["ms"] for r in R)
        print(f"  latency ms mean {st.mean(lat):.0f} median {st.median(lat):.0f} p95 {lat[int(.95*len(lat))-1]:.0f}; tokens in/out {st.mean(r['body']['usage']['input_tokens'] for r in R):.0f}/{st.mean(r['body']['usage']['output_tokens'] for r in R):.0f}; cost/request ${st.mean(r['body']['usage']['cost'] for r in R):.6f}")

print("\n=== repeat consistency (same model, state, cond; rep0 vs rep1) ===")
by = collections.defaultdict(dict)
for r in rows: by[(r["model"], r["id"], r["variant"], r["n"], r["cond"])][r["rep"]] = r
for model in sorted({r["model"] for r in rows}):
    dd = [abs(d[0]["f"]["primary"] - d[1]["f"]["primary"]) for k, d in by.items() if k[0] == model and 0 in d and 1 in d]
    print(f"  {model}: PRIMARY mean |Δ| {st.mean(dd):.3f}  max {max(dd):.2f}")

print("\n=== jev-1.13 vs jev-1.14 on identical states (PRIMARY, rep0) ===")
a = [(by[("jev-1.13", *k)][0]["f"]["primary"], by[("jev-1.14", *k)][0]["f"]["primary"]) for k in [(i, v, n, c) for (m, i, v, n, c) in by if m == "jev-1.13"] if ("jev-1.14", *k) in by]
print(f"  mean |Δ| {st.mean(abs(x - y) for x, y in a):.3f}; corr {st.correlation([x for x, _ in a], [y for _, y in a]):.2f}")

print("\n=== baselines ===")
tok = re.compile(r"\b(if|for|while|throw|switch)\b|[-+*/]=|\?\?|\|\||&&|Math\.|\.match|\.filter|\.push|\.delete|\.set\(")
def code_score(sid, n):
    d = json.load(open(f"{CORPUS}/{sid}/story.json")); t = 0
    for fl in d["steps"][n - 1]["files"]:
        s = fl["source"]; s = s["Correct"] if isinstance(s, dict) else s
        if "test" not in fl["path"]: t += len(tok.findall(open(f"{CORPUS}/{sid}/{s}").read()))
    return t
pos = [code_score(s, 2) for s in MT]; neg = [code_score(s, n) for s in MT for n in (1, 3, 4)]
print(f"  regex count of control-flow/arithmetic tokens: AUROC {auroc(pos, neg):.2f}")
print("  position prior (step == 2): AUROC 1.00 by construction (fixed layout)")
