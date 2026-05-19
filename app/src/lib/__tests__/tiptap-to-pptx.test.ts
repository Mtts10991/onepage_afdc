import { describe, expect, it } from "vitest";
import { htmlToTextRuns } from "@/lib/tiptap-to-pptx";

describe("htmlToTextRuns", () => {
  it("emits a single run for plain text inside <p>", () => {
    const runs = htmlToTextRuns("<p>hello world</p>");
    expect(runs).toEqual([{ text: "hello world", options: undefined }]);
  });

  it("preserves bold and italic marks across nested tags", () => {
    const runs = htmlToTextRuns(
      "<p>plain <strong>bold <em>both</em></strong> done</p>",
    );
    expect(runs).toEqual([
      { text: "plain ", options: undefined },
      { text: "bold ", options: { bold: true } },
      { text: "both", options: { bold: true, italic: true } },
      { text: " done", options: undefined },
    ]);
  });

  it("emits underline as the pptxgenjs single-line style object", () => {
    const runs = htmlToTextRuns("<p><u>underlined</u></p>");
    expect(runs[0].options?.underline).toEqual({ style: "sng" });
  });

  it("inserts breakLine on the preceding run between block tags", () => {
    const runs = htmlToTextRuns("<p>one</p><p>two</p><p>three</p>");
    expect(runs.map((r) => r.text)).toEqual(["one", "two", "three"]);
    // First two runs get breakLine after them; last run does NOT (trailing
    // breakLine is trimmed so PPTX doesn't render an empty trailing line).
    expect(runs[0].options?.breakLine).toBe(true);
    expect(runs[1].options?.breakLine).toBe(true);
    expect(runs[2].options?.breakLine).toBeUndefined();
  });

  it("parses inline color from <span style=...>", () => {
    const runs = htmlToTextRuns(
      `<p><span style="color: #C00000">red</span> text</p>`,
    );
    expect(runs[0]).toEqual({ text: "red", options: { color: "C00000" } });
    expect(runs[1].text).toBe(" text");
  });

  it("converts px font-size to pt rounded", () => {
    const runs = htmlToTextRuns(
      `<p><span style="font-size: 24px">big</span></p>`,
    );
    // 24px * 0.75 = 18pt
    expect(runs[0].options?.fontSize).toBe(18);
  });

  it("carries text-align from block tag to runs", () => {
    const runs = htmlToTextRuns(`<p style="text-align: center">centered</p>`);
    expect(runs[0].options?.align).toBe("center");
  });

  it("emits bullet for <li> inside <ul>", () => {
    const runs = htmlToTextRuns(`<ul><li>first</li><li>second</li></ul>`);
    expect(runs[0].options?.bullet).toBe(true);
    expect(runs[1].options?.bullet).toBe(true);
  });

  it("emits numbered bullet for <li> inside <ol>", () => {
    const runs = htmlToTextRuns(`<ol><li>first</li></ol>`);
    expect(runs[0].options?.bullet).toEqual({ type: "number" });
  });

  it("attaches hyperlink for <a href=...>", () => {
    const runs = htmlToTextRuns(`<p>see <a href="https://x.test">link</a></p>`);
    expect(runs[1]).toEqual({
      text: "link",
      options: { hyperlink: { url: "https://x.test" } },
    });
  });

  it("decodes html entities into the run text", () => {
    const runs = htmlToTextRuns("<p>caf&eacute; &amp; bar</p>");
    // We only decode the entity subset we explicitly handle; &eacute; passes
    // through but &amp; collapses to '&'.
    expect(runs[0].text).toBe("caf&eacute; & bar");
  });

  it("returns empty array on empty input", () => {
    expect(htmlToTextRuns("")).toEqual([]);
  });
});
