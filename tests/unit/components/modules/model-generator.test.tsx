// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateModelPrompts,
  type GenerateModelPromptsResult,
} from "@/lib/actions/models";
import { ModelGenerator } from "@/components/modules/model-generator";

/**
 * Mocks for `createBrowserClient`. Mirrors the pattern from
 * `tests/unit/components/modules/photo-generator.test.tsx` — we own
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
vi.mock("@/lib/actions/models", () => ({
  generateModelPrompts: vi.fn(),
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
 * Sample model prompt payload. Mirrors `ModelPromptResult` from
 * `lib/actions/models.ts` — one prompt with all metadata fields plus
 * the model-specific `modelDescription` field populated so the
 * model-badge assertion is meaningful.
 */
const SAMPLE_MODEL = {
  title: "Elegant wanita dewasa showcasing produk",
  prompt:
    "Editorial model photography of an elegant Indonesian woman in her mid-30s holding a serum bottle delicately, soft natural window light, neutral linen background, eye-level medium shot, shallow depth of field, muted earth tones, ultra realistic, 8k.",
  style: "minimalist",
  mood: "warm",
  setting: "studio",
  composition: "hero",
  aspectRatio: "4:5",
  lighting: "cahaya alami soft dari jendela",
  colorPalette: "earthy tone netral",
  cameraAngle: "low angle dramatic",
  modelDescription:
    "Indonesian woman in her mid-30s, elegant posture, soft smile, wearing cream linen blouse, holding the serum bottle delicately with both hands",
};

describe("ModelGenerator", () => {
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
    vi.mocked(generateModelPrompts).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  it("renders the form with product selector plus style, mood, setting, composition, gender, age, modelVibe selects and a generate button", async () => {
    render(<ModelGenerator />);

    // Wait for products to load — this is also how we know the form is
    // mounted (the select renders only after the fetch resolves).
    await screen.findByText("Sample Product A");

    expect(screen.getByLabelText(/^Produk$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Style$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mood$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Setting$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Komposisi$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Gender$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Usia$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Vibe$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate/i }),
    ).toBeInTheDocument();
  });

  it("shows the empty state placeholder when no generation has been triggered yet", async () => {
    render(<ModelGenerator />);
    await screen.findByText("Sample Product A");

    expect(screen.getByTestId("model-empty")).toBeInTheDocument();
  });

  it("shows loading state with 'Membuat prompt model...' while generateModelPrompts is in flight", async () => {
    // Never resolve so the loading state stays visible for assertion.
    vi.mocked(generateModelPrompts).mockImplementation(
      () => new Promise(() => {}) as Promise<GenerateModelPromptsResult>,
    );

    render(<ModelGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(
      await screen.findByTestId("model-loading"),
    ).toBeInTheDocument();
    expect(screen.getByText(/Membuat prompt model\.\.\./i)).toBeInTheDocument();
  });

  it("renders prompt + modelDescription badge + 4 metadata badges when generateModelPrompts returns results", async () => {
    vi.mocked(generateModelPrompts).mockResolvedValue({
      data: [SAMPLE_MODEL],
    });

    render(<ModelGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    // Card + title + prompt block.
    expect(await screen.findByTestId("model-card")).toBeInTheDocument();
    expect(
      screen.getByText("Elegant wanita dewasa showcasing produk"),
    ).toBeInTheDocument();

    const promptBlock = screen.getByTestId("model-prompt-block");
    expect(promptBlock.textContent).toContain(
      "Editorial model photography of an elegant Indonesian woman",
    );

    // Model-specific badge — distinguishes model cards from photo cards.
    const modelBadge = screen.getByTestId("model-badge-description");
    expect(modelBadge).toBeInTheDocument();
    expect(modelBadge.textContent).toContain(
      "Indonesian woman in her mid-30s, elegant posture, soft smile",
    );

    // 4 metadata badges — aspect, lighting, palette, angle.
    expect(screen.getByTestId("model-badge-aspect")).toBeInTheDocument();
    expect(screen.getByTestId("model-badge-lighting")).toBeInTheDocument();
    expect(screen.getByTestId("model-badge-palette")).toBeInTheDocument();
    expect(screen.getByTestId("model-badge-angle")).toBeInTheDocument();

    // Values rendered into the badges.
    expect(screen.getByText(/^4:5$/)).toBeInTheDocument();
    expect(
      screen.getByText(/cahaya alami soft dari jendela/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/earthy tone netral/i)).toBeInTheDocument();
    expect(screen.getByText(/low angle dramatic/i)).toBeInTheDocument();
  });

  it("shows error message in the result panel when generateModelPrompts returns an error", async () => {
    vi.mocked(generateModelPrompts).mockResolvedValue({
      error: "AI sedang sibuk, coba lagi nanti",
    });

    render(<ModelGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByTestId("model-error")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/AI sedang sibuk, coba lagi nanti/i),
    ).toBeInTheDocument();
  });

  it("copies the full English prompt text to the clipboard when the copy button is clicked", async () => {
    vi.mocked(generateModelPrompts).mockResolvedValue({
      data: [SAMPLE_MODEL],
    });

    render(<ModelGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await screen.findByText("Elegant wanita dewasa showcasing produk");

    const copyBtn = screen.getByRole("button", { name: /^Salin$/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Tersalin/i)).toBeInTheDocument();
    });
    // The exact prompt string should be on the clipboard so the user
    // can paste it straight into Midjourney / Leonardo.
    expect(mockWriteText).toHaveBeenCalledWith(SAMPLE_MODEL.prompt);
  });

  it("shows 'Belum ada produk' link to /produk when no products returned from Supabase", async () => {
    order.mockResolvedValue({ data: [], error: null });

    render(<ModelGenerator />);

    await waitFor(() => {
      expect(screen.getByText(/Belum ada produk/i)).toBeInTheDocument();
    });

    // The CTA is a link to /produk so the user can create their first
    // product without leaving the dashboard.
    const link = screen.getByRole("link", { name: /buat produk/i });
    expect(link).toHaveAttribute("href", "/produk");
  });

  it("renders the gender, age, and modelVibe selects with all expected options", async () => {
    render(<ModelGenerator />);
    await screen.findByText("Sample Product A");

    // Gender options: Pria, Wanita, Semua.
    const genderSelect = screen.getByLabelText(
      /^Gender$/i,
    ) as HTMLSelectElement;
    const genderOptions = Array.from(genderSelect.options).map((o) => o.text);
    expect(genderOptions).toEqual(["Pria", "Wanita", "Semua"]);

    // Age options: Remaja, Dewasa, Paruh Baya, Lansia.
    const ageSelect = screen.getByLabelText(/^Usia$/i) as HTMLSelectElement;
    const ageOptions = Array.from(ageSelect.options).map((o) => o.text);
    expect(ageOptions).toEqual([
      "Remaja",
      "Dewasa",
      "Paruh Baya",
      "Lansia",
    ]);

    // Model Vibe options: Kasual, Elegan, Atletik, Profesional.
    const vibeSelect = screen.getByLabelText(/^Vibe$/i) as HTMLSelectElement;
    const vibeOptions = Array.from(vibeSelect.options).map((o) => o.text);
    expect(vibeOptions).toEqual([
      "Kasual",
      "Elegan",
      "Atletik",
      "Profesional",
    ]);
  });
});
