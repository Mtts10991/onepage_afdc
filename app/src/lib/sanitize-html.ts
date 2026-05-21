import sanitizeHtmlLib from "sanitize-html";

/**
 * Allow-list of HTML tags/attributes that Tiptap can emit in this app.
 * Anything outside the list is stripped — including <script>, <iframe>,
 * <object>, on* event handlers, javascript: URLs, etc.
 *
 * Keep this in sync with the Tiptap extensions used in `rich-text-editor.tsx`:
 *   - StarterKit (paragraph, heading 1-3, bold, italic, strike, list, blockquote, code)
 *   - Underline, Link, TextAlign, TextStyle, FontSize, LetterSpacing
 *     (FontSize + LetterSpacing both serialise into inline `style` on
 *      <span>; the style attribute is kept and unknown CSS is ignored
 *      by the browser, so we don't have to enumerate property names.)
 *
 * Implementation note: this uses the `sanitize-html` package, not
 * `isomorphic-dompurify`. The latter pulls in `jsdom` on the server, and
 * recent jsdom depends on an ESM-only package that Vercel's serverless
 * Node runtime cannot `require()` — every PPTX export crashed with
 * `ERR_REQUIRE_ESM`. `sanitize-html` is pure JS with no DOM dependency,
 * so it runs the same in the Node runtime and the browser.
 */
const TIPTAP_TAGS = [
  "p", "br", "span", "div",
  "strong", "b", "em", "i", "u", "s", "code", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote",
  "a",
];

/**
 * Sanitize HTML produced by Tiptap before rendering with
 * `dangerouslySetInnerHTML` or before passing through to a PPTX/HTML→text
 * pipeline. Returns a safe HTML string.
 *
 * - Only the allow-list above survives; everything else is stripped.
 * - Links are forced to `rel="noopener noreferrer"` + `target="_blank"`
 *   to prevent reverse-tabnabbing.
 * - Only http/https/mailto/tel/anchor/relative hrefs are allowed —
 *   `javascript:` and `data:` URLs are dropped.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  return sanitizeHtmlLib(html, {
    allowedTags: TIPTAP_TAGS,
    // `style` + `class` are allowed on every tag because FontSize /
    // TextAlign / LetterSpacing serialise into inline style on <span>.
    allowedAttributes: {
      a: ["href", "target", "rel"],
      "*": ["class", "style"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    transformTags: {
      // Force safe link attributes regardless of what the editor emitted.
      a: sanitizeHtmlLib.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer",
      }),
    },
    // Strip disallowed tags but keep their text content — matches the
    // previous DOMPurify behaviour.
    disallowedTagsMode: "discard",
  });
}
