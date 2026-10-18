import { diffLines } from "diff";

export interface DiffLine {
  type: "ctx" | "add" | "del";
  text: string;
  oldNo?: number;
  newNo?: number;
}

export function computeDiff(before: string, after: string): DiffLine[] {
  const out: DiffLine[] = [];
  let o = 1;
  let n = 1;
  for (const part of diffLines(before, after)) {
    const lines = part.value.split("\n");
    if (lines[lines.length - 1] === "") lines.pop();
    for (const text of lines) {
      if (part.added) out.push({ type: "add", text, newNo: n++ });
      else if (part.removed) out.push({ type: "del", text, oldNo: o++ });
      else out.push({ type: "ctx", text, oldNo: o++, newNo: n++ });
    }
  }
  return out;
}

export function diffStat(before: string, after: string) {
  const d = computeDiff(before, after);
  return { added: d.filter((l) => l.type === "add").length, removed: d.filter((l) => l.type === "del").length };
}
