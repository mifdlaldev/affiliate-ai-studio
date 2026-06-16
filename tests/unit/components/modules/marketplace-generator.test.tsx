// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateMarketplaceDescription,
} from "@/lib/actions/marketplace";
import { MarketplaceGenerator } from "@/components/modules/marketplace-generator";

/**
 * Mocks for `createBrowserClient`. Mirrors the pattern from the
 * sibling generator tests — we own the entire query chain so each
 * test can swap the resolved dataset.
 */
vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(),
}));

/**
 * Stub the server action. The real implementation calls Supabase + AI,
 * which we don't want during a component test. We assert against the
 * arguments the action was called with, not its real output.
 */
vi.mock("@/lib/actions/marketplace", () => ({
  generateMarketplaceDescription: vi.fn(),
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
 * Sample marketplace payload. Mirrors `MarketplaceResult` from
 * `lib/actions/marketplace.ts`.
 */
const SAMPLE_MARKETPLACE = {
  title: "GlowLab Serum Vitamin C 20% Premium - Mencerahkan Kulit 14 Hari",
  shortDescription:
    "Serum vitamin C konsentrasi tinggi dengan niacinamide untuk kulit cerah merata dalam 14 hari.",
  description:
    "GlowLab Serum Vitamin C 20% adalah serum wajah premium yang diformulasikan untuk wanita Indonesia yang ingin mendapatkan kulit cerah merata.",
  bulletPoints: [
    "Mengandung 20% Vitamin C murni",
    "Diperkaya Niacinamide untuk kulit cerah merata",
    "Tekstur ringan, cepat menyerap",
    "Aman untuk kulit sensitif",
  ],
  tags: ["serum vitamin c", "skincare", "pencerah"],
  cta: "Klik keranjang kuning sekarang, stok terbatas!",
};

let order: ReturnType<typeof vi.fn>;
let select: ReturnType<typeof vi.fn>;
let from: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();

  // Default Supabase chain: `from('products').select('id, name').order(...)`.
  order = vi.fn().mockResolvedValue({ data: SAMPLE_PRODUCTS, error: null });
  select = vi.fn(() => ({ order }));
  from = vi.fn(() => ({ select }));
  vi.mocked(createBrowserClient).mockReturnValue(
    { from } as unknown as ReturnType<typeof createBrowserClient>,
  );
});

describe("<MarketplaceGenerator />", () => {
  it("renders the marketplace form with all select fields populated", async () => {
    render(<MarketplaceGenerator />);
    await screen.findByText("Sample Product A");

    // Platform options: Tokopedia, Shopee, Lazada, TikTok Shop, Bukalapak.
    const platformSelect = screen.getByLabelText(
      /^Platform$/i,
    ) as HTMLSelectElement;
    const platformOptions = Array.from(platformSelect.options).map(
      (o) => o.value,
    );
    expect(platformOptions).toEqual([
      "tokopedia",
      "shopee",
      "lazada",
      "tiktok-shop",
      "bukalapak",
    ]);

    // Style options: Profesional, Kasual, Persuasif, Berbagi Cerita.
    const styleSelect = screen.getByLabelText(/^Gaya$/i) as HTMLSelectElement;
    const styleOptions = Array.from(styleSelect.options).map((o) => o.value);
    expect(styleOptions).toEqual([
      "profesional",
      "kasual",
      "persuasif",
      "berbagi-cerita",
    ]);

    // Length options: Pendek, Sedang, Panjang.
    const lengthSelect = screen.getByLabelText(/^Panjang$/i) as HTMLSelectElement;
    const lengthOptions = Array.from(lengthSelect.options).map(
      (o) => o.value,
    );
    expect(lengthOptions).toEqual(["pendek", "sedang", "panjang"]);
  });

  it("renders the marketplace result card (title, shortDescription, description, bulletPoints, tags, cta) on success", async () => {
    vi.mocked(generateMarketplaceDescription).mockResolvedValue({
      data: SAMPLE_MARKETPLACE,
    });

    render(<MarketplaceGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    // Card heading = the title.
    await screen.findByText(SAMPLE_MARKETPLACE.title);

    // shortDescription, description, bulletPoints, tags, cta all rendered.
    const card = screen.getByTestId("marketplace-card");
    expect(card).toBeInTheDocument();
    expect(card.textContent).toContain(SAMPLE_MARKETPLACE.shortDescription);
    expect(card.textContent).toContain(SAMPLE_MARKETPLACE.description);
    for (const point of SAMPLE_MARKETPLACE.bulletPoints) {
      expect(card.textContent).toContain(point);
    }
    for (const tag of SAMPLE_MARKETPLACE.tags) {
      expect(card.textContent).toContain(tag);
    }
    expect(card.textContent).toContain(SAMPLE_MARKETPLACE.cta);
  });

  it("copies the full description text to the clipboard when the copy button is clicked", async () => {
    vi.mocked(generateMarketplaceDescription).mockResolvedValue({
      data: SAMPLE_MARKETPLACE,
    });

    render(<MarketplaceGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await screen.findByText(SAMPLE_MARKETPLACE.title);

    // Find the copy button and click it.
    const copyButtons = screen.getAllByRole("button", { name: /copy/i });
    expect(copyButtons.length).toBeGreaterThan(0);
    fireEvent.click(copyButtons[0]!);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalled();
    });
  });

  it("shows error message in the result panel when generateMarketplaceDescription returns an error", async () => {
    vi.mocked(generateMarketplaceDescription).mockResolvedValue({
      error: "AI sedang sibuk, coba lagi nanti",
    });

    render(<MarketplaceGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByTestId("marketplace-error")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/AI sedang sibuk, coba lagi nanti/i),
    ).toBeInTheDocument();
  });

  it("shows empty state in the result panel when no results yet", async () => {
    render(<MarketplaceGenerator />);
    await screen.findByText("Sample Product A");

    expect(
      screen.getByText(/Pilih produk dan klik Generate/i),
    ).toBeInTheDocument();
  });

  it("shows 'Belum ada produk' link when no products returned from Supabase", async () => {
    order.mockResolvedValue({ data: [], error: null });

    render(<MarketplaceGenerator />);

    await waitFor(() => {
      expect(screen.getByText(/Belum ada produk/i)).toBeInTheDocument();
    });

    // The CTA is a link to /produk so the user can create their first
    // product without leaving the dashboard.
    const link = screen.getByRole("link", { name: /buat produk/i });
    expect(link).toHaveAttribute("href", "/produk");
  });

  it("forwards platform, style, length, includeSpecs, and targetAudience to the server action", async () => {
    vi.mocked(generateMarketplaceDescription).mockResolvedValue({
      data: SAMPLE_MARKETPLACE,
    });

    render(<MarketplaceGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.change(screen.getByLabelText(/^Platform$/i), {
      target: { value: "tokopedia" },
    });
    fireEvent.change(screen.getByLabelText(/^Gaya$/i), {
      target: { value: "persuasif" },
    });
    fireEvent.change(screen.getByLabelText(/^Panjang$/i), {
      target: { value: "panjang" },
    });
    // includeSpecs is a checkbox; the default is `true`, so we leave
    // it checked to verify the value flows through FormData.
    fireEvent.change(screen.getByLabelText(/Target Audiens/i), {
      target: { value: "Ibu muda 28-40" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await screen.findByText(SAMPLE_MARKETPLACE.title);

    expect(generateMarketplaceDescription).toHaveBeenCalledTimes(1);
    const formData = (
      vi.mocked(generateMarketplaceDescription).mock.calls[0]?.[0] as FormData
    );
    expect(formData.get("productId")).toBe(SAMPLE_PRODUCTS[0].id);
    expect(formData.get("platform")).toBe("tokopedia");
    expect(formData.get("style")).toBe("persuasif");
    expect(formData.get("length")).toBe("panjang");
    // includeSpecs default is true, so the value flows through as "true".
    expect(formData.get("includeSpecs")).toBe("true");
    expect(formData.get("targetAudience")).toBe("Ibu muda 28-40");
  });
});
