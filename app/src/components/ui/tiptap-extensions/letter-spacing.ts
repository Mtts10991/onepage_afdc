import { Extension } from "@tiptap/react";
import "@tiptap/extension-text-style";

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    letterSpacing: {
      /** Apply a CSS letter-spacing value (e.g. `"0.5px"`, `"-0.4px"`). */
      setLetterSpacing: (value: string) => ReturnType;
      /** Remove the letter-spacing mark from the current selection. */
      unsetLetterSpacing: () => ReturnType;
    };
  }
}

/**
 * LetterSpacing extension — mirrors the `FontSize` extension's pattern but
 * writes a `letter-spacing` style on the TextStyle mark instead.
 *
 * Sticking with TextStyle (rather than a brand-new mark) means a span can
 * simultaneously carry font-size, color and letter-spacing in one tag, so
 * round-tripping through DOMPurify sanitisation stays simple (it already
 * permits inline `style` on whitelisted tags).
 *
 * Must be registered alongside `@tiptap/extension-text-style`.
 */
export const LetterSpacing = Extension.create({
  name: "letterSpacing",

  addOptions() {
    return {
      types: ["textStyle"],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          letterSpacing: {
            default: null,
            parseHTML: (element) =>
              element.style.letterSpacing?.replace(/['"]+/g, "") || null,
            renderHTML: (attributes) => {
              if (!attributes.letterSpacing) return {};
              return { style: `letter-spacing: ${attributes.letterSpacing}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setLetterSpacing:
        (value: string) =>
        ({ chain }) =>
          chain().setMark("textStyle", { letterSpacing: value }).run(),

      unsetLetterSpacing:
        () =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", { letterSpacing: null })
            .removeEmptyTextStyle()
            .run(),
    };
  },
});
