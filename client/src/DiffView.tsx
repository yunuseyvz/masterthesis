import { Editor, type OnMount } from "@monaco-editor/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { computeDiff } from "./diff";

type MonacoEditor = Parameters<OnMount>[0];
type MonacoApi = Parameters<OnMount>[1];
const LINE = 19;
export const CODE_FONT = "'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";

/** A unified diff rendered in one read-only Monaco editor (syntax highlighting, no phantom lines, no inner scroll). */
export function DiffView({ before, after }: { before: string; after: string }) {
  const lines = useMemo(() => computeDiff(before, after), [before, after]);
  const text = lines.map((l) => l.text).join("\n");
  const linesRef = useRef(lines);
  linesRef.current = lines;
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const decos = useRef<ReturnType<MonacoEditor["createDecorationsCollection"]> | null>(null);
  const [mounted, setMounted] = useState(false);

  // Content can grow while the agent is "writing"; keep the +/- decorations in step with it.
  useEffect(() => {
    const ed = editorRef.current;
    const monaco = monacoRef.current;
    if (!ed || !monaco) return;
    decos.current?.clear();
    decos.current = ed.createDecorationsCollection(
      lines.flatMap((l, i) =>
        l.type === "ctx" ? [] : [{
          range: new monaco.Range(i + 1, 1, i + 1, 1),
          options: { isWholeLine: true, className: l.type === "add" ? "dl-add" : "dl-del", linesDecorationsClassName: l.type === "add" ? "dl-add-bar" : "dl-del-bar" },
        }],
      ),
    );
  }, [lines, text, mounted]);

  return (
    <Editor
      height={lines.length * LINE + 16}
      theme="beacon"
      language="typescript"
      value={text}
      options={{
        readOnly: true, domReadOnly: true, contextmenu: false, minimap: { enabled: false },
        fontFamily: CODE_FONT, fontSize: 12.5, lineHeight: LINE, padding: { top: 8, bottom: 8 },
        scrollBeyondLastLine: false, overviewRulerLanes: 0, renderLineHighlight: "none", folding: false,
        glyphMargin: false, lineDecorationsWidth: 14, lineNumbersMinChars: 3, renderWhitespace: "none",
        scrollbar: { vertical: "hidden", horizontal: "auto", alwaysConsumeMouseWheel: false, handleMouseWheel: false },
        guides: { indentation: false }, occurrencesHighlight: "off", selectionHighlight: false, matchBrackets: "never",
        lineNumbers: (n) => { const l = linesRef.current[n - 1]; return l && l.type !== "del" ? String(l.newNo) : ""; },
      }}
      onMount={(editor, monaco) => {
        editorRef.current = editor;
        monacoRef.current = monaco;
        decos.current = null;
        setMounted(true);
      }}
    />
  );
}

const languageFor = (path: string) => (path.endsWith(".md") ? "markdown" : /\.tsx?$/.test(path) ? "typescript" : "plaintext");

export function FileViewer({ path, content }: { path: string; content: string }) {
  return (
    <Editor
      height="100%"
      theme="beacon"
      language={languageFor(path)}
      value={content}
      options={{
        readOnly: true, domReadOnly: true, contextmenu: false, minimap: { enabled: false },
        fontFamily: CODE_FONT, fontSize: 12.5, lineHeight: LINE, padding: { top: 8, bottom: 8 },
        scrollBeyondLastLine: false, overviewRulerLanes: 0, renderLineHighlight: "none", folding: false,
        glyphMargin: false, lineDecorationsWidth: 14, lineNumbersMinChars: 3, automaticLayout: true,
        wordWrap: languageFor(path) === "markdown" ? "on" : "off",
        guides: { indentation: false }, occurrencesHighlight: "off", selectionHighlight: false,
      }}
    />
  );
}
