// Bundle Monaco locally: the study must not depend on any CDN.
import "monaco-editor/esm/vs/editor/editor.all.js";
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution.js";
import "monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution.js";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { loader } from "@monaco-editor/react";

(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = { getWorker: () => new editorWorker() };
loader.config({ monaco });
monaco.editor.defineTheme("beacon", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "keyword", foreground: "d9886c" },
    { token: "string", foreground: "9bc69a" },
    { token: "comment", foreground: "6f6d66" },
    { token: "number", foreground: "d6b57a" },
    { token: "type", foreground: "7fb0d8" },
    { token: "identifier", foreground: "e6e4de" },
  ],
  colors: {
    "editor.background": "#1c1c1b",
    "editorGutter.background": "#1c1c1b",
    "editorLineNumber.foreground": "#5f5d57",
    "editorLineNumber.activeForeground": "#8f8c84",
    "editor.lineHighlightBackground": "#00000000",
    "editor.selectionBackground": "#3a3a37",
    "scrollbarSlider.background": "#ffffff14",
  },
});
