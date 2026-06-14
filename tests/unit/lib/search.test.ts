import { describe, it, expect, vi, beforeEach } from "vitest";
import { globalSearch } from "@/lib/search";

type FromResult = {
  select: ReturnType<typeof vi.fn>;
  or?: ReturnType<typeof vi.fn>;
  ilike?: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
};

function makeBuilder(data: unknown[] | null = []): FromResult {
  const limit = vi.fn().mockResolvedValue({ data, error: null });
  return {
    select: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    limit,
  };
}

function makeSupabase(builders: Record<"products" | "projects" | "assets", FromResult>) {
  return {
    from: vi.fn((table: "products" | "projects" | "assets") => builders[table]),
  } as unknown as Parameters<typeof globalSearch>[0];
}

describe("globalSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty results for an empty query", async () => {
    const supabase = makeSupabase({
      products: makeBuilder(),
      projects: makeBuilder(),
      assets: makeBuilder(),
    });

    const result = await globalSearch(supabase, "");

    expect(result).toEqual({ products: [], projects: [], assets: [] });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns empty results for a whitespace-only query", async () => {
    const supabase = makeSupabase({
      products: makeBuilder(),
      projects: makeBuilder(),
      assets: makeBuilder(),
    });

    const result = await globalSearch(supabase, "   ");

    expect(result).toEqual({ products: [], projects: [], assets: [] });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("queries all three tables in parallel", async () => {
    const supabase = makeSupabase({
      products: makeBuilder([{ id: "p1", name: "Shampoo A" }]),
      projects: makeBuilder([{ id: "pr1", name: "Campaign A" }]),
      assets: makeBuilder([{ id: "a1", name: "Hook Script" }]),
    });

    const result = await globalSearch(supabase, "shampoo");

    expect(supabase.from).toHaveBeenCalledWith("products");
    expect(supabase.from).toHaveBeenCalledWith("projects");
    expect(supabase.from).toHaveBeenCalledWith("assets");
    expect(supabase.from).toHaveBeenCalledTimes(3);
    expect(result.products).toEqual([{ id: "p1", name: "Shampoo A" }]);
    expect(result.projects).toEqual([{ id: "pr1", name: "Campaign A" }]);
    expect(result.assets).toEqual([{ id: "a1", name: "Hook Script" }]);
  });

  it("uses case-insensitive ilike with the trimmed query", async () => {
    const products = makeBuilder();
    const projects = makeBuilder();
    const assets = makeBuilder();
    const supabase = makeSupabase({ products, projects, assets });

    await globalSearch(supabase, "  shampoo  ");

    expect(products.or).toHaveBeenCalledWith(
      "name.ilike.%shampoo%,category.ilike.%shampoo%,brand.ilike.%shampoo%",
    );
    expect(projects.ilike).toHaveBeenCalledWith("name", "%shampoo%");
    expect(assets.or).toHaveBeenCalledWith(
      "name.ilike.%shampoo%,content.ilike.%shampoo%",
    );
  });

  it("caps each table at 5 results", async () => {
    const products = makeBuilder();
    const projects = makeBuilder();
    const assets = makeBuilder();
    const supabase = makeSupabase({ products, projects, assets });

    await globalSearch(supabase, "x");

    expect(products.limit).toHaveBeenCalledWith(5);
    expect(projects.limit).toHaveBeenCalledWith(5);
    expect(assets.limit).toHaveBeenCalledWith(5);
  });

  it("returns empty arrays when Supabase returns null data", async () => {
    const supabase = makeSupabase({
      products: makeBuilder(null),
      projects: makeBuilder(null),
      assets: makeBuilder(null),
    });

    const result = await globalSearch(supabase, "x");

    expect(result).toEqual({ products: [], projects: [], assets: [] });
  });
});
