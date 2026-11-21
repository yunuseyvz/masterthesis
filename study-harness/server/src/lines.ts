export interface Region {
  file: string;
  from: number;
  to: number;
}

// a pure deletion marks the line that follows it
export function changedLines(before: string, after: string): number[] {
  const split = (s: string) => (s === "" ? [] : s.replace(/\n$/, "").split("\n")); // a final newline ends the last line
  const a = split(before);
  const b = split(after);
  const n = a.length;
  const m = b.length;
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

// gap 6 matches git's hunks (three lines of context each side touch)
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
