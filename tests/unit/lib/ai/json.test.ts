import { describe, it, expect } from "vitest";
import { extractJson } from "@/lib/ai/json";

describe("extractJson", () => {
  it("parses plain JSON", () => {
    expect(extractJson('{"name":"X","category":"Y"}')).toEqual({
      name: "X",
      category: "Y",
    });
  });

  it("parses plain JSON with surrounding whitespace", () => {
    expect(extractJson('   \n  {"name":"X"}  \n')).toEqual({ name: "X" });
  });

  it("strips ```json code-block fence and parses the body", () => {
    // Shape that Xiaomi MiMo-V2.5 actually emits with reasoning_effort: "high"
    const wrapped = '```json\n{"name":"Sharp Aquos","category":"Television"}\n```';
    expect(extractJson(wrapped)).toEqual({
      name: "Sharp Aquos",
      category: "Television",
    });
  });

  it("strips ``` fence (no language tag) and parses the body", () => {
    const wrapped = '```\n{"name":"X"}\n```';
    expect(extractJson(wrapped)).toEqual({ name: "X" });
  });

  it("parses JSON embedded in prose as a last-resort fallback", () => {
    const prose = 'The answer is clearly {"name":"X","category":"Y"} as shown.';
    expect(extractJson(prose)).toEqual({ name: "X", category: "Y" });
  });

  it("parses JSON arrays", () => {
    expect(extractJson("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("preserves generic typing on the return value", () => {
    interface Product {
      name: string;
      category: string;
    }
    const result = extractJson<Product>('{"name":"X","category":"Y"}');
    // TypeScript only — runtime is a plain object cast.
    const typed: Product = result;
    expect(typed.name).toBe("X");
  });

  it("throws a SyntaxError when no JSON can be found", () => {
    expect(() => extractJson("just plain text, no JSON here at all")).toThrow(
      SyntaxError,
    );
  });

  it("throws when the markdown fence body itself is not valid JSON", () => {
    // The fence is stripped, the inner content is the only thing parsed —
    // if it's not JSON, the function surfaces that as a SyntaxError rather
    // than silently returning the wrong thing.
    expect(() => extractJson("```json\nnot-valid-json\n```")).toThrow();
  });
});
