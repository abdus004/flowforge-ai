/**
 * Client-side PDF export for FlowForge blueprints.
 *
 * The PDF is generated entirely in the browser with a small, dependency-free
 * writer that emits standard PDF 1.4 using the built-in Helvetica fonts.
 *
 * Design notes (why this file looks the way it does):
 *  - It must run in the BROWSER. It therefore uses no Node-only globals
 *    (e.g. `Buffer`) - using one previously made every export fail.
 *  - Layout uses the real Helvetica glyph widths (AFM metrics) instead of an
 *    estimate, so wrapped text never overflows the page margin.
 *  - Long unbroken tokens (URLs, file paths) are hard-broken to fit.
 *  - Content is paginated line by line; table headers repeat on every page.
 *  - The file is assembled as a byte-exact "binary string" so the xref table
 *    offsets and stream /Length values are correct by construction.
 *  - Text is encoded as WinAnsi (Windows-1252). Western European accents,
 *    curly quotes, dashes, bullets, euro etc. render correctly. Characters
 *    outside that set (CJK, emoji, ...) cannot be drawn by the built-in
 *    fonts and are replaced with "?" rather than silently disappearing.
 */
import type { Blueprint } from "./api";

// ---------------------------------------------------------------------------
// Font metrics (Helvetica / Helvetica-Bold, WinAnsi codes 32..255, per 1000 em)
// ---------------------------------------------------------------------------

const HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584, 761,
  556, 0, 222, 556, 333, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  0, 222, 222, 333, 333, 350, 556, 1000, 333, 1000, 500, 333, 944, 0, 500, 667,
  278, 333, 556, 556, 556, 556, 260, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 556, 537, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  667, 667, 667, 667, 667, 667, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 500, 556, 556, 556, 556, 278, 278, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 584, 611, 556, 556, 556, 556, 500, 556, 500,
];

const HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584, 761,
  556, 0, 278, 556, 500, 1000, 556, 556, 333, 1000, 667, 333, 1000, 0, 611, 0,
  0, 278, 278, 500, 500, 350, 556, 1000, 333, 1000, 556, 333, 944, 0, 500, 667,
  278, 333, 556, 556, 556, 556, 280, 556, 333, 737, 370, 556, 584, 333, 737, 333,
  400, 584, 333, 333, 333, 611, 556, 278, 333, 333, 365, 556, 834, 834, 834, 611,
  722, 722, 722, 722, 722, 722, 1000, 722, 667, 667, 667, 667, 278, 278, 278, 278,
  722, 722, 778, 778, 778, 778, 778, 584, 778, 722, 722, 722, 722, 667, 667, 611,
  556, 556, 556, 556, 556, 556, 889, 556, 556, 556, 556, 556, 278, 278, 278, 278,
  611, 611, 611, 611, 611, 611, 611, 584, 611, 611, 611, 611, 611, 556, 611, 556,
];

type FontKey = "F1" | "F2"; // F1 = Helvetica, F2 = Helvetica-Bold
const WIDTHS: Record<FontKey, number[]> = { F1: HELVETICA, F2: HELVETICA_BOLD };
const QUESTION_MARK = 0x3f;

function glyphWidth(font: FontKey, code: number): number {
  const w = WIDTHS[font][code - 32];
  return w && w > 0 ? w : WIDTHS[font][QUESTION_MARK - 32];
}

function textWidth(s: string, font: FontKey, size: number): number {
  let total = 0;
  for (let i = 0; i < s.length; i++) total += glyphWidth(font, s.charCodeAt(i));
  return (total / 1000) * size;
}

// ---------------------------------------------------------------------------
// Text sanitising: Unicode -> WinAnsi "byte string"
// ---------------------------------------------------------------------------

// Characters in the 0x80-0x9F block of Windows-1252 (not the same as Unicode).
const CP1252_EXTRA: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86,
  0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c,
  0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95,
  0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b,
  0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

