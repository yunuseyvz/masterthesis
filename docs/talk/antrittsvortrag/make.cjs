const pptxgen = require("pptxgenjs");
const { applyTheme } = require("/root/.claude/skills/synced/d8bd29ba-a4e3-4934-b61d-95c5761a984b_0d1edf32-8fad-428e-b57b-b9ca05a78334/pptx/scripts/apply_theme.js");
const A = __dirname + "/assets/";
const OUT = process.argv[2];
const THEME = { name: "Pause", headFontFace: "Google Sans", bodyFontFace: "Google Sans",
  colors: { dk1: "16181D", lt1: "FFFFFF", dk2: "111418", lt2: "F1F2F4", accent1: "6366F1", accent2: "4338CA",
    accent3: "6B7280", accent4: "4ADE80", accent5: "9CA3AF", accent6: "2B313B", hlink: "4338CA", folHlink: "6B7280" } };
const MONO = "JetBrains Mono"; // both fonts are in fonts/ and must be installed on the presenting machine
const LIGHT = "A5B4FC"; // the accent on dark slides

// Surfaces and backgrounds are drawn here as PNGs (pptxgenjs has no gradient fills).
const fs = require("fs"), zlib = require("zlib");
const SURF_DIR = A + "surfaces/";
fs.mkdirSync(SURF_DIR, { recursive: true });
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xFFFFFFFF; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
function writePng(file, w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
}
const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (v) => Math.max(0, Math.min(1, v));
// Each kind: a vertical gradient, a 1-px rim, a light catch along the top edge, an optional darker lip at the bottom (a key cap).
const SURF = {
  dark:    { top: "272D38", bottom: "13171D", rim: "3B4351", hl: 0.16, sheen: 0.035, grain: 7 },
  light:   { top: "FFFFFF", bottom: "F1F2F5", rim: "D8DBE1", hl: 0, grain: 4 },
  key:     { top: "FFFFFF", bottom: "EDEFF2", rim: "CDD1D8", lip: "D3D7DE", grain: 4 },
  keyMs:   { top: "F4F5FF", bottom: "DFE3FE", rim: "A5B4FC", lip: "B8C2FB", grain: 4 },
  keyDark: { top: "2E3541", bottom: "12151A", rim: "4A5261", hl: 0.2, lip: "0A0C0F", grain: 6 },
  accent:  { top: "8E91FA", bottom: "5153E0", rim: "4338CA", hl: 0.5, sheen: 0.12, grain: 6 },
  well:    { top: "0D1014", bottom: "232934", rim: "2E3542", hl: 0, grain: 6 },
  soft:    { top: "F6F7FF", bottom: "E2E5FD", rim: "C3CCFB", hl: 0, grain: 4 },
};
const PPI = 150, made = {};
// film grain: a fixed seed, so a rebuild gives the same files
let seed = 7; const rand = () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const grain = (c, amount) => { const n = (rand() + rand() - 1) * amount; return c.map((v) => Math.max(0, Math.min(255, Math.round(v + n)))); };
function surface(kind, w, h, r, circle) {
  const key = `${kind}-${w.toFixed(3)}-${h.toFixed(3)}-${circle ? "c" : r.toFixed(3)}`;
  if (made[key]) return made[key];
  const S = SURF[kind], W = Math.round(w * PPI), H = Math.round(h * PPI), R = circle ? Math.min(W, H) / 2 : r * PPI;
  const top = rgb(S.top), bot = rgb(S.bottom), rim = rgb(S.rim), lip = S.lip && rgb(S.lip), lipH = 0.035 * PPI;
  const px = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const qx = Math.abs(x + 0.5 - W / 2) - W / 2 + R, qy = Math.abs(y + 0.5 - H / 2) - H / 2 + R;
    const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - R; // < 0 inside
    const cover = clamp(0.5 - d); if (!cover) continue;
    const t = y / H;
    let c = mix(top, bot, t);
    if (S.sheen) c = mix(c, [255, 255, 255], S.sheen * clamp(1 - t * 2.2));
    if (lip && H - y < lipH - d * 0.6) c = mix(c, lip, 0.9);
    if (S.hl) c = mix(c, [255, 255, 255], S.hl * clamp(1 - Math.abs(d + 2.5) / 1.5) * clamp(1 - t * 2.5));
    c = grain(mix(c, rim, clamp(d + 2.5)), S.grain || 0);
    const o = (y * W + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = Math.round(cover * 255);
  }
  const file = SURF_DIR + key + ".png"; writePng(file, W, H, px); return (made[key] = file);
}
// Slide backgrounds: a soft vertical gradient, a glow and a dot grid fading in from the top-right corner.
function background(file, dark) {
  const W = 2000, H = 1125, px = Buffer.alloc(W * H * 4), step = 7.5;
  const top = rgb(dark ? "181C24" : "FCFCFD"), bot = rgb(dark ? "0B0D11" : "EEF0F3"), glow = rgb(dark ? "6366F1" : "FFFFFF"), dot = dark ? [255, 255, 255] : rgb("111418");
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c = mix(top, bot, y / H);
    const gx = dark ? 0.82 : 0.1, gy = dark ? 0.12 : 0.05, g = clamp(1 - Math.hypot(x / W - gx, (y / H - gy) * 0.6) / 0.55);
    c = mix(c, glow, (dark ? 0.16 : 0.7) * g * g);
    const dx = (x % step) - step / 2, dy = (y % step) - step / 2, inDot = clamp(1.2 - Math.hypot(dx, dy));
    const corner = clamp(1 - Math.hypot(1 - x / W, y / H) / (dark ? 1.1 : 0.75));
    c = grain(mix(c, dot, inDot * (dark ? 0.03 + 0.1 * corner * corner : 0.16 * corner * corner)), dark ? 12 : 8);
    const o = (y * W + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
  }
  writePng(file, W, H, px);
  const jpg = file.replace(/\.png$/, ".jpg");
  require("child_process").execFileSync("python3", ["-I", "-c", "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').save(sys.argv[2], quality=90)", file, jpg]);
  fs.unlinkSync(file); return jpg;
}
// A soft round glow, for behind the title button.
function glowPng(file, hex, alpha) {
  const N = 600, px = Buffer.alloc(N * N * 4), c = rgb(hex);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - N / 2, y - N / 2) / (N / 2), a = clamp(1 - d) ** 2.2 * alpha;
    const o = (y * N + x) * 4; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = Math.round(a * 255);
  }
  writePng(file, N, N, px); return file;
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  pres.title = "Knowing Where to Pause"; pres.author = "Yunus Emre Yavuz";
  const C = pres.SchemeColor;

  const BG_DARK = background(SURF_DIR + "bg-dark.png", true), BG_LIGHT = background(SURF_DIR + "bg-light.png", false); // written as .jpg
  pres.defineSlideMaster({ title: "Dark", background: { path: BG_DARK },
    objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.7, y: 0.7, w: 8.5, h: 1.0, fontSize: 40, bold: true, color: C.background1, align: "left", valign: "top", margin: 0 }, text: "" } }],
    slideNumber: { x: 10.2, y: 6.86, w: 0.6, h: 0.28, fontFace: MONO, fontSize: 10, color: C.accent5, align: "right", valign: "middle", margin: 0 } });
  pres.defineSlideMaster({ title: "Title", background: { path: BG_DARK },
    objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.7, y: 2.2, w: 7.8, h: 2.0, fontSize: 54, bold: true, color: C.background1, align: "left", valign: "bottom", margin: 0 }, text: "" } }] });
  pres.defineSlideMaster({ title: "Content", background: { path: BG_LIGHT },
    objects: [{ placeholder: { options: { name: "title", type: "title", x: 0.7, y: 0.7, w: 11.9, h: 0.8, fontSize: 38, bold: true, color: C.text1, align: "left", valign: "top", margin: 0 }, text: "" } }],
    slideNumber: { x: 10.2, y: 6.86, w: 0.6, h: 0.28, fontFace: MONO, fontSize: 10, color: C.accent3, align: "right", valign: "middle", margin: 0 } });
  pres.defineSlideMaster({ title: "Question", background: { path: BG_LIGHT },
    objects: [{ placeholder: { options: { name: "title", type: "title", x: 2.0, y: 0.5, w: 10.3, h: 1.6, fontSize: 28, bold: true, color: C.background1, align: "left", valign: "middle", margin: 0 }, text: "" } }],
    slideNumber: { x: 10.2, y: 6.86, w: 0.6, h: 0.28, fontFace: MONO, fontSize: 10, color: C.accent3, align: "right", valign: "middle", margin: 0 } });

  // Depth: two hidden shapes cast a wide soft shadow and a short sharp one; the generated surface sits on top.
  // name goes on the wide one, so that "!!"-names let PowerPoint's Morph carry it from slide to slide.
  const castShadow = (s, o) => {
    const type = o.circle ? pres.ShapeType.ellipse : o.rect ? pres.ShapeType.rect : pres.ShapeType.roundRect, d = o.depth || 1, k = o.dark ? 2.6 : 1;
    const g = { x: o.x + 0.03, y: o.y + 0.03, w: o.w - 0.06, h: o.h - 0.06, line: { type: "none" }, fill: { color: o.base || "FFFFFF" } };
    if (!o.circle && !o.rect) g.rectRadius = o.r;
    s.addShape(type, Object.assign({}, g, { shadow: { type: "outer", blur: 16 * d, offset: 7 * d, angle: 90, color: "0B0D12", opacity: Math.min(0.13 * k, 0.6) }, objectName: o.name || "shadow-ambient" }));
    s.addShape(type, Object.assign({}, g, { shadow: { type: "outer", blur: 3, offset: 1.6 * d, angle: 90, color: "0B0D12", opacity: Math.min(0.17 * k, 0.6) }, objectName: "shadow-key" }));
  };
  const raised = (s, x, y, w, h, kind, o) => { o = o || {}; const r = o.r === undefined ? 0.12 : o.r;
    castShadow(s, { x, y, w, h, r, circle: o.circle, depth: o.depth, dark: o.dark, name: o.name, base: SURF[kind].bottom });
    s.addImage({ path: surface(kind, w, h, r, o.circle), x, y, w, h, objectName: "surface-" + kind }); };

  // An agent's progress: four steps and a pause chip after step `at` (or after every step). names: "!!"-prefix for Morph.
  const stepBar = (s, x, y, o) => {
    const { seg, h, gap, chip, at, every, dark, done, name } = o;
    for (let k = 1; k <= 4; k++) {
      const filled = k <= (done || 0);
      s.addShape(pres.ShapeType.roundRect, { x, y: y - h / 2, w: seg, h, rectRadius: h / 2, fill: { color: filled ? (dark ? "8B8EF9" : C.accent1) : (dark ? "232934" : "E3E5EA") },
        line: { color: filled ? (dark ? "A5B4FC" : "4F46E5") : (dark ? "333A47" : "D3D6DC"), width: 0.75 },
        shadow: filled ? { type: "outer", blur: dark ? 10 : 6, offset: 0, angle: 90, color: "6366F1", opacity: dark ? 0.55 : 0.35 } : undefined,
        objectName: name ? name + "-seg" + k : "step-seg" });
      x += seg + gap;
      if (every || k === at) {
        s.addShape(pres.ShapeType.roundRect, { x, y: y - chip / 2, w: chip, h: chip, rectRadius: chip * 0.22, fill: { color: "1D222B" }, line: { color: "4A5261", width: 0.75 },
          shadow: { type: "outer", blur: chip > 0.4 ? 14 : 5, offset: chip > 0.4 ? 5 : 2, angle: 90, color: "0B0D12", opacity: dark ? 0.6 : 0.3 }, objectName: name && k === at ? name + "-chip" : "step-chip" });
        pause(s, x + chip / 2 - chip * 0.19, y - chip * 0.27, chip * 0.5, LIGHT, name && k === at ? name + "-glyph" : undefined);
        x += chip + gap;
      }
    }
  };

  // the motif: a pause glyph, two bars
  const pause = (s, x, y, h, color, name) => { const w = h * 0.3;
    [0, 1].forEach((i) => s.addShape(pres.ShapeType.roundRect, { x: x + i * w * 1.75, y, w, h, rectRadius: w * 0.25, fill: { color }, line: { type: "none" },
      shadow: { type: "outer", blur: 3, offset: 1.5, angle: 90, color: "0B0D12", opacity: 0.25 }, objectName: name ? name + (i ? "-b" : "-a") : "pause-bar" })); };
  // The talk's own progress bar, in the motif of the thesis: one segment per slide, and on the last slide it pauses for review.
  const TOTAL = 7;
  const deckBar = (s, n, dark) => {
    for (let k = 2; k <= TOTAL; k++) { const done = k <= n;
      s.addShape(pres.ShapeType.roundRect, { x: 10.85 + (k - 2) * 0.27, y: 6.97, w: 0.21, h: 0.06, rectRadius: 0.03, fill: { color: done ? (dark ? LIGHT : C.accent1) : (dark ? C.accent6 : "D9DCE2") }, line: { type: "none" },
        shadow: done ? { type: "outer", blur: 4, offset: 0, angle: 90, color: dark ? "A5B4FC" : "6366F1", opacity: 0.45 } : undefined, objectName: "!!deck" + k }); }
    if (n >= TOTAL) pause(s, 12.47, 6.89, 0.22, LIGHT, "!!deck-pause");
  };
  // a dark card with a terminal window's title bar
  const term = (s, x, y, w, h, title, name) => {
    raised(s, x, y, w, h, "dark", { depth: 1.4, name });
    s.addShape(pres.ShapeType.line, { x: x + 0.02, y: y + 0.5, w: w - 0.04, h: 0, line: { color: "2A303B", width: 0.75 }, objectName: "window-divider" });
    ["FF5F57", "FEBC2E", "28C840"].forEach((c, i) => s.addShape(pres.ShapeType.ellipse, { x: x + 0.25 + i * 0.2, y: y + 0.2, w: 0.12, h: 0.12, fill: { color: c, transparency: 35 }, line: { color: "0B0D12", width: 0.5, transparency: 50 }, objectName: "window-dot" }));
    if (title) mono(s, title, { x: x + 1.0, y: y + 0.12, w: w - 2.0, h: 0.28, fontSize: 11, color: C.accent5, align: "center", valign: "middle" }); };
  const mono = (s, runs, o) => s.addText(runs, Object.assign({ isTextBox: true, margin: 0, fontFace: MONO, valign: "top" }, o));

  // 1 title
  pres.addSection({ title: "Talk" });
  let s = pres.addSlide({ masterName: "Title", sectionTitle: "Talk" });

  s.addText("Knowing Where\nto Pause", { placeholder: "title" });
  s.addText("Timing a Blocking Intervention\nfor Understanding AI-Generated Code", { x: 0.7, y: 4.45, w: 7.6, h: 0.9, margin: 0, isTextBox: true, fontSize: 22, color: C.accent5, valign: "top" });
  mono(s, "Yunus Emre Yavuz · LMU Munich · 17.11.2026", { x: 0.7, y: 6.05, w: 7, h: 0.3, fontSize: 14, color: C.background1 });
  mono(s, "Antrittsvortrag · Master's thesis", { x: 0.7, y: 6.4, w: 7, h: 0.3, fontSize: 12, color: C.accent5 });
  s.addImage({ path: glowPng(SURF_DIR + "glow.png", "6366F1", 0.5), x: 7.9, y: 1.1, w: 4.6, h: 4.6, objectName: "glow" });
  stepBar(s, 7.5, 3.4, { seg: 0.95, h: 0.2, gap: 0.14, chip: 0.78, at: 2, done: 2, dark: true, name: "!!hero" });
  [["step 1", 7.5, 0.95], ["step 2", 8.59, 0.95], ["review", 9.68, 0.78], ["step 3", 10.6, 0.95], ["step 4", 11.69, 0.95]].forEach(([t, x, w], i) =>
    mono(s, t, { x: x - 0.2, y: 3.95, w: w + 0.4, h: 0.28, fontSize: 11, bold: i === 2, color: i === 2 ? LIGHT : i < 2 ? C.accent5 : C.accent3, align: "center" }));
  s.addNotes("~15 s. Hi, I'm Yunus. My thesis asks one question: when should a coding agent stop and ask a human to look at its work? I'll keep this to about four minutes, because what I really want is your feedback. The small question markers on the slides show where I'm unsure.\n [Click: the progress bar slides down, the pause moves to the end.]");

  const cite = (s, t, x, y, w, dark) => mono(s, t, { x, y, w, h: 0.25, fontSize: 10.5, color: dark ? C.accent5 : C.accent3, objectName: "citation" });
  const frame = (s, x, y, w, h) => { castShadow(s, { x: x - 0.02, y: y - 0.02, w: w + 0.04, h: h + 0.04, rect: true, depth: 1.3 });
    s.addShape(pres.ShapeType.rect, { x: x - 0.02, y: y - 0.02, w: w + 0.04, h: h + 0.04, fill: { color: C.background1 }, line: { color: "D5D7DC", width: 1 }, objectName: "frame" }); };
  const pill = (s, t, x, y, w, color, textColor) => { raised(s, x, y, w, 0.3, "accent", { r: 0.15, depth: 0.5 });
    mono(s, t, { x, y, w, h: 0.3, fontSize: 10.5, bold: true, color: textColor, align: "center", valign: "middle" }); };

  // a marker for an open question that the last slide comes back to
  const ask = (s, n, x, y) => { x = x || 11.6; y = y || 0.84;
    raised(s, x, y, 1.0, 0.36, "soft", { r: 0.18, depth: 0.5 });
    mono(s, "? Q" + n, { x, y, w: 1.0, h: 0.36, fontSize: 12, bold: true, color: C.accent2, align: "center", valign: "middle" }); };

  // 2 problem
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Talk" });
  s.addText("Looks good to me…", { placeholder: "title" });
  s.addText([{ text: "Comprehension debt: ", options: { bold: true, color: C.accent2 } }, { text: "code is merged faster than anyone understands it", options: { color: C.accent3 } }],
    { x: 0.7, y: 1.42, w: 9.5, h: 0.4, margin: 0, isTextBox: true, fontSize: 17, valign: "middle" });
  const cw = 5.75, cy = 2.05, ch = 3.0;
  [[0.7, "review at the end", "Too much to take in", "Passing tests are taken as proof · Dhanorkar et al. 2026"], [6.85, "review at every edit", "Too little to make sense of", "Approval rises, scrutiny falls · Yu et al. 2026"]].forEach(([x, label, cap, ref], i) => {
    term(s, x, cy, cw, ch, label);
    const L = (text, color, last) => ({ text, options: { color, breakLine: !last } });
    mono(s, i === 0
      ? [L("$ agent \"build checkout\"", C.accent5), L("+390 lines", C.accent4), L("PASS  27 tests", C.accent4), L("> looks fine, merge ", C.background1, true), { text: "█", options: { color: C.accent1 } }]
      : [L("edit types.ts?   [y]", C.background1), L("edit types.ts?   [y]", C.accent5), L("run npm test?    [y]", C.accent5), L("edit route.ts?   [y]", C.accent3, true)],
      { x: x + 0.4, y: cy + 0.75, w: cw - 0.8, h: ch - 0.95, fontSize: 20, lineSpacing: 34 });
    const tagPill = (t, fill, color) => { s.addShape(pres.ShapeType.roundRect, { x: x + cw - 1.35, y: cy + 0.11, w: 1.15, h: 0.26, rectRadius: 0.13, fill: { color: fill }, line: { type: "none" }, objectName: "window-tag" });
      mono(s, t, { x: x + cw - 1.35, y: cy + 0.11, w: 1.15, h: 0.26, fontSize: 10, bold: true, color, align: "center", valign: "middle" }); };
    if (i === 0) tagPill("+390  −0", "17351F", C.accent4); else tagPill("47 prompts", C.accent6, C.accent5);
    if (i === 0) { s.addShape(pres.ShapeType.roundRect, { x: x + cw - 0.22, y: cy + 0.6, w: 0.07, h: ch - 0.85, rectRadius: 0.035, fill: { color: C.accent6 }, line: { type: "none" }, objectName: "scroll-track" });
      s.addShape(pres.ShapeType.roundRect, { x: x + cw - 0.22, y: cy + 0.6, w: 0.07, h: 0.3, rectRadius: 0.035, fill: { color: C.accent3 }, line: { type: "none" }, objectName: "scroll-thumb" }); }
    stepBar(s, x, 6.5, i === 0 ? { seg: 0.62, h: 0.11, gap: 0.09, chip: 0.36, at: 4, done: 4, name: "!!hero" } : { seg: 0.4, h: 0.11, gap: 0.08, chip: 0.3, every: true, done: 4 });
    mono(s, i === 0 ? "pause: at the end" : "pause: after every edit", { x: x + (i === 0 ? 3.5 : 3.7), y: 6.38, w: 2.2, h: 0.25, fontSize: 11, color: C.accent3 });
    s.addText(cap, { x, y: 5.3, w: cw, h: 0.5, margin: 0, isTextBox: true, fontSize: 24, bold: true, color: C.text1 });
    cite(s, ref, x, 5.85, cw);
  });
  s.addNotes("~35 s. Coding agents now write whole features, and we merge that code faster than we understand it. Some call this comprehension debt.\n Today, review sits at one of two extremes. Either at the very end: hundreds of lines and green tests. In interviews, developers say they take passing tests as proof. Or at every single edit: fragments without context, and over time, approving becomes a habit.\n Either way: approved, but not understood.");
  deckBar(s, 2, false);

  // 3 the research question and what could come out
  s = pres.addSlide({ masterName: "Question", sectionTitle: "Talk" });
  raised(s, 0.7, 0.5, 11.9, 1.6, "dark", { depth: 1.6, r: 0.16 });
  raised(s, 1.05, 1.09, 0.7, 0.42, "accent", { r: 0.12, depth: 0.6, dark: true });
  mono(s, "RQ", { x: 1.05, y: 1.09, w: 0.7, h: 0.42, fontSize: 14, bold: true, color: C.background1, align: "center", valign: "middle" });
  s.addText("Does where a coding agent pauses for review affect how well developers understand the code it writes?", { placeholder: "title" });
  s.addText("Interventions can help, if they are designed well. Does the moment matter too?", { x: 0.7, y: 2.35, w: 9.4, h: 0.35, margin: 0, isTextBox: true, fontSize: 16, color: C.text1, valign: "middle" });
  cite(s, "Buçinca et al. 2021 · Ghosh et al. 2026", 0.7, 2.72, 9.0);
  { const SEG = 1.6, SLOT = 0.62, G = 0.14, yc = 4.35; let x = (13.333 - (4 * SEG + 4 * SLOT + 8 * G)) / 2;
    for (let k = 1; k <= 4; k++) {
      s.addShape(pres.ShapeType.roundRect, { x, y: yc - 0.09, w: SEG, h: 0.18, rectRadius: 0.09, fill: { color: C.accent1 }, line: { color: "4F46E5", width: 0.75 },
        shadow: { type: "outer", blur: 6, offset: 0, angle: 90, color: "6366F1", opacity: 0.35 }, objectName: "subtask" });
      mono(s, "subtask " + k, { x, y: yc + 0.22, w: SEG, h: 0.26, fontSize: 11, color: C.accent3, align: "center" });
      x += SEG + G;
      s.addShape(pres.ShapeType.roundRect, { x, y: yc - SLOT / 2, w: SLOT, h: SLOT, rectRadius: 0.13, fill: { color: "F4F5FF" }, line: { color: C.accent1, width: 1.25, dashType: "dash" }, objectName: "pause-slot" });
      s.addText("?", { x, y: yc - SLOT / 2, w: SLOT, h: SLOT, margin: 0, isTextBox: true, fontSize: 22, bold: true, color: C.accent1, align: "center", valign: "middle" });
      x += SLOT + G;
    } }
  s.addText("One pause per feature. Where should it go?", { x: 0.7, y: 5.25, w: 11.9, h: 0.5, margin: 0, isTextBox: true, fontSize: 24, bold: true, color: C.text1, align: "center", valign: "middle" });
  s.addNotes("~30 s. One obvious idea is to intervene. And interventions can help: making people think reduces over-reliance on AI, but only if they're designed well; generic prompts can even make it worse. So how matters. My question is when.\n [Read the question.] Does where a coding agent pauses for review affect how well developers understand the code it writes?\n [Point at the bar.] Picture an agent building a feature step by step, and you get one pause. Where should it go?");
  deckBar(s, 3, false);

  // 4 three points to pause
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Talk" });
  s.addText("One pause, three places", { placeholder: "title" });
  s.addText([{ text: "Each feature gets ", options: { color: C.accent3 } }, { text: "one", options: { bold: true, color: C.text1 } }, { text: " blocking pause. Where it falls is the condition.", options: { color: C.accent3 } }],
    { x: 0.7, y: 1.5, w: 11.9, h: 0.4, margin: 0, isTextBox: true, fontSize: 18, valign: "middle" });
  { const SW = 1.75, PW = 0.6, G = 0.14, RH = 0.66, y = 2.75; let x = (13.333 - (4 * SW + 4 * PW + 8 * G)) / 2;
    const names = ["types", "submit", "grading", "route & tests"];
    const slots = { 1: ["OTHER STEP", "after another subtask,", "same amount of code"], 2: ["DECISION", "right after the", "decision point"], 3: null, 4: ["END", "after all four subtasks,", "today's default"] };
    for (let k = 1; k <= 4; k++) {
      const dec = k === 2;
      raised(s, x, y, SW, RH, dec ? "keyMs" : "key", { r: 0.09, depth: 0.55 });
      mono(s, names[k - 1], { x, y, w: SW, h: RH, fontSize: 14, bold: dec, color: dec ? C.accent2 : C.accent3, align: "center", valign: "middle" });
      x += SW + G;
      const sl = slots[k];
      if (sl) { raised(s, x, y, PW, RH, "keyDark", { r: 0.09, depth: 0.8 }); pause(s, x + PW / 2 - 0.115, y + 0.16, 0.34, LIGHT);
        const cx = x + PW / 2, lw = 2.4;
        mono(s, sl[0], { x: cx - lw / 2, y: y + RH + 0.3, w: lw, h: 0.3, fontSize: 14, bold: true, color: k === 2 ? C.accent2 : C.text1, align: "center", valign: "middle" });
        s.addText(sl[1] + "\n" + sl[2], { x: cx - lw / 2, y: y + RH + 0.62, w: lw, h: 0.5, margin: 0, isTextBox: true, fontSize: 12, color: C.accent3, align: "center", valign: "top" }); }
      else s.addShape(pres.ShapeType.roundRect, { x, y, w: PW, h: RH, rectRadius: 0.09, fill: { type: "none" }, line: { color: "C7CBD3", width: 1.25, dashType: "dash" }, objectName: "empty-slot" });
      x += PW + G;
    } }
  raised(s, 0.7, 5.2, 11.9, 0.85, "light", { depth: 0.9 });
  s.addText([{ text: "Six features per person, two per condition, so ", options: {} }, { text: "everyone sees all three. ", options: { bold: true } },
    { text: "OTHER STEP is the control: same amount of code, another place.", options: { color: C.accent3 } }],
    { x: 1.0, y: 5.2, w: 11.4, h: 0.85, margin: 0, isTextBox: true, fontSize: 15, color: C.text1, valign: "middle" });
  cite(s, "Gap: agents lack principled control points for their users · Wang et al. 2026", 0.7, 6.5, 9.0);
  s.addNotes("~45 s. Why subtasks? An agent works in a loop of reasoning and tool calls; there are no natural steps. So in my study the agent builds each feature in four subtasks from its plan, and a pause can only fall at a boundary between two of them.\n That gives three candidates. Batch: one review at the end, say before a commit; that's today's default. Non-milestone: a pause at another subtask boundary, with about the same amount of code. Milestone: a pause after a subtask that meets certain criteria.\n My hypothesis: after a milestone pause, people understand the milestone's decision better than after the other two. Non-milestone is the control: same amount of code, different place. Without it I could only show that pausing helps, not that the place does.");
  deckBar(s, 4, false);

  // 5 semantic milestone, by example
  const code = ["const DEFAULTS = { maxUsers: 5 };", "", "function limitFor(tenant, name) {", "  const own = tenant.limits[name];", "  if (own =|=|= null) return DEFAULTS[name];", "  return own;", "}"];
  // "|" splits a line into runs of slightly different colour, so "===" is not drawn as a ligature
  const codeRuns = (hl) => code.flatMap((t, i) => [{ text: (i + 1) + "  ", options: { color: "5B6370" } },
    ...t.split("|").map((part, k, all) => ({ text: part, options: { color: hl && i !== 4 ? C.accent5 : k % 2 ? "FEFEFE" : C.background1, breakLine: k === all.length - 1 && i < code.length - 1 } }))]);
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Talk" });
  s.addText("The agent decided for you", { placeholder: "title" });
  s.addText("Story: “A tenant can set its own limits, or keep the default.”", { x: 0.7, y: 1.72, w: 7.2, h: 0.35, margin: 0, isTextBox: true, fontSize: 15, italic: true, color: C.accent3 });
  term(s, 0.7, 2.2, 7.2, 2.75, "config.ts");
  s.addShape(pres.ShapeType.rect, { x: 0.7, y: 2.72 + 4 * (22 / 72), w: 7.2, h: 22 / 72, fill: { color: C.accent1, transparency: 60 }, line: { type: "none" }, objectName: "highlight" });
  mono(s, codeRuns(true), { x: 0.95, y: 2.68, w: 6.9, h: 2.2, fontSize: 15, lineSpacing: 22 });
  s.addText("A tenant sets maxUsers to null. Unlimited users, or 5?", { x: 0.7, y: 5.12, w: 7.2, h: 0.35, margin: 0, isTextBox: true, fontSize: 16, bold: true, color: C.accent2 });
  s.addShape(pres.ShapeType.line, { x: 8.675, y: 2.6, w: 0, h: 2.05, line: { color: "C7D2FE", width: 2, dashType: "sysDot" }, objectName: "criteria-spine" });
  [["The story is silent", "Mu et al. 2024 · Yang et al. 2026"], ["More code will build on it", "Kravchuk-Kirilyuk et al. 2025"], ["Nothing is built on it yet", "Iqbal & Bailey 2006 · Tao et al. 2012"]].forEach(([t, ref], i) => {
    const y = 2.25 + i * 1.05;
    raised(s, 8.4, y, 0.55, 0.55, "accent", { circle: true, depth: 0.7 });
    mono(s, String(i + 1), { x: 8.4, y, w: 0.55, h: 0.55, fontSize: 16, bold: true, color: C.background1, align: "center", valign: "middle" });
    s.addText(t, { x: 9.15, y: y - 0.05, w: 3.5, h: 0.4, margin: 0, isTextBox: true, fontSize: 18, color: C.text1, valign: "middle" });
    cite(s, ref, 9.15, y + 0.36, 3.5);
  });
  raised(s, 0.7, 5.8, 11.9, 0.8, "light", { depth: 1.1 });
  pause(s, 1.0, 6.0, 0.4, C.accent1);
  s.addText([{ text: "Semantic milestone: ", options: { bold: true } }, { text: "the step where the agent made a decision the rest builds on" }], { x: 1.6, y: 5.8, w: 10.8, h: 0.8, margin: 0, isTextBox: true, fontSize: 20, color: C.text1, valign: "middle" });
  s.addNotes("~50 s. So what makes a milestone? An example. The story says: a tenant can set its own limits, or keep the default. The agent wrote this code.\n Quick question to you: a tenant sets its user limit to null. Unlimited users, or five? [Wait a few seconds, a show of hands.]\n Five. The agent read null as \"use the default\". Unlimited would have been just as reasonable, and the story doesn't say which. The agent decided, silently, for you.\n That's what I call a semantic milestone. It has three properties: the story is silent; later code will build on the decision; and nothing is built on it yet, so changing course is still cheap. Each comes from prior work, cited on the slide.");
  ask(s, 2);
  deckBar(s, 5, false);

  // 6 study and measures
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Talk" });
  s.addText("A real agent, a hidden script", { placeholder: "title" });
  const badge = (n, x, y) => { raised(s, x - 0.14, y - 0.14, 0.32, 0.32, "accent", { circle: true, depth: 0.5 });
    mono(s, String(n), { x: x - 0.14, y: y - 0.14, w: 0.32, h: 0.32, fontSize: 10, bold: true, color: C.background1, align: "center", valign: "middle" }); };
  frame(s, 0.7, 1.75, 6.4, 4.3);
  s.addImage({ path: surface("light", 6.4, 0.3, 0, false), x: 0.7, y: 1.75, w: 6.4, h: 0.3, objectName: "window-bar" });
  ["FF5F57", "FEBC2E", "28C840"].forEach((c, i) => s.addShape(pres.ShapeType.ellipse, { x: 0.85 + i * 0.18, y: 1.85, w: 0.1, h: 0.1, fill: { color: c, transparency: 25 }, line: { color: "0B0D12", width: 0.5, transparency: 70 }, objectName: "window-dot" }));
  mono(s, "opencode · study build", { x: 1.7, y: 1.75, w: 4.4, h: 0.3, fontSize: 9.5, color: C.accent3, align: "center", valign: "middle" });
  s.addImage({ path: A + "demo.gif", x: 0.7, y: 2.05, w: 6.4, h: 4.0, altText: "Screen recording: the agent implements three steps and pauses for review at the milestone" });
  const RX = 7.5, IW = 3.0, TX = 10.7, TW = 1.93;
  const label = (h, d, y) => { s.addText(h, { x: TX, y, w: TW, h: 0.3, margin: 0, isTextBox: true, fontSize: 14, bold: true, color: C.text1, valign: "middle" });
    s.addText(d, { x: TX, y: y + 0.32, w: TW, h: 0.9, margin: 0, isTextBox: true, fontSize: 12, color: C.accent3, valign: "top" }); };
  frame(s, RX, 1.75, IW, 1.769); s.addImage({ path: A + "probe.png", x: RX, y: 1.75, w: IW, h: 1.769, altText: "Behaviour question shown at the review" });
  label("At the review", "One behaviour question, answered by running the code", 1.75);
  frame(s, RX, 3.75, IW, 1.4375); s.addImage({ path: A + "question.png", x: RX, y: 3.75, w: IW, h: 1.4375, altText: "Understanding question with a confidence rating" });
  label("Understanding", "Five questions with the code hidden", 3.75);
  pill(s, "primary", TX, 4.72, 1.05, C.accent1, C.background1);
  const arrow = (x, y, w, h) => s.addShape(pres.ShapeType.line, { x, y, w, h, line: { color: C.accent1, width: 1.5, endArrowType: "triangle" }, objectName: "flow-arrow" });
  arrow(7.14, 2.63, 0.3, 0); arrow(RX + 1.5, 3.55, 0, 0.17);
  badge(1, 0.58, 1.63); badge(2, RX - 0.12, 1.63); badge(3, RX - 0.12, 3.63);
  s.addText("Fault detection · Calibration · Reversals", { x: RX, y: 5.4, w: 5.1, h: 0.3, margin: 0, isTextBox: true, fontSize: 14, bold: true, color: C.text1, valign: "middle" });
  s.addText("secondary; plus time and mental effort (Paas 1992)", { x: RX, y: 5.7, w: 5.1, h: 0.3, margin: 0, isTextBox: true, fontSize: 12, color: C.accent3, valign: "middle" });
  mono(s, [{ text: "30", options: { bold: true, color: C.text1 } }, { text: " developers  ·  ", options: { color: C.accent3 } },
    { text: "6", options: { bold: true, color: C.text1 } }, { text: " features  ·  ", options: { color: C.accent3 } },
    { text: "all 3", options: { bold: true, color: C.text1 } }, { text: " pause points each  ·  ", options: { color: C.accent3 } },
    { text: "half", options: { bold: true, color: C.text1 } }, { text: " with a planted flaw", options: { color: C.accent3 } }], { x: 0.7, y: 6.4, w: 11.0, h: 0.32, fontSize: 14, valign: "middle" });
  s.addNotes("~50 s. To test this I built a study environment. [Point at the recording.] This is opencode with a real model. It follows a hidden script per feature, so I control where it stops and whether a planted flaw is in the code.\n At the pause, participants accept or reject, then answer one behaviour question by running the code, and may reverse their decision. At the end the code is hidden, and they answer five questions about what it does, each with a confidence rating, graded against the code the agent actually wrote. That's my primary measure.\n Thirty developers, online, six features. Everyone sees all three pause points, and half of the features contain a planted flaw.");
  ask(s, 1, 9.3); ask(s, 3, 10.45); ask(s, 4);
  deckBar(s, 6, false);

  // 7 open questions
  s = pres.addSlide({ masterName: "Dark", sectionTitle: "Talk" });
  s.addText("Some open questions & challenges…", { placeholder: "title", w: 11.9 });
  const Q = (x, y, w, n, q) => { raised(s, x, y, w, 4.1, "dark", { depth: 1.2, dark: true });
    mono(s, "Q" + n, { x: x + 0.3, y: y + 0.27, w: 0.5, h: 0.4, fontSize: 15, bold: true, color: LIGHT, valign: "middle" });
    s.addText(q, { x: x + 0.8, y: y + 0.22, w: w - 1.1, h: 0.95, margin: 0, isTextBox: true, fontSize: 20, bold: true, color: C.background1, valign: "top" }); };
  const note = (t, x, y, w) => s.addText(t, { x, y, w, h: 0.35, margin: 0, isTextBox: true, fontSize: 13, color: C.accent5, valign: "middle" });
  // Q1: the confound, drawn
  { const x = 0.7, y = 1.65;
    Q(x, y, 5.75, 1, "Position or question: what actually helps?");
    const chip = (t, cy, dashed) => { s.addShape(pres.ShapeType.roundRect, { x: x + 0.3, y: cy, w: 2.3, h: 0.48, rectRadius: 0.24, fill: { color: dashed ? "151820" : "1E1B4B" },
        line: { color: "4338CA", width: 1, dashType: dashed ? "dash" : "solid" }, objectName: "cause" });
      s.addText(t, { x: x + 0.3, y: cy, w: 2.3, h: 0.48, margin: 0, isTextBox: true, fontSize: 13, color: "E0E7FF", align: "center", valign: "middle" }); };
    chip("pause at the milestone", y + 1.45, false); chip("a question about it", y + 2.45, true);
    s.addShape(pres.ShapeType.roundRect, { x: x + 3.75, y: y + 1.72, w: 1.7, h: 0.95, rectRadius: 0.12, fill: { color: "EEF2FF" }, line: { type: "none" },
      shadow: { type: "outer", blur: 6, offset: 2, angle: 90, color: "000000", opacity: 0.35 }, objectName: "effect" });
    s.addText("better understanding", { x: x + 3.75, y: y + 1.72, w: 1.7, h: 0.95, margin: 0.08, isTextBox: true, fontSize: 13, bold: true, color: "3730A3", align: "center", valign: "middle" });
    s.addShape(pres.ShapeType.line, { x: x + 2.65, y: y + 1.69, w: 1.05, h: 0.42, line: { color: LIGHT, width: 1.5, endArrowType: "triangle" }, objectName: "cause-arrow" });
    s.addShape(pres.ShapeType.line, { x: x + 2.65, y: y + 2.28, w: 1.05, h: 0.41, flipV: true, line: { color: LIGHT, width: 1.5, dashType: "dash", endArrowType: "triangle" }, objectName: "cause-arrow" });
    note("Every milestone pause brings both. Which one helped?", x + 0.3, y + 3.45, 5.2); }
  // Q2: the criteria, unchecked
  { const x = 6.75, y = 1.65;
    Q(x, y, 5.85, 2, "Does the paused step really meet the criteria?");
    mono(s, ["the story is silent", "more code will build on it", "nothing is built on it yet"].flatMap((t, k) => [{ text: "[?] ", options: { color: LIGHT, bold: true } }, { text: t, options: { color: C.background1, breakLine: k < 2 } }]),
      { x: x + 0.8, y: y + 1.4, w: 4.8, h: 1.4, fontSize: 14, lineSpacing: 30, valign: "top" });
    note("So far: my own reading. Who should check it?", x + 0.8, y + 3.0, 4.8);
    mono(s, [{ text: "→ ", options: { color: LIGHT, bold: true } }, { text: "a second human rater?    ", options: { color: C.background1 } }, { text: "→ ", options: { color: LIGHT, bold: true } }, { text: "an LLM judge?", options: { color: C.background1 } }],
      { x: x + 0.8, y: y + 3.4, w: 4.8, h: 0.35, fontSize: 12, valign: "middle" }); }
  const stages = [["concept & criterion", 1], ["study harness", 1], ["deployment", 0], ["pilot", -1], ["study", -1], ["thesis", -1]];
  s.addShape(pres.ShapeType.line, { x: 0.8, y: 6.42, w: 5 * 1.75, h: 0, line: { color: C.accent6, width: 1.5 }, objectName: "status-line" });
  stages.forEach(([t, st], i) => { const x = 0.7 + i * 1.75;
    s.addShape(pres.ShapeType.ellipse, { x, y: 6.32, w: 0.2, h: 0.2, fill: { color: st === 1 ? C.accent4 : "14181E" }, line: { color: st === 1 ? "86EFAC" : st === 0 ? LIGHT : C.accent3, width: 2 },
      objectName: "status-dot" });
    mono(s, t, { x: x - 0.02, y: 6.62, w: 1.7, h: 0.25, fontSize: 10, bold: st === 0, color: st === 0 ? LIGHT : C.accent5 }); });
  s.addNotes("~45 s, then discussion. Where I am: the criterion, the study environment and the six features are done. Next is a pilot with three to five people.\n Two points I'd really like your input on. Q1: what exactly is my treatment? Every review ends with one question about the subtask that was just finished. So at a milestone pause, people see the milestone and answer a question about it. If milestone pauses win, is that the position, or the question?\n One way out: keep the question as a fixed rule, and add an understanding item for every subtask a pause can follow. Then I can test whether a review helps its own subtask more when that subtask is a milestone. The other way: decouple the question from the position, or drop it.\n Q2: is the paused step really a milestone? So far that's my own reading of the criterion, one per feature, set in advance. A second rater could check it, or an LLM judge on the code the agent actually wrote. Would that convince you?\n Happy to start with Q1.");
  deckBar(s, 7, true);


  // backup slides for the discussion, not presented
  pres.addSection({ title: "Backup" });
  s = pres.addSlide({ masterName: "Content", sectionTitle: "Backup" });
  s.addText("Backup: power at N = 30 and 60", { placeholder: "title" });
  s.addChart(pres.charts.BAR, [{ name: "N = 30", labels: ["no effect", "+9 points", "+18 points", "+26 points"], values: [0, 6, 33, 70] },
    { name: "N = 60", labels: ["no effect", "+9 points", "+18 points", "+26 points"], values: [0, 14, 62, 97] }], {
    x: 0.7, y: 1.8, w: 8.2, h: 4.7, barDir: "col", barGrouping: "clustered", barGapWidthPct: 60, chartColors: ["6366F1", "C7D2FE"],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0\"%\"", dataLabelFontSize: 12, dataLabelColor: "16181D", dataLabelFontFace: "+mn-lt",
    valAxisMaxVal: 100, valAxisMinVal: 0, valAxisMajorUnit: 20, valAxisLabelFormatCode: "0\"%\"", valAxisLabelColor: "6B7280", valAxisLabelFontSize: 11, valAxisLabelFontFace: "+mn-lt",
    catAxisLabelColor: "16181D", catAxisLabelFontSize: 12, catAxisLabelFontFace: "+mn-lt", valGridLine: { color: "E2E4E9", size: 0.5 }, catGridLine: { style: "none" },
    showLegend: true, legendPos: "t", legendFontSize: 12, legendFontFace: "+mn-lt", legendColor: "16181D", objectName: "power-chart" });
  s.addText("Share of 250 simulated studies in which both H1 contrasts are significant (Holm), by the true effect on milestone items.", { x: 9.3, y: 2.0, w: 3.3, h: 1.4, margin: 0, isTextBox: true, fontSize: 14, color: C.text1, valign: "top" });
  s.addText("80\u00a0% power needs about +26 points at N\u00a0=\u00a030. Simulated with the earlier four-item design; to be re-run with the pilot's variances.", { x: 9.3, y: 3.6, w: 3.3, h: 1.6, margin: 0, isTextBox: true, fontSize: 13, color: C.accent3, valign: "top" });
  cite(s, "docs/study/scenario.md §3", 9.3, 5.4, 3.3);
  s.addNotes("Backup for Q3.");

  s = pres.addSlide({ masterName: "Content", sectionTitle: "Backup" });
  s.addText("Backup: the six features", { placeholder: "title" });
  const hd = (t) => ({ text: t, options: { bold: true, color: "6B7280", fontFace: MONO, fontSize: 11, fill: { color: "F1F2F4" } } });
  s.addTable([[hd("Feature"), hd("Milestone"), hd("Open case it settles"), hd("Flaw in")],
    ["Flash-sale reservation", "2 · stock reservation", "an order for more than is left", "2"],
    ["Payment webhook", "3 · deduplication and retry", "a redelivery of an event that was given up", "2"],
    ["Tenant configuration", "2 · defaults merged with overrides", "a limit set to null", "3"],
    ["SLA credits", "1 · duration parsing", "a duration without a unit", "3"],
    ["Rate limiter", "3 · sliding-window check", "a request exactly one window after the oldest", "3"],
    ["Coupons", "1 · discount calculation", "a discount of a fraction of a cent", "1"]],
    { x: 0.7, y: 1.85, w: 11.9, colW: [2.9, 3.3, 4.6, 1.1], fontSize: 14, color: "16181D", border: { type: "solid", color: "E2E4E9", pt: 0.75 }, rowH: 0.52, valign: "middle", margin: [0.04, 0.12, 0.04, 0.12], objectName: "features-table" });
  cite(s, "Milestones at steps 1, 2 and 3 twice each, so position is no cue. Half of the flaws sit in the milestone step.", 0.7, 5.75, 11.9);
  s.addNotes("Backup for Q2.");

  // references (backup, not presented)
  pres.addSection({ title: "References" });
  s = pres.addSlide({ masterName: "Content", sectionTitle: "References" });
  s.addText("References", { placeholder: "title" });
  const refs = [
    ["Ahmad (2026).", "Comprehension Debt in GenAI-Assisted Software Engineering Projects.", "arXiv:2604.13277"],
    ["Buçinca, Malaya & Gajos (2021).", "To Trust or to Think: Cognitive Forcing Functions Can Reduce Overreliance on AI in AI-assisted Decision-making.", "Proc. ACM HCI (CSCW). doi:10.1145/3449287"],
    ["Dhanorkar, Passi & Vorvoreanu (2026).", "Human oversight of agentic systems in practice: Examining the oversight work, challenges, and heuristics of developers using software agents.", "FAccT ’26. doi:10.1145/3805689.3812402"],
    ["Ghosh, Sarkar, Lindley & Poelitz (2026).", "An Experimental Comparison of Cognitive Forcing Functions for Execution Plans in AI-Assisted Writing.", "arXiv:2601.18033"],
    ["Iqbal & Bailey (2006).", "Leveraging characteristics of task structure to predict the cost of interruption.", "CHI ’06. doi:10.1145/1124772.1124882"],
    ["Kravchuk-Kirilyuk, Graciolli & Amin (2025).", "The Modular Imperative: Rethinking LLMs for Maintainable Software.", "LMPL ’25. doi:10.1145/3759425.3763392"],
    ["Mu et al. (2024).", "ClarifyGPT: A Framework for Enhancing LLM-Based Code Generation via Requirements Clarification.", "Proc. ACM Softw. Eng. (FSE). doi:10.1145/3660810"],
    ["Paas (1992).", "Training strategies for attaining transfer of problem-solving skill in statistics: A cognitive-load approach.", "J. Educ. Psychol. doi:10.1037/0022-0663.84.4.429"],
    ["Tao et al. (2012).", "How do software engineers understand code changes?", "FSE ’12. doi:10.1145/2393596.2393656"],
    ["Wang et al. (2026).", "Humans are Missing from AI Coding Agent Research.", "arXiv:2608.12355"],
    ["Yang et al. (2026).", "Clarity Is Not Assumed: Understanding LLM-Based Code Generation under Ambiguous Requirements.", "ASE ’26. doi:10.1145/3832783.3834403"],
    ["Yu et al. (2026).", "Habituation at the Gate: Rising Approval and Declining Scrutiny in Human Review of AI Agent Code.", "arXiv:2606.22721"],
  ];
  [refs.slice(0, 6), refs.slice(6)].forEach((col, c) => {
    s.addText(col.flatMap(([who, title, where], i) => [{ text: who + " ", options: { bold: true } }, { text: title + " " }, { text: where, options: { color: C.accent3, breakLine: i < col.length - 1 } }]),
      { x: 0.7 + c * 6.15, y: 1.85, w: 5.75, h: 4.7, margin: 0, isTextBox: true, fontSize: 11, color: C.text1, valign: "top", paraSpaceAfter: 8 });
  });
  s.addNotes("Backup slide, not presented.");

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  // Morph into slides 2-6, for the step bar (title -> 2) and the progress bar only (PowerPoint 2019/365); older versions fall back to a fade. pptxgenjs cannot write transitions.
  const JSZip = require("jszip"), zip = await JSZip.loadAsync(fs.readFileSync(OUT), { createFolders: false });
  const MORPH = '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159"><p:transition xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" spd="med" p14:dur="500"><p159:morph option="byObject"/></p:transition></mc:Choice><mc:Fallback><p:transition spd="slow"><p:fade/></p:transition></mc:Fallback></mc:AlternateContent>';
  for (let n = 2; n <= TOTAL; n++) {
    const f = `ppt/slides/slide${n}.xml`; let xml = await zip.file(f).async("string");
    xml = xml.includes("<p:timing") ? xml.replace("<p:timing", MORPH + "<p:timing") : xml.replace("</p:sld>", MORPH + "</p:sld>");
    zip.file(f, xml);
  }
  Object.keys(zip.files).filter((k) => zip.files[k].dir).forEach((k) => delete zip.files[k]);
  fs.writeFileSync(OUT, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
})();
