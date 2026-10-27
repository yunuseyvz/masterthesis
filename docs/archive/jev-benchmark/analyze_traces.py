"""Jev on unscripted agent traces. Label L1 (mechanical, see extract_traces.py): the step adds a logic file that a later commit imports.
usage: python3 -I analyze_traces.py <traces.json> <results.jsonl>"""
import collections, json, random, statistics as st, sys
T = {t["trace"]: t for t in json.load(open(sys.argv[1]))}
rows = [json.loads(l) for l in open(sys.argv[2])]
print("requests", len(rows), "non-200", sum(r["status"] != 200 for r in rows))
rows = [r for r in rows if r["status"] == 200 and r["body"]]
print("served models:", dict(collections.Counter(r["body"]["model"] for r in rows)))
def f(r):
    a = r["body"]["answers"]; g = lambda k: a[k]["noul"]
    M = {"M1": min(g("m1_special_inputs"), g("m1_story_silent"), g("m1_plural_outcomes")),
         "M2": min(g("m2_owns_state"), g("m2_exported"), g("m2_self_contained")),
         "M3": min(g("m3_input_kinds"), g("m3_tests_fewer"))}
    return {**M, "primary": max(M.values()), "pause_point": g("pause_point"), "urg": a["intervention_urgency"]["score"] / 3,
            "substantive": max(g("s_logic"), g("s_state")), "tests_only": g("s_tests_only")}
for r in rows: r["f"] = f(r); r["lines"] = T[r["trace"]]["steps"][r["n"] - 1]["lines_added"]; r["nlogic"] = len(T[r["trace"]]["steps"][r["n"] - 1]["logic_files"])
def auroc(p, n):
    return float("nan") if not p or not n else sum((x > y) + .5 * (x == y) for x in p for y in n) / (len(p) * len(n))
def ci(R, get, B=2000):
    tr = sorted({r["trace"] for r in R}); rnd = random.Random(1); v = []
    for _ in range(B):
        s = [rnd.choice(tr) for _ in tr]
        p = [get(r) for x in s for r in R if r["trace"] == x and r["L1"]]; n = [get(r) for x in s for r in R if r["trace"] == x and not r["L1"]]
        a = auroc(p, n)
        if a == a: v.append(a)
    v.sort(); return (v[int(.025 * len(v))], v[int(.975 * len(v)) - 1]) if v else (float("nan"),) * 2
L1 = {(t, s["n"]): s["L1"] for t, tr in T.items() for s in tr["steps"]}
print(f"steps {len(L1)}, positives (L1) {sum(L1.values())}, traces {len(T)} (with a positive: {len({t for (t,n),v in L1.items() if v})})")
print("step counts per trace:", dict(collections.Counter(tr['n_steps'] for tr in T.values())))
for cond in ["step", "tests"]:
    R = [r for r in rows if r["cond"] == cond]
    print(f"\n=== state={cond} (n={len(R)}) ===")
    for k in ["pause_point", "M2", "urg", "primary", "substantive", "M1", "M3"]:
        lo, hi = ci(R, lambda r: r["f"][k])
        print(f"  AUROC {k:<12} {auroc([r['f'][k] for r in R if r['L1']], [r['f'][k] for r in R if not r['L1']]):.2f}  [{lo:.2f}, {hi:.2f}]")
    # within-trace: among traces that have a positive and >=2 steps, is the positive step the top pause_point step?
    for k in ["pause_point", "M2", "urg"]:
        hit = tot = 0
        for t, tr in T.items():
            if tr["n_steps"] >= 2 and any(s["L1"] for s in tr["steps"]):
                m = {s["n"]: st.mean(r["f"][k] for r in R if r["trace"] == t and r["n"] == s["n"]) for s in tr["steps"]}
                top = max(m, key=m.get); tot += 1; hit += T[t]["steps"][top - 1]["L1"]
        print(f"  top-1 {k} step == L1 step: {hit}/{tot} traces")
    print("  mean score for L1 vs other steps:  " + "  ".join(f"{k} {st.mean(r['f'][k] for r in R if r['L1']):.2f}/{st.mean(r['f'][k] for r in R if not r['L1']):.2f}" for k in ["pause_point", "M2", "urg"]))
    print("  step-level pause_point (rep-mean), '*' = L1:")
    for t in sorted(T):
        print("   ", f"{t:<7}", "  ".join(f"s{s['n']}{'*' if s['L1'] else ' '} {st.mean(r['f']['pause_point'] for r in R if r['trace']==t and r['n']==s['n']):.2f}" for s in T[t]["steps"]))
print("\n=== baselines (L1 vs other) ===")
S = [(t, s) for t, tr in T.items() for s in tr["steps"]]
for name, fn in [("logic files in step", lambda t, s: len(s["logic_files"])), ("lines added", lambda t, s: s["lines_added"]), ("step number (earlier = higher)", lambda t, s: -s["n"]), ("is first step of a multi-step trace", lambda t, s: float(s["n"] == 1 and T[t]["n_steps"] > 1))]:
    print(f"  {name:<38} AUROC {auroc([fn(t, s) for t, s in S if s['L1']], [fn(t, s) for t, s in S if not s['L1']]):.2f}")
lat = sorted(r["ms"] for r in rows)
print(f"\nlatency ms mean {st.mean(lat):.0f} median {st.median(lat):.0f} p95 {lat[int(.95*len(lat))-1]:.0f}; cost/request ${st.mean(r['body']['usage']['cost'] for r in rows):.5f}; input tokens {st.mean(r['body']['usage']['input_tokens'] for r in rows):.0f}")
by = collections.defaultdict(dict)
for r in rows: by[(r["trace"], r["n"], r["cond"])][r["rep"]] = r
d = [abs(v[0]["f"]["pause_point"] - v[1]["f"]["pause_point"]) for v in by.values() if 0 in v and 1 in v]
print(f"repeat consistency pause_point mean |Δ| {st.mean(d):.3f} max {max(d):.2f}")