// Common symbols with no WinAnsi glyph, mapped to readable ASCII.
const REPLACEMENTS: Record<string, string> = {
  "\u2192": "->", "\u2190": "<-", "\u2194": "<->", "\u21d2": "=>", "\u2265": ">=",
  "\u2264": "<=", "\u2260": "!=", "\u2248": "~", "\u2010": "-", "\u2011": "-",
  "\u2012": "-", "\u2212": "-", "\u2043": "-", "\u2023": ">", "\u25cf": "\u2022",
  "\u25aa": "\u2022", "\u25e6": "\u2022", "\u2713": "v", "\u2714": "v", "\u2717": "x",
  "\u2718": "x",
};

function isInvisible(cp: number): boolean {
  return (
    cp === 0xad || cp === 0x7f || cp === 0xfeff || cp === 0x2060 ||
    (cp >= 0x200b && cp <= 0x200f) || (cp >= 0xfe00 && cp <= 0xfe0f) ||
    (cp >= 0x202a && cp <= 0x202e)
  );
}

function pushCodes(ch: string, out: number[], depth = 0): void {
  const cp = ch.codePointAt(0) as number;
  if (isInvisible(cp)) return;
  if (cp < 0x20 || cp === 0xa0) { out.push(0x20); return; } // control chars / nbsp -> space
  if (cp <= 0x7e || (cp >= 0xa1 && cp <= 0xff)) { out.push(cp); return; }
  const extra = CP1252_EXTRA[cp];
  if (extra !== undefined) { out.push(extra); return; }
  const rep = REPLACEMENTS[ch];
  if (rep !== undefined) { for (const c of rep) pushCodes(c, out, depth + 1); return; }
  if (depth === 0) {
    // Try stripping accents from letters WinAnsi lacks (e.g. "ś" -> "s").
    const base = ch.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    if (base && base !== ch && /^[\x20-\x7e]+$/.test(base)) {
      for (const c of base) pushCodes(c, out, depth + 1);
      return;
    }
  }
  out.push(QUESTION_MARK);
}

/** Convert arbitrary text to a string whose char codes are WinAnsi bytes. */
function sanitize(input: unknown): string {
  const raw = typeof input === "string" ? input : input == null ? "" : String(input);
  const codes: number[] = [];
  for (const ch of raw.normalize("NFC")) pushCodes(ch, codes);
  let out = "";
  for (let i = 0; i < codes.length; i += 4096) out += String.fromCharCode(...codes.slice(i, i + 4096));
  return out;
}

/** Escape a byte string for use inside a PDF literal string. */
function pdfEscape(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0x5c) out += "\\\\";
    else if (c === 0x28) out += "\\(";
    else if (c === 0x29) out += "\\)";
    else if (c < 32 || c > 126) out += "\\" + (c > 255 ? QUESTION_MARK : c).toString(8).padStart(3, "0");
    else out += s[i];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Line wrapping
// ---------------------------------------------------------------------------

const SOFT_BREAK_AFTER = "/-_.,;:?&=)]}";

/** Break a single over-long token into pieces that each fit `maxW`. */
function breakLongToken(token: string, font: FontKey, size: number, maxW: number): string[] {
  const segments: string[] = [];
  let seg = "";
  for (const ch of token) {
    seg += ch;
    if (SOFT_BREAK_AFTER.includes(ch)) { segments.push(seg); seg = ""; }
  }
  if (seg) segments.push(seg);

  const pieces: string[] = [];
  let cur = "";
  let curW = 0;
  const flush = () => { if (cur) { pieces.push(cur); cur = ""; curW = 0; } };
  for (const s of segments) {
    const sw = textWidth(s, font, size);
    if (sw <= maxW) {
      if (curW + sw <= maxW) { cur += s; curW += sw; } else { flush(); cur = s; curW = sw; }
    } else {
      flush();
      for (const ch of s) {
        const cw = textWidth(ch, font, size);
        if (curW + cw > maxW && cur) flush();
        cur += ch;
        curW += cw;
      }
    }
  }
  flush();
  return pieces.length ? pieces : [token];
}

