import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { pushLineMessage } from "@/lib/push-line";

describe("pushLineMessage", () => {
  const ORIGINAL_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
  });

  afterEach(() => {
    if (ORIGINAL_TOKEN !== undefined) {
      process.env.LINE_CHANNEL_ACCESS_TOKEN = ORIGINAL_TOKEN;
    } else {
      delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    }
  });

  it("skips when LINE_CHANNEL_ACCESS_TOKEN is missing and records a skipped audit row", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const ok = await pushLineMessage({
      to: "U_test",
      text: "hi",
      reason: "publish",
    });
    expect(ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    const row = await prisma.auditLog.findFirst({
      where: { event: "line.notify.skipped" },
    });
    expect(row).not.toBeNull();
    expect(row?.metadata).toContain('"cause":"no_token"');
  });

  it("posts to LINE push endpoint with bearer + audits success", async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "fake-token";
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));

    const ok = await pushLineMessage({
      to: "U_xyz",
      text: "hello\n\nworld   from   line",
      url: "https://example.app/onepages/abc",
      reason: "publish",
    });

    expect(ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe("https://api.line.me/v2/bot/message/push");
    const init = call[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer fake-token",
    );
    const body = JSON.parse(init.body as string);
    expect(body.to).toBe("U_xyz");
    // text was collapsed (no newlines/multi-spaces) — push-line strips them
    expect(body.messages[0].text).toBe("hello world from line");
    // url comes through as a second message
    expect(body.messages[1].text).toBe("https://example.app/onepages/abc");

    const row = await prisma.auditLog.findFirst({
      where: { event: "line.notify.success" },
    });
    expect(row).not.toBeNull();
  });

  it("records failure when LINE returns non-2xx", async () => {
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "fake-token";
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("rate limit", { status: 429 }),
    );

    const ok = await pushLineMessage({
      to: "U_x",
      text: "x",
      reason: "publish",
    });
    expect(ok).toBe(false);
    const row = await prisma.auditLog.findFirst({
      where: { event: "line.notify.failure" },
    });
    expect(row).not.toBeNull();
    expect(row?.metadata).toContain('"status":429');
  });
});
