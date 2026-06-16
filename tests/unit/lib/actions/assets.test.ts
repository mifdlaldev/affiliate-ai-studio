import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  FetchAssetsOptions,
  FetchCompetitorAnalysesOptions,
  Asset,
} from "@/lib/actions/assets";

// Module-level mock fns. The vi.mock factory bodies reference these; the
// factory is only invoked on the first import of the mocked module, by
// which point the bindings have already been initialised.
const mockGetUser = vi.fn();
const mockGenerationsResult = vi.fn();
const mockCompetitorAnalysesResult = vi.fn();

// Track which query method calls happened on the generations chain so
// tests can assert the right filters were applied.
const generationsCalls = {
  selectArgs: [] as unknown[],
  eqArgs: [] as Array<[string, unknown]>,
  orArgs: [] as string[],
  orderArgs: [] as Array<[string, { ascending?: boolean }]>,
  rangeArgs: [] as Array<[number, number]>,
};

const competitorCalls = {
  selectArgs: [] as unknown[],
  eqArgs: [] as Array<[string, unknown]>,
  orderArgs: [] as Array<[string, { ascending?: boolean }]>,
  rangeArgs: [] as Array<[number, number]>,
};

/**
 * Build a chainable PostgREST query mock. Every chained method returns
 * the same chain (so .select().eq().order() works), and the chain is
 * also a thenable that resolves with the supplied `{ data, count, error }`
 * payload — matching the real Supabase JS client behaviour.
 */
function makeChain(
  calls:
    | typeof generationsCalls
    | typeof competitorCalls,
  resolve: () => Promise<{ data: unknown; count: number; error: unknown }>,
) {
  const chain: Record<string, unknown> = {
    select: (cols: unknown, opts?: unknown) => {
      calls.selectArgs.push(opts ?? cols);
      return chain;
    },
    eq: (col: string, val: unknown) => {
      calls.eqArgs.push([col, val]);
      return chain;
    },
    or: (filter: string) => {
      (calls as typeof generationsCalls).orArgs?.push(filter);
      return chain;
    },
    order: (col: string, opts?: { ascending?: boolean }) => {
      calls.orderArgs.push([col, opts ?? {}]);
      return chain;
    },
    range: (from: number, to: number) => {
      calls.rangeArgs.push([from, to]);
      // The real client returns the chain from .range() too, but
      // tests typically await the final value — we expose `then`
      // so `await chain` resolves with the mocked payload.
      return chain;
    },
  };
  // Make the chain a thenable so `await supabaseQuery` resolves.
  chain.then = (
    onFulfilled?: (v: { data: unknown; count: number; error: unknown }) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => resolve().then(onFulfilled, onRejected);
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: (table: string) => {
      if (table === "generations") {
        return makeChain(generationsCalls, mockGenerationsResult);
      }
      if (table === "competitor_analyses") {
        return makeChain(competitorCalls, mockCompetitorAnalysesResult);
      }
      return {};
    },
  }),
}));

// ---- Test fixtures ---------------------------------------------------------

const MOCK_USER = { id: "user-123", email: "test@example.com" } as const;

const MOCK_GENERATION_ROWS = [
  {
    id: "gen-1",
    module: "photo_prompt",
    subtype: "instagram",
    input_prompt: "skincare glowing face",
    result: { text: "halo semua" },
    created_at: "2026-06-14T10:00:00.000Z",
  },
  {
    id: "gen-2",
    module: "caption",
    subtype: "tiktok",
    input_prompt: "fashion outfit ideas",
    result: { text: "another caption body" },
    created_at: "2026-06-13T10:00:00.000Z",
  },
  {
    id: "gen-3",
    module: "competitor",
    subtype: null,
    input_prompt: "competitor research prompt",
    result: { text: "third row body that is intentionally long enough to test the 100-char truncation behaviour of previewText" },
    created_at: "2026-06-12T10:00:00.000Z",
  },
];

const MOCK_COMPETITOR_ROWS = [
  {
    id: "comp-1",
    analysis_result: { summary: "Great hooks", score: 92 },
    tiktok_url: "https://tiktok.com/@rival",
    created_at: "2026-06-14T11:00:00.000Z",
  },
  {
    id: "comp-2",
    analysis_result: { summary: "Solid product page" },
    shopee_url: "https://shopee.co.id/rival",
    created_at: "2026-06-13T11:00:00.000Z",
  },
];

const resetMocks = () => {
  mockGetUser.mockReset();
  mockGenerationsResult.mockReset();
  mockCompetitorAnalysesResult.mockReset();
  generationsCalls.selectArgs.length = 0;
  generationsCalls.eqArgs.length = 0;
  generationsCalls.orArgs.length = 0;
  generationsCalls.orderArgs.length = 0;
  generationsCalls.rangeArgs.length = 0;
  competitorCalls.selectArgs.length = 0;
  competitorCalls.eqArgs.length = 0;
  competitorCalls.orderArgs.length = 0;
  competitorCalls.rangeArgs.length = 0;
};

// ---- Tests -----------------------------------------------------------------

