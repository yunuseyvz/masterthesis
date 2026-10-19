import type { Action, ViewState } from "@beacon/shared";

async function call<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${url}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const getState = () => call<ViewState>("/api/study/state", undefined, "GET");
export const act = (a: Action) => call<ViewState>("/api/study/action", a);
export const finish = (_: Record<string, never> = {}) => call<{ ok: boolean }>("/api/study/finish", {});
export const uiEvent = (e: { type: "file_open" | "tab_switch" | "diff_toggle" | "preview_navigate"; path?: string; tab?: string }) =>
  void call("/api/study/event", e).catch(() => {});