/** Wrap text (honouring "\n") into lines no wider than `maxW`. */
function wrapText(raw: unknown, font: FontKey, size: number, maxW: number): string[] {
  const text = typeof raw === "string" ? raw : raw == null ? "" : String(raw);
  const lines: string[] = [];
  const spaceW = textWidth(" ", font, size);
  for (const para of text.split(/\r\n|\r|\n/)) {
    const words = sanitize(para).split(" ").filter((w) => w.length > 0);
    if (words.length === 0) { lines.push(""); continue; }
    let cur = "";
    let curW = 0;
    for (const word of words) {
      const ww = textWidth(word, font, size);
      if (ww <= maxW) {
        if (cur === "") { cur = word; curW = ww; }
        else if (curW + spaceW + ww <= maxW) { cur += " " + word; curW += spaceW + ww; }
        else { lines.push(cur); cur = word; curW = ww; }
      } else {
        if (cur !== "") { lines.push(cur); cur = ""; curW = 0; }
        const pieces = breakLongToken(word, font, size, maxW);
        for (let i = 0; i < pieces.length - 1; i++) lines.push(pieces[i]);
        cur = pieces[pieces.length - 1];
        curW = textWidth(cur, font, size);
      }
    }
    lines.push(cur);
  }
  return lines;
}

/** Truncate a single line with "..." so it fits `maxW`. */
function fitLine(raw: unknown, font: FontKey, size: number, maxW: number): string {
  const s = sanitize(raw).replace(/\s+/g, " ").trim();
  if (textWidth(s, font, size) <= maxW) return s;
  const ell = "...";
  let out = s;
  while (out.length > 0 && textWidth(out + ell, font, size) > maxW) out = out.slice(0, -1);
  return out.trimEnd() + ell;
}

// ---------------------------------------------------------------------------
// Low-level page content builder
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 40;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const TOP_FIRST = 40;
const TOP_NEXT = 60; // room for the running header on pages 2+
const BOTTOM_LIMIT = PAGE_H - 54; // room for the footer

const C_TEXT: RGB = [51, 65, 85];
const C_TITLE: RGB = [15, 23, 42];
const C_MUTED: RGB = [100, 116, 139];
const C_ACCENT: RGB = [79, 70, 229];
const C_WHITE: RGB = [255, 255, 255];
const C_ZEBRA: RGB = [244, 246, 251];
const C_RULE: RGB = [221, 227, 238];

const BODY = 9.5;
const BODY_LH = 13.5;
const CELL = 8.5;
const CELL_LH = 11.5;
const CELL_PAD_X = 5;
const CELL_PAD_Y = 4;
const TABLE_HEADER_H = 20;
const BULLET = String.fromCharCode(0x95);

function num(n: number): string {
  const s = n.toFixed(2).replace(/\.?0+$/, "");
  return s === "-0" || s === "" ? "0" : s;
}
function rgb(c: RGB): string {
  return c.map((v) => (v / 255).toFixed(3)).join(" ");
}

class PdfBuilder {
  private pages: string[][] = [];
  private idx = -1;
  y = 0;

  private readonly projectName: string;

  constructor(projectName: string) {
    this.projectName = projectName;
    this.newPage();
  }

  private get ops(): string[] { return this.pages[this.idx]; }
  get pageCount(): number { return this.pages.length; }
  private get top(): number { return this.idx === 0 ? TOP_FIRST : TOP_NEXT; }
  get atPageTop(): boolean { return this.y <= this.top + 0.01; }

  newPage(): void {
    this.pages.push([]);
    this.idx = this.pages.length - 1;
    this.y = this.top;
  }

  /** Start a new page unless `h` fits on the current one. */
  ensure(h: number): void {
    if (this.y + h > BOTTOM_LIMIT && !this.atPageTop) this.newPage();
  }

  // --- primitives (all coordinates are top-down; `s` is already sanitised) ---

