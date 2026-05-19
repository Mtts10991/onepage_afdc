/**
 * Convert sanitized Tiptap HTML into a `pptxgenjs` text-runs array.
 *
 * Background (M5): the previous `htmlToText()` collapsed every formatting
 * mark — bold, italic, underline, font-size, color, alignment — into
 * plain text before handing it to PowerPoint, so users who carefully
 * formatted a paragraph in the editor saw an unformatted block in the
 * exported PPTX. This module walks the (sanitized) Tiptap output and
 * emits the structured form pptxgenjs needs:
 *
 *     slide.addText([
 *       { text: "Bold: ", options: { bold: false } },
 *       { text: "important", options: { bold: true, color: "C00000" } },
 *       { text: " normal.", options: { breakLine: true } },
 *     ], { ...frameOptions });
 *
 * We deliberately use a small regex-based tokenizer rather than pulling
 * in jsdom: the input is bounded (Tiptap output is well-formed, already
 * sanitized by `sanitizeRichHtml` upstream) and we only need to recognise
 * a closed set of tags/marks. Anything we don't recognise is treated as
 * plain text — never silently swallowed.
 */

export type Align = "left" | "center" | "right" | "justify";

export interface PptxTextRunOptions {
  bold?: boolean;
  italic?: boolean;
  underline?: { style: "sng" };
  color?: string;          // 6-char hex, no leading '#'
  fontSize?: number;       // pt
  breakLine?: boolean;
  bullet?: boolean | { type: "bullet" | "number" };
  align?: Align;
  hyperlink?: { url: string };
}

export interface PptxTextRun {
  text: string;
  options?: PptxTextRunOptions;
}

interface ActiveMarks {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color?: string;
  fontSize?: number;
  link?: string;
}

const VOID_TAGS = new Set(["br", "img", "hr"]);
const BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote"]);

/**
 * Parse a Tiptap-style style="..." attribute fragment into the marks we
 * care about. Anything else is ignored (the editor only emits these via
 * its FontSize / Color / LetterSpacing extensions).
 */
