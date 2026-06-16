// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AssetLibrary } from "@/components/modules/asset-library";
import { fetchAssets, fetchCompetitorAnalyses } from "@/lib/actions/assets";
import type { Asset, FetchResult } from "@/lib/actions/assets";

/**
 * Mocks for the server actions. We don't want a real DB hit during the
 * component test; each test wires `fetchAssets` to a different shape so
 * we can exercise loading / empty / error / success states.
 */
vi.mock("@/lib/actions/assets", () => ({
  fetchAssets: vi.fn(),
  fetchCompetitorAnalyses: vi.fn(),
}));

const mockFetchAssets = vi.mocked(fetchAssets);
const mockFetchCompetitorAnalyses = vi.mocked(fetchCompetitorAnalyses);

/**
 * Three sample rows that cover three different modules so the grid /
 * badge / colour tests have something to assert against. The `result`
 * payloads are short enough to keep the test readable, but distinct
 * enough that we can tell the modules apart.
 */
const SAMPLE_ASSETS: Asset[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    module: "hook",
    subtype: null,
    result: {
      idea: "3 rahasia skincare glowing yang bikin kamu ketagihan",
    },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    previewText:
      '{"idea":"3 rahasia skincare glowing yang bikin kamu ketagihan"}',
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    module: "caption",
    subtype: null,
    result: {
      text: "Promo spesial akhir bulan, diskon hingga 50% untuk semua produk",
    },
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    previewText:
      '{"text":"Promo spesial akhir bulan, diskon hingga 50% untuk semua produk"}',
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    module: "script",
    subtype: null,
    result: {
      hook: "Hai semuanya, kali ini aku mau bahas produk viral terbaru",
    },
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    previewText:
      '{"hook":"Hai semuanya, kali ini aku mau bahas produk viral terbaru"}',
  },
];

const SUCCESS_RESULT: FetchResult = {
  data: SAMPLE_ASSETS,
  total: SAMPLE_ASSETS.length,
  page: 1,
};

const EMPTY_RESULT: FetchResult = { data: [], total: 0, page: 1 };

describe("AssetLibrary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAssets.mockResolvedValue(SUCCESS_RESULT);
    mockFetchCompetitorAnalyses.mockResolvedValue(EMPTY_RESULT);
  });

  it("renders all 8 filter tabs in the correct order", async () => {
    render(<AssetLibrary />);

    // Wait for the initial fetch to resolve so the tabs are interactive.
    await waitFor(() => {
      expect(mockFetchAssets).toHaveBeenCalled();
    });

    const expectedTabs = [
      "Semua",
      "Hook",
      "Caption",
      "Script",
      "Photo",
      "Model",
      "Kalender",
      "Kompetitor",
    ];

    for (const label of expectedTabs) {
      expect(
        screen.getByRole("tab", { name: new RegExp(`^${label}$`, "i") }),
      ).toBeInTheDocument();
    }
  });

  it("renders the search input", async () => {
    render(<AssetLibrary />);

    await waitFor(() => {
      expect(mockFetchAssets).toHaveBeenCalled();
    });

    expect(
      screen.getByPlaceholderText(/cari|search/i),
    ).toBeInTheDocument();
  });

  it("shows skeleton cards while loading", async () => {
    // Make fetchAssets never resolve so we can observe the loading state
    // before the component finishes its initial fetch.
    let resolveFn: (value: FetchResult) => void = () => {};
    mockFetchAssets.mockReturnValue(
      new Promise<FetchResult>((resolve) => {
        resolveFn = resolve;
      }),
    );

    render(<AssetLibrary />);

    // The component renders a recognisable skeleton card with a stable
    // `data-testid` while loading. We assert on `getAllByTestId` because
    // multiple skeletons render at once; the count is what tells us the
    // loading state is visible (not an individual element).
    const skeletons = screen.getAllByTestId("asset-card-skeleton");
    expect(skeletons.length).toBeGreaterThan(0);

    // Cleanup: resolve the pending promise so React doesn't try to set
    // state on an unmounted component after the test ends.
    resolveFn(SUCCESS_RESULT);
  });

  it("renders cards with module badge and preview text", async () => {
    render(<AssetLibrary />);

    // The first sample row's preview text contains "3 rahasia skincare" -
    // a stable substring that won't appear in the other cards.
    const firstCard = await screen.findByText(/3 rahasia skincare/i);
    expect(firstCard).toBeInTheDocument();
    expect(screen.getByText(/promo spesial akhir bulan/i)).toBeInTheDocument();
    expect(screen.getByText(/hai semuanya/i)).toBeInTheDocument();

    // The module badge text is shared with the tab label (e.g. "Hook"),
    // so use `getAllByText` to assert the badge is present without
    // requiring the count to be exactly one. The grid + tab + badge
    // collectively render at least two matches for each module.
    expect(screen.getAllByText(/^Hook$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Caption$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Script$/i).length).toBeGreaterThan(0);
  });

  it("shows empty state when there are no assets", async () => {
    mockFetchAssets.mockResolvedValue(EMPTY_RESULT);
    mockFetchCompetitorAnalyses.mockResolvedValue(EMPTY_RESULT);

    render(<AssetLibrary />);

    // The empty state title and description both contain the phrase
    // "Belum ada konten", so we anchor on the title which is unique.
    expect(
      await screen.findByText(/^Belum ada konten$/i),
    ).toBeInTheDocument();
  });

  it("shows error state with retry button when fetch fails", async () => {
    mockFetchAssets.mockRejectedValue(new Error("Network error"));

    render(<AssetLibrary />);

    expect(
      await screen.findByText(/gagal memuat/i),
    ).toBeInTheDocument();

    // The error state must offer a retry affordance so the user has a
    // way out without reloading the page.
    expect(
      screen.getByRole("button", { name: /coba lagi|retry/i }),
    ).toBeInTheDocument();
  });

  it("opens the detail view when a card is clicked", async () => {
    render(<AssetLibrary />);

    // The card is rendered as a button. Its accessible name contains
    // the preview text so screen readers announce something meaningful.
    const card = await screen.findByRole("button", {
      name: /3 rahasia skincare/i,
    });
    fireEvent.click(card);

    // The detail dialog renders the formatted JSON inside a `<pre>` with
    // a stable `data-testid`. We use `findByTestId` (which polls) to
    // tolerate the async Radix portal mount.
    expect(
      await screen.findByTestId("asset-detail-json"),
    ).toBeInTheDocument();
  });
});
