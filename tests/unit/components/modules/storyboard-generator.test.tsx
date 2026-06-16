// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateStoryboard,
  type GenerateStoryboardResult,
} from "@/lib/actions/storyboard";
import { StoryboardGenerator } from "@/components/modules/storyboard-generator";

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
vi.mock("@/lib/actions/storyboard", () => ({
  generateStoryboard: vi.fn(),
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

// ---- Test fixtures ---------------------------------------------------------

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
 * Sample storyboard payload. Mirrors `StoryboardPanel` from
 * `lib/actions/storyboard.ts` — 3 panels with cinematographic fields.
 */
const SAMPLE_STORYBOARD: GenerateStoryboardResult["data"] = [
  {
    panel: 1,
    time: "0-3s",
    visuals: "Close-up produk dipegang tangan, cahaya jendela.",
    audio: "Lagi viral banget ini serum.",
    text: "STOP!",
    cameraAngle: "Close-up produk",
    transition: "Jump cut",
  },
  {
    panel: 2,
    time: "3-15s",
    visuals: "Aplikasi serum ke wajah, ekspresi rileks.",
    audio: "Pas dipake adem banget di kulit.",
    text: "Glowing in 7 days",
    cameraAngle: "Medium shot talent",
    transition: "Cross dissolve",
  },
  {
    panel: 3,
    time: "15-30s",
    visuals: "Before/after split, senyum puas.",
    audio: "Link di keranjang kuning ya.",
    text: "Beli sekarang",
    cameraAngle: "Wide shot split",
    transition: "",
  },
];

// ---- Test setup ------------------------------------------------------------

describe("StoryboardGenerator", () => {
  let order: ReturnType<typeof vi.fn>;
  let select: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

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
    vi.mocked(generateStoryboard).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    // Clipboard not exposed by happy-dom; reset between tests for hygiene.
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  it("renders the form with product selector, platform dropdown, tone dropdown, duration select, and generate button", async () => {
    render(<StoryboardGenerator />);

    // Wait for products to load — this is also how we know the form is
    // mounted (the select renders only after the fetch resolves).
    await screen.findByText("Sample Product A");

    expect(screen.getByLabelText(/^Produk$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Platform$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Tone$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Durasi$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate/i }),
    ).toBeInTheDocument();
  });

  it("shows empty state in the result panel when no results yet", async () => {
    render(<StoryboardGenerator />);

    await screen.findByText("Sample Product A");

    expect(
      screen.getByText(/Pilih produk dan klik Generate/i),
    ).toBeInTheDocument();
  });

  it("renders storyboard scene cards in a 2-column gallery after a successful generation", async () => {
    vi.mocked(generateStoryboard).mockResolvedValue({
      data: SAMPLE_STORYBOARD,
    });

    render(<StoryboardGenerator />);

    // Pick a product so the submit isn't blocked.
    await screen.findByText("Sample Product A");
    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0]!.id },
    });

    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    // All 3 panel cards appear.
    await waitFor(() => {
      expect(screen.getAllByTestId("storyboard-card")).toHaveLength(3);
    });

    // Each card shows the panel number + time badge + camera angle chip.
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
    expect(screen.getByText("0-3s")).toBeInTheDocument();
    expect(screen.getByText("3-15s")).toBeInTheDocument();
    expect(screen.getByText("15-30s")).toBeInTheDocument();
    // Camera angle chips are tagged so they don't collide with the
    // visual descriptions that may start with the same words.
    expect(screen.getByTestId("camera-angle-0")).toHaveTextContent(
      /Close-up produk/i,
    );
    expect(screen.getByTestId("camera-angle-1")).toHaveTextContent(
      /Medium shot talent/i,
    );
    expect(screen.getByTestId("camera-angle-2")).toHaveTextContent(
      /Wide shot split/i,
    );

    // Visual + audio + text descriptions are visible.
    expect(
      screen.getByText(/Close-up produk dipegang tangan, cahaya jendela\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Pas dipake adem banget di kulit\./i),
    ).toBeInTheDocument();
    expect(screen.getByText("STOP!")).toBeInTheDocument();
    expect(screen.getByText("Beli sekarang")).toBeInTheDocument();
  });

  it("shows error message in the result panel when generateStoryboard returns an error", async () => {
    vi.mocked(generateStoryboard).mockResolvedValue({
      error: "AI sedang sibuk, coba lagi nanti",
    });

    render(<StoryboardGenerator />);

    await screen.findByText("Sample Product A");
    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0]!.id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(await screen.findByTestId("storyboard-error")).toHaveTextContent(
      /AI sedang sibuk, coba lagi nanti/,
    );
  });

  it("shows loading state in the result panel while generation is in flight", async () => {
    // Defer resolution so we can observe the loading state.
    let resolveGenerate!: (value: GenerateStoryboardResult) => void;
    vi.mocked(generateStoryboard).mockImplementation(
      () =>
        new Promise<GenerateStoryboardResult>((resolve) => {
          resolveGenerate = resolve;
        }),
    );

    render(<StoryboardGenerator />);

    await screen.findByText("Sample Product A");
    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0]!.id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    // Loading state appears.
    expect(await screen.findByTestId("storyboard-loading")).toBeInTheDocument();

    // Resolve + wait for the loading state to clear so we don't leak
    // a pending promise into the next test (avoids React act warnings).
    resolveGenerate({ data: [] });
    await waitFor(() => {
      expect(
        screen.queryByTestId("storyboard-loading"),
      ).not.toBeInTheDocument();
    });
  });

  it("sends the selected product, platform, tone, and duration to the server action", async () => {
    render(<StoryboardGenerator />);

    await screen.findByText("Sample Product A");
    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[1]!.id },
    });
    fireEvent.change(screen.getByLabelText(/^Platform$/i), {
      target: { value: "instagram" },
    });
    fireEvent.change(screen.getByLabelText(/^Tone$/i), {
      target: { value: "professional" },
    });
    fireEvent.click(screen.getByLabelText(/^Durasi$/i), {
      // 15s radio button is the second in the duration radio group.
    });
    // Click the 15s radio directly.
    fireEvent.click(screen.getByRole("radio", { name: /15 detik/i }));

    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(vi.mocked(generateStoryboard)).toHaveBeenCalledTimes(1);
    });

    const fd = vi.mocked(generateStoryboard).mock
      .calls[0]?.[0] as FormData;
    expect(fd.get("productId")).toBe(SAMPLE_PRODUCTS[1]!.id);
    expect(fd.get("platform")).toBe("instagram");
    expect(fd.get("tone")).toBe("professional");
    expect(fd.get("duration")).toBe("15");
  });

  it("shows 'Belum ada produk' link when no products returned from Supabase", async () => {
    order.mockResolvedValue({ data: [], error: null });

    render(<StoryboardGenerator />);

    await waitFor(() => {
      expect(screen.getByText(/Belum ada produk/i)).toBeInTheDocument();
    });

    // The CTA is a link to /produk so the user can create their first
    // product without leaving the dashboard.
    const link = screen.getByRole("link", { name: /buat produk/i });
    expect(link).toHaveAttribute("href", "/produk");
  });
});
