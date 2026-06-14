import { describe, it, expect } from "vitest";
import { signInSchema } from "@/lib/validation/auth";

describe("signInSchema", () => {
  it("validates a valid email", () => {
    const result = signInSchema.safeParse({ email: "test@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email format", () => {
    const result = signInSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = signInSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects email over 255 chars", () => {
    // Build a 256+ char email that is otherwise syntactically valid-looking
    // if the .max() check were absent.
    const localPart = "a".repeat(250);
    const longEmail = `${localPart}@example.com`; // 262 chars total
    const result = signInSchema.safeParse({ email: longEmail });
    expect(result.success).toBe(false);
  });
});
