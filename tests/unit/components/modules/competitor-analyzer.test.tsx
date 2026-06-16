// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  analyzeCompetitor,
  type CompetitorAnalysis,
} from "@/lib/actions/competitor";
import { CompetitorAnalyzer } from "@/components/modules/competitor-analyzer";

/**
 * Mocks for `createBrowserClient`. Mirrors the pattern from
 * `tests/unit/components/modules/calendar-generator.test.tsx` - we
 * own the entire query chain so each test can swap the resolved
 * dataset.
 */
vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(),
}));

/**
 * Stub the server action. The real implementation calls Supabase + AI,
 * which we don't want during a component test. We assert against the
 * arguments the action was called with, not its real output.
 */
vi.mock("@/lib/actions/competitor", () => ({
  analyzeCompetitor: vi.fn(),
}));

/**
 * `sonner` renders to a portal that isn't mounted in this test tree.
 * The calls are no-ops in practice but show up as `console.warn` noise;
 * stub the whole module so the test output stays clean.
 */
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

/**
 * happy-dom doesn't ship a clipboard implementation. Patch the navigator
 * with a writeText spy so the copy-button test can assert the call.
 */
const mockWriteText = vi.fn().mockResolvedValue(undefined);

const SAMPLE_PRODUCTS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Sample Product A",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Sample Product B",
  },
];

/**
 * Sample analysis payload. Mirrors `CompetitorAnalysis` from
 * `lib/actions/competitor.ts` - all 6 sections (header, strengths,
 * weaknesses, content gaps, recommendations, overall assessment)
 * populated with realistic Indonesian copy.
 */
const SAMPLE_ANALYSIS: CompetitorAnalysis = {
  competitorName: "Competitor Skincare Lokal Premium",
  priceRange: "Rp 180.000 - Rp 250.000",
  rating: "4.7/5",
  strengths: [
    "Packaging premium dengan warna gold yang eye-catching di thumbnail marketplace",
    "Rating tinggi 4.7 dari 2.000+ review, social proof kuat untuk konversi",
    "Free ongkir ke seluruh Indonesia, menurunkan friction di checkout",
  ],
  weaknesses: [
    "Harga 30% lebih mahal dari alternatif lokal lain di kelas yang sama",
    "Deskripsi produk sangat minim, tidak ada edukasi bahan aktif",
    "Foto produk hanya studio shot, tidak ada foto model atau before/after",
  ],
  contentGaps: [
    "Belum ada konten video perbandingan dengan produk kompetitor lain",
    "Tidak ada tutorial cara pakai yang step-by-step untuk pemula",
    "Belum ada konten UGC review jujur dari real customer (hanya foto studio)",
  ],
  recommendations: [
    "Buat carousel Instagram perbandingan produk ini vs produk Anda (3-5 slide)",
    "Rekam video TikTok 30 detik review jujur setelah 7 hari pakai",
    "Tulis blog post '5 Alasan Produk Ini Layak Dicoba' dengan angle hemat budget",
  ],
  overallAssessment:
    "Kompetitor bermain di positioning premium dengan social proof kuat sebagai diferensiasi utama. Kelemahan terbesarnya ada di edukasi produk dan konten UGC - ini celah yang bisa Anda eksploitasi dengan konten edukatif + review autentik. Rekomendasi: fokuskan strategi konten Anda di edukasi bahan aktif dan demo before/after untuk membedakan diri dari positioning premium mereka.",
};