function parseStyleAttr(
  style: string,
): Partial<ActiveMarks> & { align?: Align } {
  const out: Partial<ActiveMarks> & { align?: Align } = {};
  const fs = /font-size:\s*(\d+(?:\.\d+)?)\s*(px|pt)?/i.exec(style);
  if (fs) {
    const n = Number(fs[1]);
    const unit = (fs[2] ?? "px").toLowerCase();
    // Convert px → pt (1pt = 1.333px). pptxgenjs expects pt.
    out.fontSize = unit === "pt" ? Math.round(n) : Math.round(n * 0.75);
  }
  const col = /color:\s*(#?[0-9a-f]{3,8}|rgb\([^)]+\))/i.exec(style);
  if (col) {
    const hex = normaliseColor(col[1]);
    if (hex) out.color = hex;
  }
  const ta = /text-align:\s*(left|center|right|justify)/i.exec(style);
  if (ta) out.align = ta[1].toLowerCase() as Align;
  return out;
}

function normaliseColor(raw: string): string | null {
  const v = raw.trim();
  const hex = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(v);
  if (hex) return hex[1].toUpperCase();
  const short = /^#?([0-9a-f]{3})$/i.exec(v);
  if (short) {
    const [r, g, b] = short[1];
    return `${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(v);
  if (rgb) {
    const [, r, g, b] = rgb;
    return [r, g, b]
      .map((n) => Math.max(0, Math.min(255, parseInt(n, 10))).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/**
 * Tokeniser-based walker. We iterate `<tag>`...`</tag>` open/close events
 * over the input string, maintaining a stack of active block + inline
 * marks. Text nodes between tags become PptxTextRun entries.
 */
export function htmlToTextRuns(html: string): PptxTextRun[] {
  if (!html) return [];
  const runs: PptxTextRun[] = [];

  // Stack tracks nested marks so that `<strong>a<em>b</em>c</strong>` yields
  // `a` (bold), `b` (bold+italic), `c` (bold).
  const markStack: Array<Partial<ActiveMarks>> = [];
  // Block-level alignment carries to the trailing breakLine for that block.
  let currentBlockAlign: Align | undefined;
  // Bullet state: whether we're currently inside <ul>/<ol> and which kind.
  const listStack: Array<"ul" | "ol"> = [];
  // Whether the next emitted run should start a fresh list item bullet.
  let pendingBullet = false;
  // Whether we owe a breakLine before the next text run (e.g. after </p>).
  let pendingBreakBefore = false;
  let firstBlockRun = true;

  function activeMarks(): ActiveMarks {
    const m: ActiveMarks = { bold: false, italic: false, underline: false };
    for (const layer of markStack) {
      if (layer.bold) m.bold = true;
      if (layer.italic) m.italic = true;
      if (layer.underline) m.underline = true;
      if (layer.color !== undefined) m.color = layer.color;
      if (layer.fontSize !== undefined) m.fontSize = layer.fontSize;
      if (layer.link !== undefined) m.link = layer.link;
    }
    return m;
  }

  function emitText(raw: string) {
    const text = decodeEntities(raw);
    if (!text) return;
    const marks = activeMarks();
    const options: PptxTextRun["options"] = {};
    if (marks.bold) options.bold = true;
    if (marks.italic) options.italic = true;
    if (marks.underline) options.underline = { style: "sng" };
    if (marks.color) options.color = marks.color;
    if (marks.fontSize) options.fontSize = marks.fontSize;
    if (marks.link) options.hyperlink = { url: marks.link };
    if (currentBlockAlign) options.align = currentBlockAlign;
    if (pendingBullet) {
      options.bullet = listStack[listStack.length - 1] === "ol"
        ? { type: "number" }
        : true;
      pendingBullet = false;
    }
    if (pendingBreakBefore && runs.length > 0) {
      // Attach the line-break to the PREVIOUS run so the new run starts
      // on a fresh line — pptxgenjs semantics.
      const prev = runs[runs.length - 1];
      prev.options = { ...prev.options, breakLine: true };
      pendingBreakBefore = false;
    }
    runs.push({ text, options: Object.keys(options).length ? options : undefined });
  }

  function openTag(tag: string, attrs: Record<string, string>) {
    const layer: Partial<ActiveMarks> = {};
    if (tag === "strong" || tag === "b") layer.bold = true;
    if (tag === "em" || tag === "i") layer.italic = true;
    if (tag === "u") layer.underline = true;
    if (tag === "a") {
      const href = attrs.href;
      if (href) layer.link = href;
    }
    if (tag === "span" && attrs.style) {
      Object.assign(layer, parseStyleAttr(attrs.style));
    }
    if (BLOCK_TAGS.has(tag)) {
      currentBlockAlign = attrs.style ? parseStyleAttr(attrs.style).align : undefined;
      if (tag === "h1") layer.bold = true, (layer.fontSize = 18);
      if (tag === "h2") layer.bold = true, (layer.fontSize = 16);
      if (tag === "h3") layer.bold = true, (layer.fontSize = 14);
      if (!firstBlockRun) pendingBreakBefore = true;
      firstBlockRun = false;
      if (tag === "li") pendingBullet = true;
    }
    if (tag === "ul") listStack.push("ul");
    if (tag === "ol") listStack.push("ol");
    markStack.push(layer);
  }

  function closeTag(tag: string) {
    markStack.pop();
    if (BLOCK_TAGS.has(tag)) {
      currentBlockAlign = undefined;
      // Subsequent block tag will set pendingBreakBefore — no need to do it here.
    }
    if (tag === "ul" || tag === "ol") listStack.pop();
  }

  // Walk the string. We use a single regex that matches one of:
  //   - text up to next '<'
  //   - an opening tag (with optional attributes)
  //   - a closing tag
  //   - a void / self-closing tag (e.g. <br/>)
  const TOKEN_RE = /([^<]+)|<\/([a-z][a-z0-9]*)\s*>|<([a-z][a-z0-9]*)((?:\s+[a-z-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/gi;

  let m: RegExpExecArray | null;
  while ((m = TOKEN_RE.exec(html))) {
    const [, textChunk, closeName, openName, attrFragment, selfSlash] = m;
    if (textChunk !== undefined) {
      // Tiptap inserts whitespace-only text nodes between block tags; keep
      // visible whitespace but drop pure-whitespace runs adjacent to block
      // boundaries to avoid empty lines in the PPTX.
      if (textChunk.trim() === "" && (pendingBreakBefore || runs.length === 0)) continue;
      emitText(textChunk);
      continue;
    }
    if (closeName) {
      closeTag(closeName.toLowerCase());
      continue;
    }
    if (openName) {
      const tag = openName.toLowerCase();
      const attrs: Record<string, string> = {};
      const ATTR_RE = /([a-z-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;
      let am: RegExpExecArray | null;
      while ((am = ATTR_RE.exec(attrFragment ?? ""))) {
        const [, name, q1, q2, bare] = am;
        attrs[name.toLowerCase()] = q1 ?? q2 ?? bare ?? "";
      }
      if (tag === "br" || (VOID_TAGS.has(tag) && tag !== "img")) {
        if (runs.length > 0) {
          const prev = runs[runs.length - 1];
          prev.options = { ...prev.options, breakLine: true };
        }
        continue;
      }
      openTag(tag, attrs);
      if (selfSlash || VOID_TAGS.has(tag)) {
        closeTag(tag);
      }
    }
  }

  // Trim trailing breakLine — pptxgenjs adds visible empty trailing line otherwise.
  if (runs.length > 0) {
    const last = runs[runs.length - 1];
    if (last.options?.breakLine) {
      const { breakLine, ...rest } = last.options;
      last.options = Object.keys(rest).length ? rest : undefined;
    }
  }

  return runs;
}