  private drawText(s: string, x: number, top: number, font: FontKey, size: number, color: RGB, lineH: number): void {
    if (!s) return;
    const baseline = top + (lineH - size) / 2 + size * 0.8;
    this.ops.push(`${rgb(color)} rg BT /${font} ${num(size)} Tf ${num(x)} ${num(PAGE_H - baseline)} Td (${pdfEscape(s)}) Tj ET`);
  }
  private fillRect(x: number, top: number, w: number, h: number, color: RGB): void {
    this.ops.push(`${rgb(color)} rg ${num(x)} ${num(PAGE_H - top - h)} ${num(w)} ${num(h)} re f`);
  }
  private strokeRect(x: number, top: number, w: number, h: number, color: RGB, lw = 0.8): void {
    this.ops.push(`${rgb(color)} RG ${num(lw)} w ${num(x)} ${num(PAGE_H - top - h)} ${num(w)} ${num(h)} re S`);
  }
  private hLine(x1: number, x2: number, top: number, color: RGB, lw = 0.6): void {
    this.ops.push(`${rgb(color)} RG ${num(lw)} w ${num(x1)} ${num(PAGE_H - top)} m ${num(x2)} ${num(PAGE_H - top)} l S`);
  }

  // --- flow elements ---

  space(h: number): void {
    if (!this.atPageTop) this.y += h;
  }

  /** Wrapped paragraph that may continue across pages. */
  paragraph(text: unknown, opts: { size?: number; lh?: number; font?: FontKey; color?: RGB; indent?: number; after?: number } = {}): void {
    const size = opts.size ?? BODY;
    const lh = opts.lh ?? BODY_LH;
    const font = opts.font ?? "F1";
    const indent = opts.indent ?? 0;
    const lines = wrapText(text, font, size, CONTENT_W - indent);
    if (lines.length === 1 && lines[0] === "") return;
    lines.forEach((line, i) => {
      this.ensure(lh * (i === 0 ? Math.min(lines.length, 2) : 1));
      this.drawText(line, MARGIN_X + indent, this.y, font, size, opts.color ?? C_TEXT, lh);
      this.y += lh;
    });
    this.y += opts.after ?? 6;
  }

  sectionTitle(title: string): void {
    this.ensure(26 + BODY_LH * 3);
    if (!this.atPageTop) this.y += 8;
    this.fillRect(MARGIN_X, this.y, 4, 18, C_ACCENT);
    this.drawText(sanitize(title), MARGIN_X + 12, this.y, "F2", 13, C_TITLE, 18);
    this.y += 26;
  }

  subTitle(title: string): void {
    this.ensure(16 + BODY_LH * 2);
    this.drawText(sanitize(title), MARGIN_X, this.y, "F2", 10, C_TITLE, 14);
    this.y += 16;
  }

  private listItems(items: string[], kind: "bullet" | "number" | "check"): void {
    const indent = kind === "number" ? 22 : kind === "check" ? 20 : 14;
    items.forEach((item, n) => {
      const lines = wrapText(item, "F1", BODY, CONTENT_W - indent);
      lines.forEach((line, i) => {
        this.ensure(BODY_LH * (i === 0 ? Math.min(lines.length, 2) : 1));
        if (i === 0) {
          if (kind === "bullet") this.drawText(BULLET, MARGIN_X + 3, this.y, "F2", BODY, C_ACCENT, BODY_LH);
          else if (kind === "number") this.drawText(`${n + 1}.`, MARGIN_X + 2, this.y, "F2", BODY, C_ACCENT, BODY_LH);
          else this.strokeRect(MARGIN_X + 3, this.y + 3, 8, 8, C_ACCENT, 0.9);
        }
        this.drawText(line, MARGIN_X + indent, this.y, "F1", BODY, C_TEXT, BODY_LH);
        this.y += BODY_LH;
      });
      this.y += 2.5;
    });
    this.y += 4;
  }
  bullets(items: string[]): void { this.listItems(items, "bullet"); }
  numbered(items: string[]): void { this.listItems(items, "number"); }
  checklist(items: string[]): void { this.listItems(items, "check"); }

