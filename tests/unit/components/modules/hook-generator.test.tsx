// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateHooks,
  type GenerateHooksResult,
} from "@/lib/actions/hooks";
import { HookGenerator } from "@/components/modules/hook-generator";

/**
 * Mocks for `createBrowserClient`. Mirrors the pattern from
 * `tests/unit/components/product-list.test.tsx` — we own the entire
 * query chain so each test can swap the resolved dataset.
 */
vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(),
}));

/**
 * Stub the server action. The real implementation calls Supabase + AI,
 * which we don't want during a component test. We assert against the
 * arguments the action was called with, not its real output.
 */
vi.mock("@/lib/actions/hooks", () => ({
  generateHooks: vi.fn(),
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

describe("HookGenerator", () => {
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
    vi.mocked(generateHooks).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    // Reset the clipboard override so the next beforeEach starts clean.
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  it("renders the form with product selector, platform dropdown, tone dropdown, audience input, and generate button", async () => {
    render(<HookGenerator />);

    // Wait for products to load — this is also how we know the form is
    // mounted (the select renders only after the fetch resolves).
    await screen.findByText("Sample Product A");

    expect(screen.getByLabelText(/^Produk$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Platform$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Tone$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target audience/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate/i }),
    ).toBeInTheDocument();
  });

  it("shows empty state in the result panel when no results yet", async () => {
    render(<HookGenerator />);

    await screen.findByText("Sample Product A");

    expect(
      screen.getByText(/Pilih produk dan klik Generate/i),
    ).toBeInTheDocument();
  });

  it("shows 'Belum ada produk' link when no products returned from Supabase", async () => {
    order.mockResolvedValue({ data: [], error: null });

    render(<HookGenerator />);

    await waitFor(() => {
      expect(screen.getByText(/Belum ada produk/i)).toBeInTheDocument();
    });

    // The CTA is a link to /produk so the user can create their first
    // product without leaving the dashboard.
    const link = screen.getByRole("link", { name: /buat produk/i });
    expect(link).toHaveAttribute("href", "/produk");
  });

  it("shows loading state while generating", async () => {
    let resolveGenerate!: (value: GenerateHooksResult) => void;
    vi.mocked(generateHooks).mockImplementation(
      () =>
        new Promise<GenerateHooksResult>((resolve) => {
          resolveGenerate = resolve;
        }),
    );

    render(<HookGenerator />);
    await screen.findByText("Sample Product A");

    // Select a product so the button is enabled.
    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(
      screen.getByText(/Menghasilkan hook ideas/i),
    ).toBeInTheDocument();

    // Resolve the action so React can flush the loading→idle transition
    // and the test exits cleanly.
    await act(async () => {
      resolveGenerate({ data: [] });
    });
  });

  it("shows hook cards when results are returned", async () => {
    vi.mocked(generateHooks).mockResolvedValue({
      data: [
        {
          text: "Hook pertama yang menarik",
          platform: "tiktok",
          tone: "casual",
          note: "Cocok untuk opening 3 detik",
        },
        {
          text: "Hook kedua storytelling",
          platform: "tiktok",
          tone: "casual",
        },
      ],
    });

    render(<HookGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Hook pertama yang menarik"),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Hook kedua storytelling")).toBeInTheDocument();
    // The note is only present on hook #1, so its absence on #2 is the
    // simplest "no crash when note missing" smoke test.
    expect(screen.getByText("Cocok untuk opening 3 detik")).toBeInTheDocument();
  });

  it("shows error message in the result panel when generateHooks returns an error", async () => {
    vi.mocked(generateHooks).mockResolvedValue({
      error: "AI sedang sibuk, coba lagi nanti",
    });

    render(<HookGenerator />);
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

  it("clicking 'Salin' copies the hook text and shows 'Tersalin!' feedback", async () => {
    vi.mocked(generateHooks).mockResolvedValue({
      data: [
        {
          text: "Hook yang akan disalin",
          platform: "tiktok",
          tone: "casual",
        },
      ],
    });

    render(<HookGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await screen.findByText("Hook yang akan disalin");

    const copyBtn = screen.getByRole("button", { name: /^Salin$/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Tersalin/i)).toBeInTheDocument();
    });
    expect(mockWriteText).toHaveBeenCalledWith("Hook yang akan disalin");
  });
});
