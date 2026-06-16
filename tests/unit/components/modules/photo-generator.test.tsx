// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generatePhotoPrompts,
  type GeneratePhotoPromptsResult,
} from "@/lib/actions/photos";
import { PhotoGenerator } from "@/components/modules/photo-generator";

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
vi.mock("@/lib/actions/photos", () => ({
  generatePhotoPrompts: vi.fn(),
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
 * Sample photo prompt payload. Mirrors `PhotoPromptResult` from
 * `lib/actions/photos.ts` — one prompt with all metadata fields populated
 * so the metadata-badge assertions are meaningful.
 */
const SAMPLE_PHOTO = {
  title: "Hero shot angle 45 derajat",
  prompt:
    "Editorial product photography of a sleek minimalist skincare bottle on a marble surface, soft natural window light, 45-degree top-down angle, muted earth tones, shallow depth of field, ultra realistic, 8k.",
  style: "minimalist",
  mood: "warm",
  setting: "studio",
  composition: "hero",
  aspectRatio: "4:5",
  lighting: "cahaya alami soft dari jendela",
  colorPalette: "earthy tone netral",
  cameraAngle: "45 derajat dari atas",
};

describe("PhotoGenerator", () => {
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
    vi.mocked(generatePhotoPrompts).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  it("renders the form with product selector plus style, mood, setting, composition selects and a generate button", async () => {
    render(<PhotoGenerator />);

    // Wait for products to load — this is also how we know the form is
    // mounted (the select renders only after the fetch resolves).
    await screen.findByText("Sample Product A");

    expect(screen.getByLabelText(/^Produk$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Style$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Mood$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Setting$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Komposisi$/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /generate/i }),
    ).toBeInTheDocument();
  });

  it("shows empty state in the result panel when no results yet", async () => {
    render(<PhotoGenerator />);

    await screen.findByText("Sample Product A");

    expect(
      screen.getByText(/Pilih produk dan mulai generate prompt foto/i),
    ).toBeInTheDocument();
  });

  it("shows loading state in the result panel while generatePhotoPrompts is in flight", async () => {
    // Never-resolving action keeps the component in the loading state
    // long enough for us to assert on the spinner copy.
    vi.mocked(generatePhotoPrompts).mockImplementation(
      () => new Promise<GeneratePhotoPromptsResult>(() => {}),
    );

    render(<PhotoGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(await screen.findByTestId("photo-loading")).toBeInTheDocument();
    expect(
      screen.getByText(/Membuat prompt foto\.\.\./i),
    ).toBeInTheDocument();
  });

  it("renders prompt text and metadata badges (Aspect Ratio, Lighting, Color Palette, Camera Angle) when results come back", async () => {
    vi.mocked(generatePhotoPrompts).mockResolvedValue({
      data: [SAMPLE_PHOTO],
    });

    render(<PhotoGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    // Title appears on the result card.
    await screen.findByText("Hero shot angle 45 derajat");

    // The full English prompt is rendered as a copyable block.
    expect(
      screen.getByText(/Editorial product photography of a sleek/i),
    ).toBeInTheDocument();

    // Metadata badges — one per field.
    expect(screen.getByText(/^4:5$/)).toBeInTheDocument();
    expect(
      screen.getByText(/cahaya alami soft dari jendela/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/earthy tone netral/i)).toBeInTheDocument();
    expect(screen.getByText(/45 derajat dari atas/i)).toBeInTheDocument();
  });

  it("shows error message in the result panel when generatePhotoPrompts returns an error", async () => {
    vi.mocked(generatePhotoPrompts).mockResolvedValue({
      error: "AI sedang sibuk, coba lagi nanti",
    });

    render(<PhotoGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByTestId("photo-error")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/AI sedang sibuk, coba lagi nanti/i),
    ).toBeInTheDocument();
  });

  it("copies the full English prompt text to the clipboard when the copy button is clicked", async () => {
    vi.mocked(generatePhotoPrompts).mockResolvedValue({
      data: [SAMPLE_PHOTO],
    });

    render(<PhotoGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await screen.findByText("Hero shot angle 45 derajat");

    const copyBtn = screen.getByRole("button", { name: /^Salin$/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText(/Tersalin/i)).toBeInTheDocument();
    });
    // The exact prompt string should be on the clipboard so the user
    // can paste it straight into Midjourney / Leonardo.
    expect(mockWriteText).toHaveBeenCalledWith(SAMPLE_PHOTO.prompt);
  });

  it("shows 'Belum ada produk' link to /produk when no products returned from Supabase", async () => {
    order.mockResolvedValue({ data: [], error: null });

    render(<PhotoGenerator />);

    await waitFor(() => {
      expect(screen.getByText(/Belum ada produk/i)).toBeInTheDocument();
    });

    // The CTA is a link to /produk so the user can create their first
    // product without leaving the dashboard.
    const link = screen.getByRole("link", { name: /buat produk/i });
    expect(link).toHaveAttribute("href", "/produk");
  });
});
