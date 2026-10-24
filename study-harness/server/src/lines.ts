/** A range of lines in one file, 1-based and inclusive, in the file's current (new) version. */
export interface Region {
  file: string;
  from: number;
  to: number;
}

/**
 * Line numbers (1-based) in `after` that are new or changed relative to `before`, by longest common subsequence.
 * A pure deletion has no line of its own in `after`, so it marks the line that follows it.
 */
export function changedLines(before: string, after: string): number[] {
  const split = (s: string) => (s === "" ? [] : s.replace(/\n$/, "").split("\n")); // a final newline ends the last line
  const a = split(before);
  const b = split(after);
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..]
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
  }
  const out = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      i++;
      j++;
    } else if (i < n && (j >= m || lcs[i + 1]![j]! >= lcs[i]![j + 1]!)) {
      // Deletions first, like git, so a replaced line is marked where its replacement starts.
      if (m > 0) out.add(Math.min(j + 1, m));
      i++;
    } else {
      out.add(++j);
    }
  }
  return [...out].sort((x, y) => x - y);
}

/**
 * Groups sorted line numbers into ranges. Runs at most `gap` unchanged lines apart are merged; with gap 6 this matches
 * git's hunks, whose three lines of context on each side then touch.
 */
export function toRanges(lines: number[], gap = 0): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  for (const l of lines) {
    const last = out[out.length - 1];
    if (last && l - last.to - 1 <= gap) last.to = Math.max(last.to, l);
    else out.push({ from: l, to: l });
  }
  return out;
}

export const overlaps = (r: Region, v: Region) => r.file === v.file && r.from <= v.to && v.from <= r.to;