describe("fetchAssets", () => {
  beforeEach(() => {
    resetMocks();
    // Default: signed in, returns all 3 rows
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    mockGenerationsResult.mockResolvedValue({
      data: MOCK_GENERATION_ROWS,
      count: MOCK_GENERATION_ROWS.length,
      error: null,
    });
  });

  // 1. Fetch all — no filters, default pagination
  it("returns all generations for the signed-in user", async () => {
    const { fetchAssets } = await import("@/lib/actions/assets");
    const result = await fetchAssets({} as FetchAssetsOptions);

    expect(result.total).toBe(3);
    expect(result.page).toBe(1);
    expect(result.data).toHaveLength(3);
    // User filter must be applied
    const userEq = generationsCalls.eqArgs.find(([col]) => col === "user_id");
    expect(userEq).toEqual(["user_id", "user-123"]);
    // No module filter (no module passed)
    const moduleEq = generationsCalls.eqArgs.find(([col]) => col === "module");
    expect(moduleEq).toBeUndefined();
    // Order by created_at DESC
    expect(generationsCalls.orderArgs[0]).toEqual([
      "created_at",
      { ascending: false },
    ]);
    // Asset shape — first row
    const first = result.data[0]!;
    expect(first.id).toBe("gen-1");
    expect(first.module).toBe("photo_prompt");
    expect(first.subtype).toBe("instagram");
    expect(first.result).toEqual({ text: "halo semua" });
    expect(first.createdAt).toBe("2026-06-14T10:00:00.000Z");
    expect(typeof first.previewText).toBe("string");
    expect(first.previewText.length).toBeLessThanOrEqual(100);
  });

  // 2. Filter by module
  it("applies a module filter when module is provided and not 'all'", async () => {
    const { fetchAssets } = await import("@/lib/actions/assets");
    await fetchAssets({ module: "caption" } as FetchAssetsOptions);

    const moduleEq = generationsCalls.eqArgs.find(([col]) => col === "module");
    expect(moduleEq).toEqual(["module", "caption"]);
  });

  // 3. Search by text — must use OR filter on input_prompt OR result::text
  it("applies a search filter using input_prompt ilike OR result::text ilike", async () => {
    const { fetchAssets } = await import("@/lib/actions/assets");
    await fetchAssets({ search: "skincare" } as FetchAssetsOptions);

    expect(generationsCalls.orArgs).toHaveLength(1);
    const filter = generationsCalls.orArgs[0]!;
    expect(filter).toMatch(/input_prompt\.ilike\./);
    expect(filter).toMatch(/result::text\.ilike\./);
    expect(filter).toContain("skincare");
  });

  // 4. Pagination — page=2, limit=1 → range(1, 1)
  it("paginates using range() with correct from/to for page and limit", async () => {
    const { fetchAssets } = await import("@/lib/actions/assets");
    await fetchAssets({ page: 2, limit: 1 } as FetchAssetsOptions);

    expect(generationsCalls.rangeArgs).toEqual([[1, 1]]);
    // page should be echoed back
    mockGenerationsResult.mockResolvedValue({
      data: [MOCK_GENERATION_ROWS[1]],
      count: 3,
      error: null,
    });
    const result = await fetchAssets({ page: 2, limit: 1 } as FetchAssetsOptions);
    expect(result.page).toBe(2);
  });

  // 6. Empty results
  it("returns an empty list when the user has no generations", async () => {
    mockGenerationsResult.mockResolvedValue({
      data: [],
      count: 0,
      error: null,
    });
    const { fetchAssets } = await import("@/lib/actions/assets");
    const result = await fetchAssets({} as FetchAssetsOptions);

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
  });

  // 7. Not signed in
  it("returns empty data when the user is not signed in", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const { fetchAssets } = await import("@/lib/actions/assets");
    const result = await fetchAssets({} as FetchAssetsOptions);

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    // Should not hit the DB at all
    expect(generationsCalls.selectArgs).toHaveLength(0);
  });
});

describe("fetchCompetitorAnalyses", () => {
  beforeEach(() => {
    resetMocks();
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    mockCompetitorAnalysesResult.mockResolvedValue({
      data: MOCK_COMPETITOR_ROWS,
      count: MOCK_COMPETITOR_ROWS.length,
      error: null,
    });
  });

  // 5. Competitor analyses
  it("fetches competitor analyses mapped to the Asset shape", async () => {
    const { fetchCompetitorAnalyses } =
      await import("@/lib/actions/assets");
    const result = await fetchCompetitorAnalyses(
      {} as FetchCompetitorAnalysesOptions,
    );

    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
    // Mapped to Asset shape
    const first = result.data[0]!;
    expect(first.id).toBe("comp-1");
    expect(first.module).toBe("competitor");
    expect(first.result).toEqual({ summary: "Great hooks", score: 92 });
    expect(first.createdAt).toBe("2026-06-14T11:00:00.000Z");
    expect(typeof first.previewText).toBe("string");
    expect(first.previewText.length).toBeLessThanOrEqual(100);
    // User filter applied
    const userEq = competitorCalls.eqArgs.find(([col]) => col === "user_id");
    expect(userEq).toEqual(["user_id", "user-123"]);
  });

  // 8. Error handling
  it("returns empty data when the DB query throws", async () => {
    mockGenerationsResult.mockRejectedValue(new Error("DB unreachable"));
    const { fetchAssets } = await import("@/lib/actions/assets");
    const result = await fetchAssets({} as FetchAssetsOptions);

    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
  });
});

// ---- Type compile-check (catches missing exports) --------------------------

// If these types don't exist on the module, the test file fails to compile,
// which is itself a failing test. No runtime assertion needed.
const _typeCheck: {
  assets: Asset;
  fetchOpts: FetchAssetsOptions;
  fetchCompOpts: FetchCompetitorAnalysesOptions;
} | null = null;
void _typeCheck;
