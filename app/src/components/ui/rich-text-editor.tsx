"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { FontSize } from "./tiptap-extensions/font-size";
import { LetterSpacing } from "./tiptap-extensions/letter-spacing";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  Bold,
  Italic,
  UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Heading1,
  Heading2,
  Link as LinkIcon,
  Eraser,
  Type,
  ArrowLeftToLine,
  ArrowRightFromLine,
} from "lucide-react";
import { useEffect } from "react";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: number;
  /** กว้างคงที่ของ content area (px) — ให้ word-wrapping ตรงกับ preview canvas */
  contentWidth?: number;
  /** font-size ใน editor (px) — ให้ตรงกับ preview */
  fontSize?: number;
  /** line-height — ให้ตรงกับ preview */
  lineHeight?: number;
  /** ปรับ alignment เริ่มต้น */
  textAlign?: "left" | "justify";
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = 200,
  contentWidth,
  fontSize = 14,
  lineHeight = 1.55,
  textAlign = "left",
}: Props) {
  const t = useTranslations("editor");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "underline text-primary" } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TextStyle,
      FontSize,
      LetterSpacing,
      Placeholder.configure({ placeholder: placeholder ?? t("placeholder") }),
    ],
    content: value || "",
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "tiptap prose prose-sm dark:prose-invert max-w-none focus:outline-none",
          // ถ้ามี contentWidth → padding-y เท่านั้น (ให้ text area ตรง preview); ถ้าไม่ → padding ปกติ
          contentWidth ? "py-3" : "px-3 py-2",
        ),
        style: [
          `min-height: ${minHeight}px;`,
          contentWidth ? `width: ${contentWidth}px;` : "",
          `font-size: ${fontSize}px;`,
          `line-height: ${lineHeight};`,
          `text-align: ${textAlign};`,
          `box-sizing: content-box;`,
        ]
          .filter(Boolean)
          .join(" "),
      },
    },
  });

  // sync external value
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      // Tiptap v2 signature: setContent(content, emitUpdate?: boolean).
      // `false` here prevents an infinite onUpdate → setState → setContent loop.
      editor.commands.setContent(value || "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) {
    return (
      <div
        className={cn("rounded-md border bg-background animate-pulse", className)}
        style={{ minHeight }}
      />
    );
  }

  return (
    <div className={cn("rounded-md border bg-background overflow-hidden", className)}>
      <Toolbar editor={editor} />
      <div className="overflow-x-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

const FONT_SIZES = [10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 48] as const;

function Toolbar({ editor }: { editor: Editor }) {
  const t = useTranslations("editor");
  const btn = (active: boolean) =>
    cn("h-8 w-8", active && "bg-accent text-accent-foreground");

  function setLink() {
    const url = window.prompt(t("linkPrompt"), editor.getAttributes("link").href ?? "");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  const currentFontSize: string =
    (editor.getAttributes("textStyle") as { fontSize?: string })?.fontSize ?? "";

  function applyFontSize(value: string) {
    if (!value) {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(value).run();
    }
  }

  // ---- Letter-spacing (Word-style "Character Spacing → Condensed/Expanded") ----
  // We keep the same -2/-1/0/+1/+2/+3 px scale Word uses for "Spacing → By", so
  // the numbers feel familiar. 0 means "remove the mark", anything else writes
  // an inline `letter-spacing` style on a TextStyle span via the extension.
  const LETTER_STEPS = [-2, -1, 0, 1, 2, 3] as const;
  const currentLetterSpacing: string =
    (editor.getAttributes("textStyle") as { letterSpacing?: string })
      ?.letterSpacing ?? "";

  function parseLetterPx(raw: string): number {
    // Accept "1px", "-0.5px", or "" → 0. We only round to the nearest int
    // because the scale is whole-pixel; users who paste fractional values
    // still render fine, they just snap when stepped.
    if (!raw) return 0;
    const n = parseFloat(raw.replace("px", ""));
    return Number.isFinite(n) ? Math.round(n) : 0;
  }

  function applyLetterSpacing(px: number) {
    if (px === 0) {
      editor.chain().focus().unsetLetterSpacing().run();
    } else {
      editor.chain().focus().setLetterSpacing(`${px}px`).run();
    }
  }

  function stepLetterSpacing(direction: -1 | 1) {
    const cur = parseLetterPx(currentLetterSpacing);
    const idx = LETTER_STEPS.indexOf(cur as (typeof LETTER_STEPS)[number]);
    // If the current value isn't one of our canonical steps, snap to the
    // closest step in the chosen direction instead of jumping to an edge.
    const startIdx =
      idx >= 0
        ? idx
        : direction === 1
          ? LETTER_STEPS.findIndex((v) => v > cur)
          : [...LETTER_STEPS].reverse().findIndex((v) => v < cur);
    const safeStart = startIdx >= 0 ? startIdx : LETTER_STEPS.indexOf(0);
    const next =
      LETTER_STEPS[
        Math.max(0, Math.min(LETTER_STEPS.length - 1, safeStart + direction))
      ];
    applyLetterSpacing(next);
  }

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1">
      <Button size="icon" variant="ghost" className={btn(editor.isActive("heading", { level: 1 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} type="button" title="H1">
        <Heading1 className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("heading", { level: 2 }))}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} type="button" title="H2">
        <Heading2 className="h-4 w-4" />
      </Button>
      <Divider />

      {/* Font size */}
      <div className="flex items-center gap-1 px-1">
        <Type className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <select
          value={currentFontSize}
          onChange={(e) => applyFontSize(e.target.value)}
          className={cn(
            "h-7 rounded-md border border-input bg-background px-1.5 text-xs cursor-pointer",
            "focus:outline-none focus:ring-1 focus:ring-ring",
          )}
          title={t("fontSize")}
        >
          <option value="">{t("defaultSize")}</option>
          {FONT_SIZES.map((s) => (
            <option key={s} value={`${s}px`}>
              {s}
            </option>
          ))}
        </select>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-xs"
          type="button"
          title={t("decreaseSize")}
          onClick={() => {
            const cur = parseInt(currentFontSize) || 14;
            const idx = FONT_SIZES.findIndex((s) => s >= cur);
            const next = FONT_SIZES[Math.max(0, idx - 1)];
            applyFontSize(`${next}px`);
          }}
        >
          <span className="text-base leading-none">−</span>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-xs"
          type="button"
          title={t("increaseSize")}
          onClick={() => {
            const cur = parseInt(currentFontSize) || 14;
            const idx = FONT_SIZES.findIndex((s) => s > cur);
            const next = idx >= 0 ? FONT_SIZES[idx] : FONT_SIZES[FONT_SIZES.length - 1];
            applyFontSize(`${next}px`);
          }}
        >
          <span className="text-base leading-none">+</span>
        </Button>
      </div>
      <Divider />

      {/* Letter-spacing: condense (−) / reset / expand (+) — mirrors Word's
          "Character Spacing → Condensed/Normal/Expanded" trio. Only the
          *active* selection gets the inline style, so authors can squeeze
          one phrase to fit a line without affecting the rest. */}
      <div className="flex items-center gap-0.5 px-1" aria-label={t("letterSpacing")}>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          type="button"
          title={t("letterCondense")}
          aria-label={t("letterCondense")}
          onClick={() => stepLetterSpacing(-1)}
        >
          <ArrowLeftToLine className="h-3.5 w-3.5" />
        </Button>
        <span
          className="tabular-nums text-[10px] text-muted-foreground w-7 text-center select-none"
          aria-live="polite"
        >
          {currentLetterSpacing ? currentLetterSpacing.replace("px", "") : "0"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          type="button"
          title={t("letterExpand")}
          aria-label={t("letterExpand")}
          onClick={() => stepLetterSpacing(1)}
        >
          <ArrowRightFromLine className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          type="button"
          title={t("letterReset")}
          aria-label={t("letterReset")}
          onClick={() => applyLetterSpacing(0)}
          disabled={!currentLetterSpacing}
        >
          <span className="text-base leading-none">↺</span>
        </Button>
      </div>
      <Divider />

      <Button size="icon" variant="ghost" className={btn(editor.isActive("bold"))}
        onClick={() => editor.chain().focus().toggleBold().run()} type="button" title={t("bold")}>
        <Bold className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("italic"))}
        onClick={() => editor.chain().focus().toggleItalic().run()} type="button" title={t("italic")}>
        <Italic className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("underline"))}
        onClick={() => editor.chain().focus().toggleUnderline().run()} type="button" title={t("underline")}>
        <UnderlineIcon className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("strike"))}
        onClick={() => editor.chain().focus().toggleStrike().run()} type="button" title={t("strike")}>
        <Strikethrough className="h-4 w-4" />
      </Button>
      <Divider />

      <Button size="icon" variant="ghost" className={btn(editor.isActive("bulletList"))}
        onClick={() => editor.chain().focus().toggleBulletList().run()} type="button" title={t("bullet")}>
        <List className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("orderedList"))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()} type="button" title={t("ordered")}>
        <ListOrdered className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive("blockquote"))}
        onClick={() => editor.chain().focus().toggleBlockquote().run()} type="button" title={t("quote")}>
        <Quote className="h-4 w-4" />
      </Button>
      <Divider />

      <Button size="icon" variant="ghost" className={btn(editor.isActive({ textAlign: "left" }))}
        onClick={() => editor.chain().focus().setTextAlign("left").run()} type="button" title={t("alignLeft")}>
        <AlignLeft className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive({ textAlign: "center" }))}
        onClick={() => editor.chain().focus().setTextAlign("center").run()} type="button" title={t("alignCenter")}>
        <AlignCenter className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive({ textAlign: "right" }))}
        onClick={() => editor.chain().focus().setTextAlign("right").run()} type="button" title={t("alignRight")}>
        <AlignRight className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className={btn(editor.isActive({ textAlign: "justify" }))}
        onClick={() => editor.chain().focus().setTextAlign("justify").run()} type="button" title={t("alignJustify")}>
        <AlignJustify className="h-4 w-4" />
      </Button>
      <Divider />

      <Button size="icon" variant="ghost" className={btn(editor.isActive("link"))}
        onClick={setLink} type="button" title={t("link")}>
        <LinkIcon className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} type="button" title={t("clear")}>
        <Eraser className="h-4 w-4" />
      </Button>
      <Divider />

      <Button size="icon" variant="ghost" className="h-8 w-8"
        onClick={() => editor.chain().focus().undo().run()} type="button" disabled={!editor.can().undo()} title={t("undo")}>
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" className="h-8 w-8"
        onClick={() => editor.chain().focus().redo().run()} type="button" disabled={!editor.can().redo()} title={t("redo")}>
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" />;
}
