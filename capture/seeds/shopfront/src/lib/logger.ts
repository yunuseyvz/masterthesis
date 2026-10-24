export type Level = "info" | "warn" | "error";

export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export function createLogger(sink: (line: string) => void = console.log): Logger {
  const write = (level: Level) => (message: string, fields: Record<string, unknown> = {}) =>
    sink(JSON.stringify({ level, message, ...fields }));
  return { info: write("info"), warn: write("warn"), error: write("error") };
}
