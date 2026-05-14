import DOMPurify from "isomorphic-dompurify";

/**
 * Allow-list of HTML tags/attributes that Tiptap can emit in this app.
 * Anything outside the list is stripped — including <script>, <iframe>,
 * <object>, on* event handlers, javascript: URLs, etc.
 *
 * Keep this in sync with the Tiptap extensions used in `rich-text-editor.tsx`:
 *   - StarterKit (paragraph, heading 1-3, bold, italic, strike, list, blockquote, code)
 *   - Underline, Link, TextAlign, TextStyle, FontSize, LetterSpacing
 *     (FontSize + LetterSpacing both serialise into inline `style` on
 *      <span>; DOMPurify keeps the attribute, the browser ignores any
 *      unknown CSS property, so we don't have to enumerate property names.)
 */
const TIPTAP_TAGS = [
  "p", "br", "span", "div",
  "strong", "b", "em", "i", "u", "s", "code", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "blockquote",
  "a",
];

const TIPTAP_ATTRS = [
  "href", "target", "rel",
  "class", "style",          // FontSize + TextAlign rely on inline style
];

/**
 * Sanitize HTML produced by Tiptap before rendering with
 * `dangerouslySetInnerHTML` or before passing through to a PPTX/HTML→text
 * pipeline. Returns a safe HTML string.
 *
 * - Only the allow-list above survives.
 * - Links are forced to `rel="noopener noreferrer"` and `target="_blank"`
 *   to prevent reverse-tabnabbing.
 * - `javascript:` / `data:` URLs in href are dropped by DOMPurify by default.
 */
export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: TIPTAP_TAGS,
    ALLOWED_ATTR: TIPTAP_ATTRS,
    ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel|#|\/)/i,
    ADD_ATTR: ["target", "rel"],
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "link"],
    FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover", "onfocus"],
  });
}