describe("CompetitorAnalyzer", () => {
  let order: ReturnType<typeof vi.fn>;
  let select: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockClear();

    // happy-dom doesn't expose navigator.clipboard, so attach a fresh
    // mock before each test.
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mockWriteText },
    });

    // Default: return 2 products. Individual tests override `order`
    // when they want the empty-products state.
    order = vi.fn().mockResolvedValue({ data: SAMPLE_PRODUCTS, error: null });
    select = vi.fn(() => ({ order }));
    from = vi.fn(() => ({ select }));
    vi.mocked(createBrowserClient).mockReturnValue(
      { from } as unknown as ReturnType<typeof createBrowserClient>,
    );

    // Default action response: success with no data. Individual tests
    // override per scenario.
    vi.mocked(analyzeCompetitor).mockResolvedValue({ data: SAMPLE_ANALYSIS });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  // ---- 1. Form renders ----
  it("renders the form with product select, URL input, platform select, and Analyze button", async () => {
    render(<CompetitorAnalyzer />);

    // Wait for products to load - this is also how we know the form
    // is mounted.
    await screen.findByText("Sample Product A");

    // Product select should be populated
    const productSelect = screen.getByTestId(
      "competitor-product",
    ) as HTMLSelectElement;
    expect(productSelect).toBeInTheDocument();
    // First product should be auto-selected (the component picks the
    // first product on mount when the user has at least one).
    expect(productSelect.value).toBe(SAMPLE_PRODUCTS[0]!.id);

    // URL input is present
    const urlInput = screen.getByTestId("competitor-url");
    expect(urlInput).toBeInTheDocument();

    // Platform select is present with shopee as default
    const platformSelect = screen.getByTestId(
      "competitor-platform",
    ) as HTMLSelectElement;
    expect(platformSelect).toBeInTheDocument();
    expect(platformSelect.value).toBe("shopee");

    // Analyze button is present
    const analyzeButton = screen.getByTestId("competitor-analyze");
    expect(analyzeButton).toBeInTheDocument();
    expect(analyzeButton).toHaveTextContent(/Analyze/);
  });

  // ---- 2. Loading state ----
  it("shows loading state with 'Menganalisis kompetitor...' text while analyzeCompetitor is in flight", async () => {
    // Never-resolving action keeps the component in the loading state
    // long enough for us to assert on the spinner copy.
    vi.mocked(analyzeCompetitor).mockImplementation(
      () => new Promise<{ data?: CompetitorAnalysis; error?: string }>(
        () => {},
      ),
    );

    render(<CompetitorAnalyzer />);
    await screen.findByText("Sample Product A");

    // Fill in the URL so the form passes client-side validation
    // (product is auto-selected to the first one).
    fireEvent.change(screen.getByTestId("competitor-url"), {
      target: { value: "https://shopee.co.id/sample-product" },
    });

    // Submit
    fireEvent.click(screen.getByTestId("competitor-analyze"));

    // Loading state should appear in the result panel
    await waitFor(() => {
      expect(screen.getByTestId("competitor-loading")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Menganalisis kompetitor/i),
    ).toBeInTheDocument();
  });

  // ---- 3. Results state - all 6 sections render ----
  it("renders the full analysis report (header, strengths, weaknesses, content gaps, recommendations, overall assessment) on success", async () => {
    render(<CompetitorAnalyzer />);
    await screen.findByText("Sample Product A");

    // Fill in the URL and submit
    fireEvent.change(screen.getByTestId("competitor-url"), {
      target: { value: "https://shopee.co.id/sample-product" },
    });
    fireEvent.click(screen.getByTestId("competitor-analyze"));

    // Wait for the report
    await waitFor(() => {
      expect(screen.getByTestId("competitor-report")).toBeInTheDocument();
    });

    // 1. Header - competitor name + price + rating
    expect(screen.getByTestId("competitor-header")).toBeInTheDocument();
    const nameEl = screen.getByTestId("competitor-name");
    expect(nameEl).toHaveTextContent("Competitor Skincare Lokal Premium");
    expect(screen.getByTestId("competitor-price")).toHaveTextContent(
      "Rp 180.000 - Rp 250.000",
    );
    expect(screen.getByTestId("competitor-rating")).toHaveTextContent("4.7/5");

    // 2. Strengths (green)
    expect(screen.getByTestId("competitor-strengths")).toBeInTheDocument();
    expect(
      screen.getByTestId("competitor-strengths-item-0"),
    ).toHaveTextContent(/Packaging premium/);

    // 3. Weaknesses (red)
    expect(screen.getByTestId("competitor-weaknesses")).toBeInTheDocument();
    expect(
      screen.getByTestId("competitor-weaknesses-item-0"),
    ).toHaveTextContent(/Harga 30% lebih mahal/);

    // 4. Content Gaps (amber)
    expect(
      screen.getByTestId("competitor-content-gaps"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("competitor-content-gaps-item-0"),
    ).toHaveTextContent(/video perbandingan/);

    // 5. Recommendations (indigo)
    expect(
      screen.getByTestId("competitor-recommendations"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("competitor-recommendations-item-0"),
    ).toHaveTextContent(/carousel Instagram/);

    // 6. Overall assessment
    expect(screen.getByTestId("competitor-overall")).toBeInTheDocument();
    expect(
      screen.getByTestId("competitor-overall-text"),
    ).toHaveTextContent(/Kompetitor bermain di positioning premium/);
  });

  // ---- 4. Error state ----
  it("shows error message + retry button in the result panel when analyzeCompetitor returns an error", async () => {
    vi.mocked(analyzeCompetitor).mockResolvedValue({
      error: "URL kompetitor tidak bisa diakses. Coba lagi.",
    });

    render(<CompetitorAnalyzer />);
    await screen.findByText("Sample Product A");

    // Fill in URL and submit
    fireEvent.change(screen.getByTestId("competitor-url"), {
      target: { value: "https://shopee.co.id/broken-link" },
    });
    fireEvent.click(screen.getByTestId("competitor-analyze"));

    // Error block should appear
    await waitFor(() => {
      expect(screen.getByTestId("competitor-error")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/URL kompetitor tidak bisa diakses/),
    ).toBeInTheDocument();

    // Retry button is present
    const retryButton = screen.getByTestId("competitor-retry");
    expect(retryButton).toBeInTheDocument();
    expect(retryButton).toHaveTextContent(/Coba Lagi/);
  });

  // ---- 5. Empty products link ----
  it("shows 'Belum ada produk' link to /produk when no products returned from Supabase", async () => {
    order.mockResolvedValue({ data: [], error: null });

    render(<CompetitorAnalyzer />);

    await waitFor(() => {
      expect(
        screen.getByTestId("competitor-empty-products"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/Belum ada produk/i)).toBeInTheDocument();

    // The CTA is a link to /produk so the user can create their first
    // product without leaving the dashboard.
    const link = screen.getByRole("link", { name: /buat produk/i });
    expect(link).toHaveAttribute("href", "/produk");
  });

  // ---- 6. URL validation (shows error for invalid URL) ----
  it("shows inline URL error when the user types an invalid URL and blocks submission", async () => {
    render(<CompetitorAnalyzer />);
    await screen.findByText("Sample Product A");

    // Type a clearly invalid URL (no http/https/www prefix and too short)
    const urlInput = screen.getByTestId("competitor-url");
    fireEvent.change(urlInput, {
      target: { value: "not-a-url" },
    });

    // Inline error should appear below the input
    await waitFor(() => {
      expect(
        screen.getByTestId("competitor-url-error"),
      ).toBeInTheDocument();
    });
    expect(screen.getByTestId("competitor-url-error")).toHaveTextContent(
      /Format URL tidak valid/i,
    );

    // The aria-invalid flag is set on the input for assistive tech
    expect(urlInput).toHaveAttribute("aria-invalid", "true");

    // Try to submit - the server action is never invoked because
    // client-side validation blocks the call.
    fireEvent.click(screen.getByTestId("competitor-analyze"));

    await waitFor(() => {
      expect(analyzeCompetitor).not.toHaveBeenCalled();
    });
  });

  // ---- 7. Copy button ----
  it("copies the full analysis to clipboard as a structured text block when the copy button is clicked", async () => {
    render(<CompetitorAnalyzer />);
    await screen.findByText("Sample Product A");

    // Submit to get a result
    fireEvent.change(screen.getByTestId("competitor-url"), {
      target: { value: "https://shopee.co.id/sample-product" },
    });
    fireEvent.click(screen.getByTestId("competitor-analyze"));

    // Wait for the report
    await waitFor(() => {
      expect(screen.getByTestId("competitor-report")).toBeInTheDocument();
    });

    // Click copy
    const copyButton = screen.getByTestId("competitor-copy");
    fireEvent.click(copyButton);

    // Verify the clipboard was written with the structured report
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalled();
    });

    const written = mockWriteText.mock.calls[0]?.[0] as string;
    // Header fields
    expect(written).toMatch(/Kompetitor:/);
    expect(written).toMatch(/Harga:/);
    expect(written).toMatch(/Rating:/);
    // Section labels
    expect(written).toMatch(/KEKUATAN:/);
    expect(written).toMatch(/KELEMAHAN:/);
    expect(written).toMatch(/CONTENT GAPS:/);
    expect(written).toMatch(/REKOMENDASI:/);
    expect(written).toMatch(/RINGKASAN:/);
    // Sample data
    expect(written).toMatch(/Packaging premium/);
    expect(written).toMatch(/Kompetitor bermain di positioning premium/);
  });
});
