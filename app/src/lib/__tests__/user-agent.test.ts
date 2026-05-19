import { describe, expect, it } from "vitest";
import { parseUA } from "../user-agent";

describe("parseUA", () => {
  it("classifies desktop Chrome as desktop", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(parseUA(ua)).toEqual({ isMobile: false, family: "desktop" });
  });

  it("classifies iOS Safari as ios/mobile", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15";
    expect(parseUA(ua)).toEqual({ isMobile: true, family: "ios" });
  });

  it("classifies Android Chrome as android/mobile", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    expect(parseUA(ua)).toEqual({ isMobile: true, family: "android" });
  });

  it("classifies LINE in-app browser as line/mobile", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; SM-A536E) AppleWebKit/537.36 Line/13.10.0";
    expect(parseUA(ua)).toEqual({ isMobile: true, family: "line" });
  });

  it("returns desktop for null/empty UA", () => {
    expect(parseUA(null)).toEqual({ isMobile: false, family: "desktop" });
    expect(parseUA("")).toEqual({ isMobile: false, family: "desktop" });
  });
});
