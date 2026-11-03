#!/usr/bin/env python3
"""Builds the blind rater sheet for the criteria (C1 to C3) from the corpus.

usage: python3 -I scripts/make-rater-sheet.py

Writes docs/rater-sheet-corpus.csv (shuffled, no hint at the intended milestone) and
docs/rater-sheet-corpus.key.csv (item -> story, subtask; for the analysis only, never share it with a rater).
One row per subtask of the Correct variant of US1 to US6. The decision-test columns are left empty.
"""
import csv, json, os, random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CORPUS = os.path.join(ROOT, "server", "corpus")
STORIES = ["US1", "US2", "US3", "US4", "US5", "US6"]

def lines(story_dir, source):
    src = source["Correct"] if isinstance(source, dict) else source
    with open(os.path.join(story_dir, src)) as f:
        return len(f.read().splitlines())

rows = []
for sid in STORIES:
    d = os.path.join(CORPUS, sid)
    with open(os.path.join(d, "story.json")) as f:
        story = json.load(f)
    steps = story["steps"]
    for st in steps:
        later = [f["path"] for s in steps if s["n"] > st["n"] for f in s["files"] if not f["path"].startswith("test/")]
        rows.append({
            "story": sid,
            "subtask": st["n"],
            "user_story": story["brief"],
            "subtask_summary": st["summary"],
            "files_in_subtask": "; ".join(f["path"] for f in st["files"]),
            "lines_in_subtask": sum(lines(d, f["source"]) for f in st["files"]),
            "non_test_files_still_to_be_written": "; ".join(later),
        })

random.Random(20261019).shuffle(rows)
cols = ["item", "story", "subtask", "user_story", "subtask_summary", "files_in_subtask", "lines_in_subtask",
        "non_test_files_still_to_be_written", "C1_a_special_input", "C1_b_story_silent", "C1_c_plural_outcomes",
        "C2_a_owns_state_or_rule", "C2_b_two_files_still_call_it", "C2_c_no_downstream_code_yet",
        "C3_a_three_input_kinds", "C3_b_tests_cover_fewer", "non_trigger", "pause_here_yes_no", "notes"]
visible = [c for c in cols if c not in ("story", "subtask")]
with open(os.path.join(ROOT, "docs", "rater-sheet-corpus.csv"), "w", newline="") as f:
    w = csv.DictWriter(f, fieldnames=visible, restval="")
    w.writeheader()
    for i, r in enumerate(rows, 1):
        w.writerow({"item": f"R{i:02d}", **{k: v for k, v in r.items() if k in visible}})
with open(os.path.join(ROOT, "docs", "rater-sheet-corpus.key.csv"), "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["rater_id", "story", "subtask"])
    for i, r in enumerate(rows, 1):
        w.writerow([f"R{i:02d}", r["story"], r["subtask"]])
print(f"wrote {len(rows)} rows")