  /** Table with repeating header, zebra rows, and rows that split across pages. */
  table(headers: string[], fractions: number[], rows: string[][], opts: { boldFirstColumn?: boolean } = {}): void {
    if (rows.length === 0) return;
    const widths = fractions.map((f) => f * CONTENT_W);
    const xs: number[] = [];
    widths.reduce((acc, w) => { xs.push(MARGIN_X + acc); return acc + w; }, 0);
    let tableTop = 0; // y just below the header on the current page

    const drawHeader = () => {
      this.fillRect(MARGIN_X, this.y, CONTENT_W, TABLE_HEADER_H, C_ACCENT);
      headers.forEach((h, i) => {
        this.drawText(fitLine(h, "F2", CELL, widths[i] - CELL_PAD_X * 2), xs[i] + CELL_PAD_X, this.y, "F2", CELL, C_WHITE, TABLE_HEADER_H);
      });
      this.y += TABLE_HEADER_H;
      tableTop = this.y;
    };
    const pageWithHeader = () => { this.newPage(); drawHeader(); };

    this.ensure(TABLE_HEADER_H + CELL_LH * 2 + CELL_PAD_Y * 2);
    drawHeader();

    rows.forEach((row, rowIndex) => {
      const cells = headers.map((_, i) => wrapText(row[i] ?? "", opts.boldFirstColumn && i === 0 ? "F2" : "F1", CELL, widths[i] - CELL_PAD_X * 2));
      const total = Math.max(...cells.map((c) => c.length));
      const pageBody = BOTTOM_LIMIT - TOP_NEXT - TABLE_HEADER_H;
      let start = 0;
      while (start < total) {
        const remaining = total - start;
        const fullH = remaining * CELL_LH + CELL_PAD_Y * 2;
        const avail = BOTTOM_LIMIT - this.y;
        let take = remaining;
        if (fullH > avail) {
          const atTableTop = this.y <= tableTop + 0.01;
          if (!atTableTop && fullH <= pageBody) { pageWithHeader(); continue; } // keep short rows whole
          take = Math.floor((avail - CELL_PAD_Y * 2) / CELL_LH);
          if (take < 1) { pageWithHeader(); continue; }
        }
        const h = take * CELL_LH + CELL_PAD_Y * 2;
        if (rowIndex % 2 === 1) this.fillRect(MARGIN_X, this.y, CONTENT_W, h, C_ZEBRA);
        cells.forEach((lines, i) => {
          const font: FontKey = opts.boldFirstColumn && i === 0 ? "F2" : "F1";
          lines.slice(start, start + take).forEach((line, li) => {
            this.drawText(line, xs[i] + CELL_PAD_X, this.y + CELL_PAD_Y + li * CELL_LH, font, CELL, i === 0 && opts.boldFirstColumn ? C_TITLE : C_TEXT, CELL_LH);
          });
        });
        this.hLine(MARGIN_X, MARGIN_X + CONTENT_W, this.y + h, C_RULE);
        this.y += h;
        start += take;
        if (start < total) pageWithHeader();
      }
    });
    this.y += 10;
  }

  // --- cover / header block ---

  cover(title: string, metaLine: string, dateText: string): void {
    const pill = sanitize("FLOWFORGE AI");
    const pillW = textWidth(pill, "F2", 8) + 16;
    this.fillRect(MARGIN_X, this.y, pillW, 18, C_ACCENT);
    this.drawText(pill, MARGIN_X + 8, this.y, "F2", 8, C_WHITE, 18);
    const d = sanitize(dateText);
    this.drawText(d, PAGE_W - MARGIN_X - textWidth(d, "F1", 8.5), this.y, "F1", 8.5, C_MUTED, 18);
    this.y += 30;

    let titleLines = wrapText(title || "Untitled Project", "F2", 22, CONTENT_W);
    if (titleLines.length > 3) {
      titleLines = titleLines.slice(0, 3);
      titleLines[2] = fitLine(titleLines[2] + "...", "F2", 22, CONTENT_W);
    }
    titleLines.forEach((line) => {
      this.drawText(line, MARGIN_X, this.y, "F2", 22, C_TITLE, 27);
      this.y += 27;
    });
    this.y += 2;
    this.drawText(sanitize("Comprehensive Software Development Blueprint"), MARGIN_X, this.y, "F1", 11, C_ACCENT, 15);
    this.y += 19;
    for (const line of wrapText(metaLine, "F1", 8.5, CONTENT_W)) {
      this.drawText(line, MARGIN_X, this.y, "F1", 8.5, C_MUTED, 12);
      this.y += 12;
    }
    this.y += 4;
    this.hLine(MARGIN_X, PAGE_W - MARGIN_X, this.y, C_RULE, 0.8);
    this.y += 10;
  }

