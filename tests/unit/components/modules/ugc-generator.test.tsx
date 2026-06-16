// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateUgcScript,
  generateUgcStoryboard,
  generateUgcPrompt,
  generateUgcBatch,
  type GenerateUgcScriptResult,
} from "@/lib/actions/ugc";
import { UgcGenerator } from "@/components/modules/ugc-generator";

/**
 * Mocks for `createBrowserClient`. Mirrors the pattern used by the
 * other module tests — we own the entire query chain so each test
 * can swap the resolved dataset.
 */
vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(),
}));

/**
 * Stub all four server actions. The real implementations call Supabase
 * + AI, which we don't want during a component test. We assert against
 * the arguments the action was called with, not its real output.
 */
vi.mock("@/lib/actions/ugc", () => ({
  generateUgcScript: vi.fn(),
  generateUgcStoryboard: vi.fn(),
  generateUgcPrompt: vi.fn(),
  generateUgcBatch: vi.fn(),
}));

/**
 * `sonner` renders to a portal that isn't mounted in this test tree.
 * Stub the whole module so the test output stays clean.
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
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Sample Product C",
  },
];

describe("UgcGenerator", () => {
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

    // Default: return 3 products. Individual tests override `order`
    // when they want the empty-products state.
    order = vi.fn().mockResolvedValue({ data: SAMPLE_PRODUCTS, error: null });
    select = vi.fn(() => ({ order }));
    from = vi.fn(() => ({ select }));
    vi.mocked(createBrowserClient).mockReturnValue(
      { from } as unknown as ReturnType<typeof createBrowserClient>,
    );

    // Default action responses: success with empty data.
    vi.mocked(generateUgcScript).mockResolvedValue({ data: undefined });
    vi.mocked(generateUgcStoryboard).mockResolvedValue({ data: undefined });
    vi.mocked(generateUgcPrompt).mockResolvedValue({ data: undefined });
    vi.mocked(generateUgcBatch).mockResolvedValue({ data: undefined });
  });

  afterEach(() => {
    // Reset the clipboard override so the next beforeEach starts clean.
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  it("renders 4 tabs in a tablist: Script, Storyboard, Prompt, Batch", async () => {
    render(<UgcGenerator />);

    // Wait for products to load so the form is mounted.
    await screen.findByText("Sample Product A");

    const tablist = screen.getByRole("tablist");
    expect(tablist).toBeInTheDocument();

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(tabs[0]).toHaveTextContent(/Script/i);
    expect(tabs[1]).toHaveTextContent(/Storyboard/i);
    expect(tabs[2]).toHaveTextContent(/Prompt/i);
    expect(tabs[3]).toHaveTextContent(/Batch/i);
  });

  it("renders the Script tab form (product + platform + tone + audience + generate) by default", async () => {
    render(<UgcGenerator />);

    await screen.findByText("Sample Product A");

    // Default active tab is Script — form fields are visible.
    expect(screen.getByLabelText(/^Produk$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Platform$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Tone$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/target audience/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate/i }),
    ).toBeInTheDocument();
  });

  it("switches to the Storyboard tab and shows the storyboard form (no audience field)", async () => {
    render(<UgcGenerator />);

    await screen.findByText("Sample Product A");

    fireEvent.click(screen.getByRole("tab", { name: /Storyboard/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^Produk$/i)).toBeInTheDocument();
    });

    // Storyboard uses product + platform + tone — no audience.
    expect(screen.queryByLabelText(/target audience/i)).not.toBeInTheDocument();
  });

  it("switches to the Prompt tab and shows style + mood selectors", async () => {
    render(<UgcGenerator />);

    await screen.findByText("Sample Product A");

    fireEvent.click(screen.getByRole("tab", { name: /Prompt/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^Style$/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/^Mood$/i)).toBeInTheDocument();
    // Prompt tab has no platform/tone/audience.
    expect(screen.queryByLabelText(/^Platform$/i)).not.toBeInTheDocument();
  });

  it("switches to the Batch tab and shows product multi-select checkboxes (min 2, max 5)", async () => {
    render(<UgcGenerator />);

    await screen.findByText("Sample Product A");

    fireEvent.click(screen.getByRole("tab", { name: /Batch/i }));

    // Batch uses checkboxes for product selection.
    await waitFor(() => {
      expect(
        screen.getByLabelText("Sample Product A"),
      ).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Sample Product A")).toBeInTheDocument();
    expect(screen.getByLabelText("Sample Product B")).toBeInTheDocument();
    expect(screen.getByLabelText("Sample Product C")).toBeInTheDocument();
  });

  it("shows loading state in the result panel while a generation is in flight", async () => {
    // Never-resolving promise so the loading state stays visible.
    vi.mocked(generateUgcScript).mockReturnValue(
      new Promise<GenerateUgcScriptResult>(() => {}),
    );

    render(<UgcGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(
      await screen.findByTestId("ugc-script-loading"),
    ).toBeInTheDocument();
  });

  it("shows error message in the result panel when the action returns an error", async () => {
    vi.mocked(generateUgcScript).mockResolvedValue({
      error: "AI sedang sibuk, coba lagi nanti",
    });

    render(<UgcGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(await screen.findByTestId("ugc-script-error")).toHaveTextContent(
      /AI sedang sibuk/i,
    );
  });

  it("renders Script results: title + full text + copy button after a successful generation", async () => {
    vi.mocked(generateUgcScript).mockResolvedValue({
      data: {
        title: "Review jujur 2 minggu",
        text: "Aku udah pakai produk ini 2 minggu dan hasilnya... Cuma packagingnya agak besar.",
      },
    });

    render(<UgcGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(
      await screen.findByTestId("ugc-script-card"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Review jujur 2 minggu"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Aku udah pakai produk ini/i),
    ).toBeInTheDocument();

    // Click the copy button — should write the script text to clipboard.
    const copyBtn = screen.getByRole("button", { name: /^Salin$/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Tersalin/i)).toBeInTheDocument();
    });
    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining("Aku udah pakai produk ini"),
    );
  });

  it("renders Storyboard results: 4-6 panel cards with timing/visuals/audio/text", async () => {
    vi.mocked(generateUgcStoryboard).mockResolvedValue({
      data: [
        {
          panel: 1,
          time: "0-3s",
          visuals: "Talent angkat produk ke kamera",
          audio: "Oke jadi ini yang lagi viral",
          text: "Wait ini beneran bagus?",
        },
        {
          panel: 2,
          time: "3-10s",
          visuals: "Close up tekstur produk",
          audio: "Awalnya aku skeptis sih",
          text: "",
        },
      ],
    });

    render(<UgcGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.click(screen.getByRole("tab", { name: /Storyboard/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^Produk$/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    const cards = await screen.findAllByTestId("ugc-storyboard-card");
    expect(cards).toHaveLength(2);

    expect(
      screen.getByText("Talent angkat produk ke kamera"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Oke jadi ini yang lagi viral"),
    ).toBeInTheDocument();
  });

  it("renders Prompt results: prompt cards with style + mood badges", async () => {
    vi.mocked(generateUgcPrompt).mockResolvedValue({
      data: [
        {
          title: "Selfie candid di kamar",
          prompt: "A young woman taking a selfie with product, natural lighting, smartphone camera, candid moment",
          style: "selfie",
          mood: "candid",
        },
      ],
    });

    render(<UgcGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.click(screen.getByRole("tab", { name: /Prompt/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^Style$/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(
      await screen.findByTestId("ugc-prompt-card"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Selfie candid di kamar"),
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("ugc-prompt-badge-style"),
    ).toHaveTextContent(/selfie/i);
    expect(
      screen.getByTestId("ugc-prompt-badge-mood"),
    ).toHaveTextContent(/candid/i);
  });

  it("renders Batch results: one card per product with the product name as header", async () => {
    vi.mocked(generateUgcBatch).mockResolvedValue({
      data: [
        {
          title: "Review product A",
          text: "Aku udah pakai product A sebulan...",
        },
        {
          title: "Review product B",
          text: "Product B ini surprisingly bagus sih...",
        },
      ],
    });

    render(<UgcGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.click(screen.getByRole("tab", { name: /Batch/i }));

    await waitFor(() => {
      expect(screen.getByLabelText("Sample Product A")).toBeInTheDocument();
    });

    // Select 2 products.
    fireEvent.click(screen.getByLabelText("Sample Product A"));
    fireEvent.click(screen.getByLabelText("Sample Product B"));

    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      const cards = screen.getAllByTestId("ugc-batch-card");
      expect(cards.length).toBe(2);
    });

    const productAOccurrences = screen.getAllByText("Sample Product A");
    expect(productAOccurrences.length).toBeGreaterThanOrEqual(2);
    const productBOccurrences = screen.getAllByText("Sample Product B");
    expect(productBOccurrences.length).toBeGreaterThanOrEqual(2);
  });

  it("shows 'Belum ada produk' link to /produk when no products returned from Supabase", async () => {
    order.mockResolvedValue({ data: [], error: null });

    render(<UgcGenerator />);

    await waitFor(() => {
      expect(screen.getByText(/Belum ada produk/i)).toBeInTheDocument();
    });

    // The CTA is a link to /produk so the user can create their first
    // product without leaving the dashboard.
    const link = screen.getByRole("link", { name: /buat produk/i });
    expect(link).toHaveAttribute("href", "/produk");
  });
});
