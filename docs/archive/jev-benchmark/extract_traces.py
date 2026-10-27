"""Turn agent-written git repos (one commit = one agent step) into step records for the Jev trace evaluation.

usage: python3 -I extract_traces.py <traces_dir> <out.json>

Each repo in <traces_dir> (named like US1_a) has an 'Initial repository' commit followed by the agent's commits.
Per step we record: the commit message (the agent's own summary), the files it changed (content at that commit),
the test files visible in the tree at that commit, and rater-independent features:
  logic_in_step : a changed non-test source file contains conditionals, arithmetic or state changes (regex)
  built_on      : a changed non-test source file with logic is imported by a non-test file changed in a LATER commit
  L1            : logic_in_step and built_on  (mechanical 'foundational unit' label, no judgement involved)
"""
import json, os, posixpath, re, subprocess, sys

traces_dir, out = sys.argv[1], sys.argv[2]
LOGIC = re.compile(r"\b(if|for|while|throw|switch|catch)\b|[-+*/]=|\?\?|\|\||&&|\?[^.?]|\.(set|push|delete|add|splice|shift)\(|\+\+|--")
IMPORT = re.compile(r"""(?:from|import)\s*\(?\s*["'](\.{1,2}/[^"']+)["']""")
SKIP = ("package-lock.json",)

def git(repo, *a):
    return subprocess.run(["git", *a], cwd=repo, capture_output=True, text=True, check=True).stdout

def is_test(p): return p.startswith("test/") or ".test." in p

def resolve(frm, spec):
    return posixpath.normpath(posixpath.join(posixpath.dirname(frm), spec))

result = []
for name in sorted(d for d in os.listdir(traces_dir) if os.path.isdir(os.path.join(traces_dir, d))):
    repo = os.path.join(traces_dir, name)
    meta = json.load(open(os.path.join(traces_dir, name + ".meta.json")))
    commits = [l.split("\x1f") for l in git(repo, "log", "--reverse", "--all", "--format=%H%x1f%s").strip().splitlines()][1:]
    steps = []
    for i, (h, msg) in enumerate(commits, 1):
        ns = git(repo, "diff-tree", "--no-commit-id", "--name-status", "-r", h).strip().splitlines()
        changed = [l.split("\t")[1] for l in ns if l[0] in "AM" and l.split("\t")[1] not in SKIP]
        files = [{"path": p, "content": git(repo, "show", f"{h}:{p}").rstrip()} for p in changed]
        tree = git(repo, "ls-tree", "-r", "--name-only", h).split()
        vis = [{"path": p, "content": git(repo, "show", f"{h}:{p}").rstrip()} for p in tree if is_test(p) and p not in changed]
        added = sum(int(x.split("\t")[0]) for x in git(repo, "show", "--numstat", "--format=", h).strip().splitlines() if x.split("\t")[0].isdigit())
        src = [f for f in files if not is_test(f["path"]) and f["path"].endswith(".ts")]
        steps.append({"n": i, "hash": h[:8], "summary": msg, "files": files, "visible_tests": vis, "lines_added": added,
                      "only_tests": bool(files) and all(is_test(f["path"]) for f in files),
                      "logic_files": [f["path"] for f in src if LOGIC.search(f["content"])],
                      "imports_by_later": []})
    # built_on: later non-test files import this step's logic files
    for i, s in enumerate(steps):
        later = [f for t in steps[i + 1:] for f in t["files"] if not is_test(f["path"]) and f["path"].endswith(".ts")]
        for lf in s["logic_files"]:
            for g in later:
                if g["path"] != lf and any(resolve(g["path"], m) == lf for m in IMPORT.findall(g["content"])):
                    s["imports_by_later"].append(lf); break
        s["logic_in_step"] = bool(s["logic_files"])
        s["built_on"] = bool(s["imports_by_later"])
        s["L1"] = s["logic_in_step"] and s["built_on"]
    result.append({"trace": name, "story": meta["id"], "run": name.split("_")[1], "brief": meta["brief"], "n_steps": len(steps), "steps": steps,
                   "final_tree": git(repo, "ls-tree", "-r", "--name-only", "HEAD").split()})
json.dump(result, open(out, "w"), indent=1)
for t in result:
    print(t["trace"], "steps", t["n_steps"], "| per-step:", " ".join(("L" if s["L1"] else ".") + ("T" if s["only_tests"] else "-") for s in t["steps"]))