  // --- final assembly ---

  private decorate(): void {
    const total = this.pages.length;
    for (let i = 0; i < total; i++) {
      this.idx = i;
      if (i > 0) {
        const brand = sanitize("FLOWFORGE AI");
        this.drawText(brand, MARGIN_X, 26, "F2", 8, C_ACCENT, 12);
        const bw = textWidth(brand, "F2", 8) + 10;
        this.drawText(fitLine(this.projectName, "F1", 8, CONTENT_W - bw), MARGIN_X + bw, 26, "F1", 8, C_MUTED, 12);
        this.hLine(MARGIN_X, PAGE_W - MARGIN_X, 44, C_RULE, 0.6);
      }
      const footTop = PAGE_H - 40;
      this.hLine(MARGIN_X, PAGE_W - MARGIN_X, footTop, C_RULE, 0.6);
      this.drawText(sanitize("Generated by FlowForge AI"), MARGIN_X, footTop + 8, "F1", 8, C_MUTED, 12);
      const label = sanitize(`Page ${i + 1} of ${total}`);
      this.drawText(label, PAGE_W - MARGIN_X - textWidth(label, "F1", 8), footTop + 8, "F1", 8, C_MUTED, 12);
    }
  }

  build(title: string, now: Date): Uint8Array {
    this.decorate();

    const objects: string[] = []; // objects[i] is the body of object number i+1
    const pageObj = (i: number) => 6 + i * 2;
    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    objects.push(`<< /Type /Pages /Kids [${this.pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] /Count ${this.pages.length} >>`);
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const p2 = (n: number) => String(n).padStart(2, "0");
    const stamp = `D:${now.getUTCFullYear()}${p2(now.getUTCMonth() + 1)}${p2(now.getUTCDate())}${p2(now.getUTCHours())}${p2(now.getUTCMinutes())}${p2(now.getUTCSeconds())}Z`;
    const asciiTitle = sanitize(title).replace(/[^\x20-\x7e]/g, "?");
    objects.push(`<< /Title (${pdfEscape(asciiTitle)}) /Producer (FlowForge AI) /Creator (FlowForge AI) /CreationDate (${stamp}) >>`);
    this.pages.forEach((ops, i) => {
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(PAGE_W)} ${num(PAGE_H)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageObj(i) + 1} 0 R >>`,
      );
      const stream = ops.join("\n");
      objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    });

    // Assemble as a binary string: 1 char == 1 byte, so offsets are exact.
    let out = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefAt = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) {
      const c = out.charCodeAt(i);
      if (c > 255) throw new Error("Internal error: non-byte character in PDF output.");
      bytes[i] = c;
    }
    return bytes;
  }
}

// ---------------------------------------------------------------------------
// Blueprint -> document
// ---------------------------------------------------------------------------

function list<T>(v: T[] | null | undefined): T[] {
  return Array.isArray(v) ? v : [];
}
function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}
function days(v: unknown): string {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "-";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
function dashList(items: string[]): string {
  // Real Unicode bullet: sanitize() maps it to the WinAnsi bullet glyph.
  return items.map((s) => `\u2022 ${s}`).join("\n");
}

/** Build the PDF bytes for a blueprint. Pure function: no DOM access. */
export function buildBlueprintPdf(blueprint: Blueprint, projectName: string, now: Date = new Date()): Uint8Array {
  const bp = blueprint;
  const name = str(projectName) || str(bp?.project?.name) || "Untitled Project";
  const pdf = new PdfBuilder(name);

  const dateText = `Date: ${now.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`;
  const meta = [
    str(bp?.workflow?.name) && `Strategy: ${str(bp.workflow.name)}`,
    str(bp?.database?.databaseType) && `Database: ${str(bp.database.databaseType)}`,
  ].filter(Boolean).join("   |   ");
  pdf.cover(name, meta, dateText);

  let n = 0;
  const section = (title: string) => pdf.sectionTitle(`${++n}. ${title}`);

  // 1. Overview
  const goals = list(bp?.project?.goals).map(str).filter(Boolean);
  const assumptions = list(bp?.project?.assumptions).map(str).filter(Boolean);
  if (str(bp?.project?.summary) || goals.length || assumptions.length) {
    section("Project Overview");
    pdf.paragraph(bp.project.summary, { after: 8 });
    if (goals.length) { pdf.subTitle("Primary Project Goals"); pdf.bullets(goals); }
    if (assumptions.length) { pdf.subTitle("Technical & Business Assumptions"); pdf.bullets(assumptions); }
  }

  // 2. Workflow
  const steps = list(bp?.workflow?.steps).map(str).filter(Boolean);
  if (str(bp?.workflow?.name) || str(bp?.workflow?.recommendationReason) || steps.length) {
    section("Recommended Development Workflow");
    if (str(bp.workflow.name)) pdf.paragraph(`Approach: ${str(bp.workflow.name)}`, { font: "F2", color: C_TITLE, after: 4 });
    if (str(bp.workflow.recommendationReason)) pdf.paragraph(`Rationale: ${str(bp.workflow.recommendationReason)}`, { after: 8 });
    if (steps.length) { pdf.subTitle("Workflow Steps"); pdf.numbered(steps); }
  }

  // 3. Architecture
  const components = list(bp?.architecture?.components);
  const dataFlow = list(bp?.architecture?.dataFlow).map(str).filter(Boolean);
  if (str(bp?.architecture?.overview) || components.length || dataFlow.length) {
    section("System Architecture & Components");
    pdf.paragraph(bp.architecture.overview, { after: 8 });
    if (components.length) {
      pdf.subTitle("Core Components");
      pdf.table(["Component", "Technology", "Purpose"], [0.24, 0.24, 0.52],
        components.map((c) => [str(c?.name), str(c?.technology), str(c?.purpose)]), { boldFirstColumn: true });
    }
    if (dataFlow.length) { pdf.subTitle("Data Flow"); pdf.numbered(dataFlow); }
  }

  // 4. Database
  const entities = list(bp?.database?.entities);
  const indexes = list(bp?.database?.indexes).map(str).filter(Boolean);
  const dbNotes = list(bp?.database?.notes).map(str).filter(Boolean);
  if (str(bp?.database?.databaseType) || entities.length || indexes.length || dbNotes.length) {
    section("Database Design");
    if (str(bp.database.databaseType)) pdf.paragraph(`Database engine: ${str(bp.database.databaseType)}`, { font: "F2", color: C_TITLE, after: 6 });
    if (entities.length) {
      pdf.subTitle("Entities");
      pdf.table(["Entity", "Fields", "Description & Relationships"], [0.2, 0.3, 0.5],
        entities.map((e) => {
          const rel = list(e?.relationships).map(str).filter(Boolean);
          const desc = [str(e?.description), rel.length ? `Relationships: ${rel.join("; ")}` : ""].filter(Boolean).join("\n");
          return [str(e?.name), list(e?.fields).map(str).filter(Boolean).join(", "), desc];
        }), { boldFirstColumn: true });
    }
    if (indexes.length) { pdf.subTitle("Indexes"); pdf.bullets(indexes); }
    if (dbNotes.length) { pdf.subTitle("Design Notes"); pdf.bullets(dbNotes); }
  }

  // 5. AI stack
  const ai = bp?.aiStack;
  const aiRows: string[][] = [];
  if (ai?.llm) aiRows.push(["Language Model", str(ai.llm.name), str(ai.llm.reason)]);
  if (ai?.embeddingModel) aiRows.push(["Embedding Model", str(ai.embeddingModel.name), str(ai.embeddingModel.reason)]);
  if (ai?.vectorDatabase) aiRows.push(["Vector Database", str(ai.vectorDatabase.name), str(ai.vectorDatabase.reason)]);
  const aiFeatures = list(ai?.aiFeatures).map(str).filter(Boolean);
  if (aiRows.length || str(ai?.rag) || aiFeatures.length) {
    section("AI Technology Stack");
    if (aiRows.length) {
      pdf.table(["Component", "Choice", "Rationale"], [0.22, 0.26, 0.52], aiRows, { boldFirstColumn: true });
    }
    if (str(ai?.rag)) { pdf.subTitle("Retrieval Architecture"); pdf.paragraph(ai?.rag, { after: 8 }); }
    if (aiFeatures.length) { pdf.subTitle("AI Features"); pdf.bullets(aiFeatures); }
  }

  // 6. Roadmap
  const roadmap = list(bp?.roadmap);
  if (roadmap.length) {
    section("Implementation Roadmap");
    pdf.table(["Phase", "Duration", "Objectives & Deliverables"], [0.26, 0.14, 0.6],
      roadmap.map((p) => {
        const obj = list(p?.objectives).map(str).filter(Boolean);
        const del = list(p?.deliverables).map(str).filter(Boolean);
        const parts = [obj.length ? `Objectives:\n${dashList(obj)}` : "", del.length ? `Deliverables:\n${dashList(del)}` : ""].filter(Boolean);
        return [str(p?.phase), str(p?.duration), parts.join("\n")];
      }), { boldFirstColumn: true });
  }

  // 7. Tools
  const tools = list(bp?.tools);
  if (tools.length) {
    section("Recommended Tools & Technologies");
    pdf.table(["Category", "Tool", "Purpose"], [0.22, 0.28, 0.5],
      tools.map((t) => [str(t?.category), str(t?.name), str(t?.purpose)]), { boldFirstColumn: true });
  }

  // 8. Project structure
  const structure = list(bp?.projectStructure);
  if (structure.length) {
    section("Project Folder Structure");
    pdf.table(["Path", "Purpose"], [0.5, 0.5], structure.map((s) => [str(s?.path), str(s?.purpose)]), { boldFirstColumn: true });
  }

  // 9. Development flow
  const flow = list(bp?.developmentFlow).map(str).filter(Boolean);
  if (flow.length) {
    section("Development Flow");
    pdf.numbered(flow);
  }

  // 10. Effort
  const effort = list(bp?.effort);
  if (effort.length) {
    section("Effort & Timeline Estimate");
    pdf.table(["Area", "Est. Days", "Rationale"], [0.28, 0.12, 0.6],
      effort.map((e) => [str(e?.area), days(e?.estimatedDays), str(e?.reason)]), { boldFirstColumn: true });
    const totalDays = effort.reduce((sum, e) => sum + (Number.isFinite(Number(e?.estimatedDays)) ? Number(e.estimatedDays) : 0), 0);
    pdf.paragraph(`Total estimated effort: ${days(totalDays)} days`, { font: "F2", color: C_TITLE });
  }

  // 11. Risks
  const risks = list(bp?.risks);
  if (risks.length) {
    section("Risks & Mitigation");
    pdf.table(["Risk", "Impact", "Mitigation"], [0.38, 0.12, 0.5],
      risks.map((r) => [str(r?.risk), str(r?.impact).toUpperCase(), str(r?.mitigation)]));
  }

  // 12. Next steps
  const next = list(bp?.nextSteps).map(str).filter(Boolean);
  if (next.length) {
    section("Next Steps");
    pdf.checklist(next);
  }

  return pdf.build(`${name} - Blueprint`, now);
}

// ---------------------------------------------------------------------------
// Browser download
// ---------------------------------------------------------------------------

/** Safe file name for the download (kept short for Windows path limits). */
export function pdfFileName(projectName: string): string {
  const slug = String(projectName ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // "Café" -> "Cafe"
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${slug || "flowforge-project"}-blueprint.pdf`;
}

/**
 * Generate the PDF and trigger a browser download.
 * Any failure is thrown with its original message so the caller can show the
 * real reason instead of a generic "something went wrong".
 */
export function exportBlueprintToPdf(blueprint: Blueprint, projectName: string): void {
  const bytes = buildBlueprintPdf(blueprint, projectName);

  // `bytes` owns an exactly-sized buffer, so passing the buffer is lossless.
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = pdfFileName(projectName);
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  // Revoke later: revoking immediately can cancel the download in some browsers.
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(url);
  }, 1500);
}
