import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({
  width: 16, height: 16, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor",
  strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, ...p,
});

export const Chevron = ({ open, ...p }: SVGProps<SVGSVGElement> & { open?: boolean }) => (
  <svg {...base(p)} style={{ transform: open ? "rotate(90deg)" : undefined, transition: "transform .12s", flex: "none" }}><path d="M6 3.5 10.5 8 6 12.5" /></svg>
);
export const Folder = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M1.8 4.6c0-.8.6-1.4 1.4-1.4h2.6l1.5 1.6h5.5c.8 0 1.4.6 1.4 1.4v5.6c0 .8-.6 1.4-1.4 1.4H3.2c-.8 0-1.4-.6-1.4-1.4V4.6Z" /></svg>
);
export const FileTs = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2.4" stroke="#5b9bd5" /><path d="M5 7.2h3M6.5 7.2v4M9.6 11c.4.3.8.4 1.2.4.7 0 1-.3 1-.7 0-1-2.2-.6-2.2-1.6 0-.4.4-.8 1.1-.8.4 0 .8.1 1 .3" stroke="#5b9bd5" strokeWidth="1.1" /></svg>
);
export const FileGeneric = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 2.2h5l3 3v8.6H4V2.2Z" /><path d="M9 2.2v3h3" /></svg>
);
export const Check = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="m3.5 8.4 3 3 6-6.6" /></svg>;
export const Plus = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M8 3v10M3 8h10" /></svg>;
export const ArrowUp = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M8 13V3.5M3.8 7.4 8 3.2l4.2 4.2" /></svg>;
export const Pencil = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="m10.6 2.8 2.6 2.6L5.6 13H3v-2.6l7.6-7.6Z" /></svg>;
export const TerminalIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><rect x="2" y="2.8" width="12" height="10.4" rx="2" /><path d="m5 6.6 2 1.6-2 1.6M8.6 10h2.6" /></svg>;
export const FilesIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M4.4 2.4h4.6l2.6 2.6v6.6H4.4V2.4Z" /><path d="M6.2 13.6h6.2V6.4" /></svg>;
export const DiffIcon = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M5 2.6v6.8M1.8 6h6.4M9 11.4h6M11 3.4h4" transform="translate(-.5 1)" /></svg>;
export const Sparkle = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)} fill="currentColor" stroke="none"><path d="M8 1.5 9.4 6 14 8l-4.6 2L8 14.5 6.6 10 2 8l4.6-2L8 1.5Z" /></svg>;

export const fileIcon = (name: string) => (/\.tsx?$/.test(name) ? <FileTs /> : <FileGeneric />);
