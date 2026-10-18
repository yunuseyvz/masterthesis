import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import { CODE_FONT } from "./DiffView";

/** xterm.js bound to the server's sandboxed pty. The shell starts the first time the tab is shown. */
export function TerminalView({ visible }: { visible: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<{ start: () => void; fit: () => void } | null>(null);

  useEffect(() => {
    const el = host.current!;
    const term = new Terminal({
      fontFamily: CODE_FONT, fontSize: 12.5, lineHeight: 1.25, cursorBlink: true, scrollback: 3000,
      theme: { background: "#000000", foreground: "#e6e4de", cursor: "#d97757", selectionBackground: "#3d3d3a", black: "#000000", brightBlack: "#6f6d66" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);

    let ws: WebSocket | null = null;
    let disposed = false;
    let closed = false;
    let started = false;

    const safeFit = () => { if (el.clientWidth > 0 && el.clientHeight > 0) try { fit.fit(); } catch { /* not laid out yet */ } };
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/api/study/terminal?cols=${term.cols}&rows=${term.rows}`);
      ws.onopen = () => { closed = false; };
      ws.onmessage = (e) => term.write(typeof e.data === "string" ? e.data : "");
      ws.onclose = () => {
        if (disposed) return;
        closed = true;
        term.write("\r\n\x1b[2m[shell closed — press Enter to start a new one]\x1b[0m\r\n");
      };
    };

    term.onData((d) => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "i", d }));
      else if (closed && d === "\r") { term.reset(); closed = false; connect(); }
    });
    term.onResize(({ cols, rows }) => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: "r", cols, rows })); });
    const ro = new ResizeObserver(safeFit);
    ro.observe(el);

    api.current = { fit: safeFit, start: () => { if (started) return; started = true; safeFit(); connect(); } };
    return () => { disposed = true; ro.disconnect(); ws?.close(); term.dispose(); api.current = null; };
  }, []);

  useEffect(() => {
    if (!visible) return;
    api.current?.fit();
    api.current?.start();
  }, [visible]);

  return <div ref={host} className="xterm-host" style={{ display: visible ? "block" : "none" }} />;
}
