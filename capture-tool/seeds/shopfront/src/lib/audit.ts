import type { Clock } from "./clock.ts";

export interface AuditEntry {
  at: number;
  actor: string;
  action: string;
  target: string;
}

export interface AuditLog {
  entries: AuditEntry[];
  record(actor: string, action: string, target: string): AuditEntry;
  forTarget(target: string): AuditEntry[];
}

export function createAuditLog(clock: Clock): AuditLog {
  const entries: AuditEntry[] = [];
  return {
    entries,
    record(actor, action, target) {
      const entry = { at: clock.now(), actor, action, target };
      entries.push(entry);
      return entry;
    },
    forTarget: (target) => entries.filter((e) => e.target === target),
  };
}
