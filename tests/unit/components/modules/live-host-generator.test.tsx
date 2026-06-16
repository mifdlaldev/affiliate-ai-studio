// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateLiveScript,
  type GenerateLiveScriptResult,
} from "@/lib/actions/live-host";
import { LiveHostGenerator } from "@/components/modules/live-host-generator";

/**
 * Mocks for `createBrowserClient`. Mirrors the pattern from
 * `tests/unit/components/modules/script-generator.test.tsx` — we own
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
vi.mock("@/lib/actions/live-host", () => ({
  generateLiveScript: vi.fn(),
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

Object.defineProperty(navigator, "clipboard", {
  configurable: true,
  value: { writeText: mockWriteText },
});

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
 * Sample live-host payload. Mirrors `LiveHostResult` from
 * `lib/actions/live-host.ts` — one script with two segments, a CTA.
 */
const SAMPLE_LIVE_SCRIPT = {
  title: "Live 30 menit: GlowLab Serum",
  segments: [
    {
      time: "0-2 menit",
      segmentName: "Opening",
      hostScript:
        "Halo kak! Welcome back. Hari ini aku mau spill serum yang lagi viral.",
      keyPoints: [
        "Sapa penonton",
        "Introduksi produk",
        "Tanya di komentar",
      ],
      engagementTip: "Ketik 'GLOW' di komentar!",
    },
    {
      time: "2-15 menit",
      segmentName: "Demo Produk",
      hostScript:
        "Ini serum-nya, teksturnya lightweight banget, langsung menyerap.",
      keyPoints: ["Tunjukkan tekstur", "Aplikasikan", "Highlight USP"],
      engagementTip: "Drop ❤️ kalau kalian juga punya masalah kulit kusam!",
    },
  ],
  cta: "Klik keranjang kuning sekarang, stok terbatas!",
};

describe("LiveHostGenerator", () => {
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
    vi.mocked(generateLiveScript).mockResolvedValue({} as GenerateLiveScriptResult);
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  it("renders the form with product selector, platform dropdown, tone dropdown, audience input, duration select (15/30/60 menit), and generate button", async () => {
    render(<LiveHostGenerator />);

    // Wait for products to load — this is also how we know the form is
    // mounted (the select renders only after the fetch resolves).
    await screen.findByText("Sample Product A");

    expect(screen.getByLabelText(/^Produk$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Platform$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Tone$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target audience/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Durasi$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate/i }),
    ).toBeInTheDocument();

    // Duration options are in MENIT (not detik). The unit is the key
    // difference vs. the Script Generator.
    const durationSelect = screen.getByLabelText(
      /^Durasi$/i,
    ) as HTMLSelectElement;
    const options = Array.from(durationSelect.options).map((o) => o.value);
    expect(options).toEqual(["15", "30", "60"]);
  });

  it("shows empty state in the result panel when no results yet", async () => {
    render(<LiveHostGenerator />);

    await screen.findByText("Sample Product A");

    expect(
      screen.getByText(/Pilih produk dan klik Generate/i),
    ).toBeInTheDocument();
  });

  it("renders segments with timing, segmentName, hostScript, keyPoints, engagementTip when generateLiveScript returns results", async () => {
    vi.mocked(generateLiveScript).mockResolvedValue({
      data: SAMPLE_LIVE_SCRIPT,
    });

    render(<LiveHostGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    // Script title appears as the card heading.
    await screen.findByText("Live 30 menit: GlowLab Serum");

    // Segment 1 — Opening — fields render as data-testid="live-segment".
    const segments = screen.getAllByTestId("live-segment");
    expect(segments).toHaveLength(2);

    // First segment contents.
    expect(screen.getByText("0-2 menit")).toBeInTheDocument();
    expect(screen.getByText("Opening")).toBeInTheDocument();
    expect(
      screen.getByText(/Halo kak! Welcome back\. Hari ini aku mau spill/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Sapa penonton")).toBeInTheDocument();
    expect(
      screen.getByText(/Ketik 'GLOW' di komentar!/),
    ).toBeInTheDocument();

    // Second segment — keyPoints list.
    expect(screen.getByText("Tunjukkan tekstur")).toBeInTheDocument();
    expect(screen.getByText("Highlight USP")).toBeInTheDocument();

    // Closing CTA.
    expect(
      screen.getByText(/Klik keranjang kuning sekarang, stok terbatas!/i),
    ).toBeInTheDocument();
  });

  it("forwards FormData to the server action with the correct fields (productId, platform, tone, audience, duration)", async () => {
    vi.mocked(generateLiveScript).mockResolvedValue({
      data: SAMPLE_LIVE_SCRIPT,
    });

    render(<LiveHostGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.change(screen.getByLabelText(/^Platform$/i), {
      target: { value: "instagram" },
    });
    fireEvent.change(screen.getByLabelText(/^Tone$/i), {
      target: { value: "funny" },
    });
    fireEvent.change(screen.getByLabelText(/target audience/i), {
      target: { value: "Bunda muda" },
    });
    fireEvent.change(screen.getByLabelText(/^Durasi$/i), {
      target: { value: "60" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(generateLiveScript).toHaveBeenCalledTimes(1);
    });

    const submitted = vi.mocked(generateLiveScript).mock
      .calls[0]?.[0] as FormData;
    expect(submitted).toBeInstanceOf(FormData);
    expect(submitted.get("productId")).toBe(SAMPLE_PRODUCTS[0].id);
    expect(submitted.get("platform")).toBe("instagram");
    expect(submitted.get("tone")).toBe("funny");
    expect(submitted.get("audience")).toBe("Bunda muda");
    expect(submitted.get("duration")).toBe("60");
  });

  it("shows error message in the result panel when generateLiveScript returns an error", async () => {
    vi.mocked(generateLiveScript).mockResolvedValue({
      error: "AI sedang sibuk, coba lagi nanti",
    });

    render(<LiveHostGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByTestId("live-host-error")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/AI sedang sibuk, coba lagi nanti/i),
    ).toBeInTheDocument();
  });

  it("copies the live script to clipboard when the Salin button is clicked", async () => {
    vi.mocked(generateLiveScript).mockResolvedValue({
      data: SAMPLE_LIVE_SCRIPT,
    });

    render(<LiveHostGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    // Wait for results, then click the copy button.
    await screen.findByText("Live 30 menit: GlowLab Serum");
    fireEvent.click(screen.getByRole("button", { name: /^Salin$/i }));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });

    // The clipboard payload should contain segment markers and the
    // closing CTA so the user can paste the whole live script.
    const payload = mockWriteText.mock.calls[0]?.[0] as string;
    expect(payload).toContain("Live 30 menit: GlowLab Serum");
    expect(payload).toContain("Opening");
    expect(payload).toContain("Demo Produk");
    expect(payload).toContain("Klik keranjang kuning sekarang");
  });

  it("shows 'Belum ada produk' link when no products returned from Supabase", async () => {
    order.mockResolvedValue({ data: [], error: null });

    render(<LiveHostGenerator />);

    await waitFor(() => {
      expect(screen.getByText(/Belum ada produk/i)).toBeInTheDocument();
    });

    // The CTA is a link to /produk so the user can create their first
    // product without leaving the dashboard.
    const link = screen.getByRole("link", { name: /buat produk/i });
    expect(link).toHaveAttribute("href", "/produk");
  });
});
