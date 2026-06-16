// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateScripts,
  type GenerateScriptsResult,
} from "@/lib/actions/scripts";
import { ScriptGenerator } from "@/components/modules/script-generator";

/**
 * Mocks for `createBrowserClient`. Mirrors the pattern from
 * `tests/unit/components/modules/caption-generator.test.tsx` — we own
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
vi.mock("@/lib/actions/scripts", () => ({
  generateScripts: vi.fn(),
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
 * Sample script payload. Mirrors `ScriptResult` from
 * `lib/actions/scripts.ts` — one script with two scenes, a CTA, and
 * a duration we can render as a badge.
 */
const SAMPLE_SCRIPT = {
  title: "Script Test 1",
  scenes: [
    {
      time: "0-3s",
      visuals: "Produk dipegang dengan cahaya natural.",
      audio: "Pernah nggak sih kamu ngerasa kulit wajah kusam?",
      text: "STOP!",
    },
    {
      time: "3-10s",
      visuals: "Aplikasi serum secara perlahan.",
      audio: "Serum ini bisa bikin glowing dalam 7 hari.",
      text: "Glowing in 7 days",
    },
  ],
  cta: "Beli sekarang dan rasakan bedanya!",
};

describe("ScriptGenerator", () => {
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
    vi.mocked(generateScripts).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  it("renders the form with product selector, platform dropdown, tone dropdown, audience input, duration select, and generate button", async () => {
    render(<ScriptGenerator />);

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
  });

  it("shows empty state in the result panel when no results yet", async () => {
    render(<ScriptGenerator />);

    await screen.findByText("Sample Product A");

    expect(
      screen.getByText(/Pilih produk dan klik Generate/i),
    ).toBeInTheDocument();
  });

  it("shows loading state in the result panel while generateScripts is in flight", async () => {
    // Never-resolving action keeps the component in the loading state
    // long enough for us to assert on the spinner copy.
    vi.mocked(generateScripts).mockImplementation(
      () => new Promise<GenerateScriptsResult>(() => {}),
    );

    render(<ScriptGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(await screen.findByTestId("script-loading")).toBeInTheDocument();
    expect(
      screen.getByText(/Menghasilkan script.../i),
    ).toBeInTheDocument();
  });

  it("renders a scene table (Waktu, Visual, Audio, Teks) when generateScripts returns results", async () => {
    vi.mocked(generateScripts).mockResolvedValue({
      data: [SAMPLE_SCRIPT],
    });

    render(<ScriptGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    // Script title + duration badge appear on the result card header.
    await screen.findByText("Script Test 1");
    expect(screen.getByText(/30s/)).toBeInTheDocument();

    // Scene table columns render as headers.
    expect(screen.getByText(/^Waktu$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Visual$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Audio$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Teks$/i)).toBeInTheDocument();

    // Scene rows render the AI-generated content.
    expect(screen.getByText("0-3s")).toBeInTheDocument();
    expect(
      screen.getByText(/Produk dipegang dengan cahaya natural\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Pernah nggak sih kamu ngerasa kulit wajah kusam\?/i),
    ).toBeInTheDocument();
    expect(screen.getByText("STOP!")).toBeInTheDocument();

    expect(screen.getByText("3-10s")).toBeInTheDocument();
    expect(
      screen.getByText(/Aplikasi serum secara perlahan\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Serum ini bisa bikin glowing dalam 7 hari\./i),
    ).toBeInTheDocument();
    expect(screen.getByText("Glowing in 7 days")).toBeInTheDocument();

    // CTA appears at the bottom of the script.
    expect(
      screen.getByText(/Beli sekarang dan rasakan bedanya!/i),
    ).toBeInTheDocument();
  });

  it("shows error message in the result panel when generateScripts returns an error", async () => {
    vi.mocked(generateScripts).mockResolvedValue({
      error: "AI sedang sibuk, coba lagi nanti",
    });

    render(<ScriptGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByTestId("script-error")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/AI sedang sibuk, coba lagi nanti/i),
    ).toBeInTheDocument();
  });

  it("copies the formatted script to the clipboard when the copy button is clicked", async () => {
    vi.mocked(generateScripts).mockResolvedValue({
      data: [SAMPLE_SCRIPT],
    });

    render(<ScriptGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await screen.findByText("Script Test 1");

    const copyBtn = screen.getByRole("button", { name: /^Salin$/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Tersalin/i)).toBeInTheDocument();
    });
    // The script is serialized as title + scenes + CTA so the user
    // can paste the whole storyboard into a single block.
    const clipboardArg = mockWriteText.mock.calls[0]?.[0] ?? "";
    expect(clipboardArg).toContain("Script Test 1");
    expect(clipboardArg).toContain("0-3s");
    expect(clipboardArg).toContain("STOP!");
    expect(clipboardArg).toContain(
      "Beli sekarang dan rasakan bedanya!",
    );
  });

  it("shows 'Belum ada produk' link when no products returned from Supabase", async () => {
    order.mockResolvedValue({ data: [], error: null });

    render(<ScriptGenerator />);

    await waitFor(() => {
      expect(screen.getByText(/Belum ada produk/i)).toBeInTheDocument();
    });

    // The CTA is a link to /produk so the user can create their first
    // product without leaving the dashboard.
    const link = screen.getByRole("link", { name: /buat produk/i });
    expect(link).toHaveAttribute("href", "/produk");
  });
});
