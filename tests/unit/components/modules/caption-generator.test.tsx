// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateCaptions,
  type GenerateCaptionsResult,
} from "@/lib/actions/captions";
import { CaptionGenerator } from "@/components/modules/caption-generator";

/**
 * Mocks for `createBrowserClient`. Mirrors the pattern from
 * `tests/unit/components/modules/hook-generator.test.tsx` — we own
 * the entire query chain so each test can swap the resolved dataset.
 */
vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(),
}));

/**
 * Stub the server action. The real implementation calls Supabase + AI,
 * which we don't want during a component test. We assert against the
 * arguments the action was called with, not its real output.
 */
vi.mock("@/lib/actions/captions", () => ({
  generateCaptions: vi.fn(),
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

describe("CaptionGenerator", () => {
  let order: ReturnType<typeof vi.fn>;
  let select: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockClear();

    // happy-dom doesn't expose navigator.clipboard, so attach a fresh
    // mock before each test. The assertion `toHaveBeenCalledWith(...)`
    // on the next line wouldn't see a previous test's write calls.
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
    vi.mocked(generateCaptions).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    // Reset the clipboard override so the next beforeEach starts clean.
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  it("renders the form with product selector, platform dropdown, tone dropdown, audience input, CTA select, and generate button", async () => {
    render(<CaptionGenerator />);

    // Wait for products to load — this is also how we know the form is
    // mounted (the select renders only after the fetch resolves).
    await screen.findByText("Sample Product A");

    expect(screen.getByLabelText(/^Produk$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Platform$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Tone$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target audience/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cta|call to action/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate/i }),
    ).toBeInTheDocument();
  });

  it("shows empty state in the result panel when no results yet", async () => {
    render(<CaptionGenerator />);

    await screen.findByText("Sample Product A");

    expect(
      screen.getByText(/Pilih produk dan klik Generate/i),
    ).toBeInTheDocument();
  });

  it("shows 'Belum ada produk' link when no products returned from Supabase", async () => {
    order.mockResolvedValue({ data: [], error: null });

    render(<CaptionGenerator />);

    await waitFor(() => {
      expect(screen.getByText(/Belum ada produk/i)).toBeInTheDocument();
    });

    // The CTA is a link to /produk so the user can create their first
    // product without leaving the dashboard.
    const link = screen.getByRole("link", { name: /buat produk/i });
    expect(link).toHaveAttribute("href", "/produk");
  });

  it("shows loading state in the result panel while generateCaptions is in flight", async () => {
    // Never-resolving action keeps the component in the loading state
    // long enough for us to assert on the spinner copy.
    vi.mocked(generateCaptions).mockImplementation(
      () => new Promise<GenerateCaptionsResult>(() => {}),
    );

    render(<CaptionGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(await screen.findByTestId("caption-loading")).toBeInTheDocument();
    expect(
      screen.getByText(/Menghasilkan caption.../i),
    ).toBeInTheDocument();
  });

  it("renders caption text, hashtags, and tips when generateCaptions returns results", async () => {
    vi.mocked(generateCaptions).mockResolvedValue({
      data: [
        {
          text: "Caption pertama yang menarik untuk audiens Indonesia.",
          hashtags: ["#affiliate", "#produkkeren", "#rekomendasitiktok"],
          tips: "Posting di jam 7-9 pagi untuk engagement terbaik.",
        },
        {
          text: "Caption kedua storytelling dengan hasil optimal.",
          hashtags: ["#reviewjujur", "#belanjabagus"],
          tips: "Tambahkan foto produk di paragraf pertama.",
        },
      ],
    });

    render(<CaptionGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/Caption pertama yang menarik/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Caption kedua storytelling/i),
    ).toBeInTheDocument();

    // Hashtags are rendered as pills — each one must appear as its own
    // token, not concatenated into a single string.
    expect(screen.getByText("#affiliate")).toBeInTheDocument();
    expect(screen.getByText("#produkkeren")).toBeInTheDocument();
    expect(screen.getByText("#rekomendasitiktok")).toBeInTheDocument();
    expect(screen.getByText("#reviewjujur")).toBeInTheDocument();
    expect(screen.getByText("#belanjabagus")).toBeInTheDocument();

    // Platform-specific tips display below each caption.
    expect(
      screen.getByText(/Posting di jam 7-9 pagi/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Tambahkan foto produk di paragraf pertama/i),
    ).toBeInTheDocument();
  });

  it("shows error message in the result panel when generateCaptions returns an error", async () => {
    vi.mocked(generateCaptions).mockResolvedValue({
      error: "AI sedang sibuk, coba lagi nanti",
    });

    render(<CaptionGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(
        screen.getByText("AI sedang sibuk, coba lagi nanti"),
      ).toBeInTheDocument();
    });
  });

  it("clicking 'Salin' copies the caption text and shows 'Tersalin!' feedback", async () => {
    vi.mocked(generateCaptions).mockResolvedValue({
      data: [
        {
          text: "Caption yang akan disalin ke clipboard user.",
          hashtags: ["#test"],
          tips: "Tips singkat.",
        },
      ],
    });

    render(<CaptionGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await screen.findByText(/Caption yang akan disalin/i);

    const copyBtn = screen.getByRole("button", { name: /^Salin$/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Tersalin/i)).toBeInTheDocument();
    });
    expect(mockWriteText).toHaveBeenCalledWith(
      "Caption yang akan disalin ke clipboard user.",
    );
  });
});
