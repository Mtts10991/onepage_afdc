import { describe, expect, it } from "vitest";
import { onepagePlanDataSchema, defaultPlanData } from "@/lib/onepage-schema";

describe("onepagePlanDataSchema.deadline", () => {
  it("accepts null and empty string (no deadline)", () => {
    expect(onepagePlanDataSchema.safeParse({ ...defaultPlanData, deadline: null }).success).toBe(
      true,
    );
    expect(onepagePlanDataSchema.safeParse({ ...defaultPlanData, deadline: "" }).success).toBe(
      true,
    );
  });

  it("accepts a well-formed YYYY-MM-DD", () => {
    const r = onepagePlanDataSchema.safeParse({
      ...defaultPlanData,
      deadline: "2026-06-15",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a full ISO datetime", () => {
    const r = onepagePlanDataSchema.safeParse({
      ...defaultPlanData,
      deadline: "2026-06-15T09:30:00Z",
    });
    expect(r.success).toBe(true);
  });

  it("rejects gibberish", () => {
    const r = onepagePlanDataSchema.safeParse({
      ...defaultPlanData,
      deadline: "tomorrow",
    });
    expect(r.success).toBe(false);
  });

  it("rejects impossible dates", () => {
    const r = onepagePlanDataSchema.safeParse({
      ...defaultPlanData,
      deadline: "2026-13-40",
    });
    expect(r.success).toBe(false);
  });
});
