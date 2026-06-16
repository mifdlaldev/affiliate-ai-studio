// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateLandingPage,
  type GenerateLandingResult,
} from "@/lib/actions/landing";
import { LandingGenerator } from "@/components/modules/landing-generator";

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
vi.mock("@/lib/actions/landing", () => ({
  generateLandingPage: vi.fn(),
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
 * Sample landing-page payload. Mirrors `LandingResult` from
 * `lib/actions/landing.ts`. Full 7-section shape: hero (headline +
 * subheadline + heroDescription), features (3 cards), pricing (3
 * plans), faq (3 questions), and cta.
 */
const SAMPLE_LANDING = {
  headline: "GlowLab Serum Vitamin C 20% — Kulit Cerah dalam 14 Hari",
  subheadline: "Serum premium dengan 20% Vitamin C murni + Niacinamide",
  heroDescription:
    "Dipercaya 12.000+ wanita Indonesia. Formulasi ringan yang cepat menyerap, aman untuk kulit sensitif, dan sudah teruji dermatologis.",
  features: [
    {
      title: "20% Vitamin C Murni",
      description:
        "Konsentrasi tinggi untuk hasil pencerahan maksimal tanpa iritasi.",
    },
    {
      title: "Diperkaya Niacinamide",
      description:
        "Membantu memudarkan noda hitam dan meratakan warna kulit.",
    },
    {
      title: "Tekstur Ringan & Cepat Meresap",
      description:
        "Tidak lengket, nyaman dipakai pagi dan malam hari.",
    },
  ],
  pricing: [
    {
      plan: "Starter (30ml)",
      price: "Rp 149.000",
      features: ["1 botol serum 30ml", "Gratis ongkir Jabodetabek"],
    },
    {
      plan: "Best Seller (60ml)",
      price: "Rp 269.000",
      features: [
        "2 botol serum 30ml",
        "Hemat Rp 29.000",
        "Gratis ongkir seluruh Indonesia",
      ],
    },
    {
      plan: "Bundle (90ml)",
      price: "Rp 379.000",
      features: [
        "3 botol serum 30ml",
        "Bonus pouch GlowLab",
        "Garansi uang kembali 30 hari",
      ],
    },
  ],
  faq: [
    {
      question: "Aman untuk kulit sensitif?",
      answer:
        "Ya, sudah teruji dermatologis dan bebas alkohol, paraben, serta pewangi buatan.",
    },
    {
      question: "Berapa lama sampai terlihat hasilnya?",
      answer:
        "Kebanyakan pengguna melihat kulit lebih cerah merata dalam 14 hari pemakaian rutin.",
    },
    {
      question: "Bisa dipakai saat hamil?",
      answer:
        "Vitamin C topical aman untuk ibu hamil. Tetap konsultasikan dengan dokter jika ada kondisi khusus.",
    },
  ],
  cta: "Pesan GlowLab Serum hari ini — stok terbatas, gratis ongkir ke seluruh Indonesia!",
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

describe("<LandingGenerator />", () => {
  it("renders the landing form with product and tone selects populated", async () => {
    render(<LandingGenerator />);
    await screen.findByText("Sample Product A");

    // Tone options: Profesional, Santai, Persuasif, Edukatif.
    const toneSelect = screen.getByLabelText(
      /tone penulisan/i,
    ) as HTMLSelectElement;
    const toneOptions = Array.from(toneSelect.options).map((o) => o.value);
    expect(toneOptions).toEqual([
      "profesional",
      "santai",
      "persuasif",
      "edukatif",
    ]);

    // Generate button is present.
    expect(
      screen.getByRole("button", { name: /generate/i }),
    ).toBeInTheDocument();
  });

  it("shows loading state in the result panel while generateLandingPage is in flight", async () => {
    // Never-resolving action keeps the component in the loading state
    // long enough for us to assert on the spinner copy.
    vi.mocked(generateLandingPage).mockImplementation(
      () => new Promise<GenerateLandingResult>(() => {}),
    );

    render(<LandingGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(await screen.findByTestId("landing-loading")).toBeInTheDocument();
    expect(
      screen.getByText(/membuat landing page\.\.\./i),
    ).toBeInTheDocument();
  });

  it("renders all 7 sections (headline, subheadline, features, pricing, FAQ, CTA) on success", async () => {
    vi.mocked(generateLandingPage).mockResolvedValue({
      data: SAMPLE_LANDING,
    });

    render(<LandingGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    // Wait for the landing card to appear.
    const card = await screen.findByTestId("landing-card");
    expect(card).toBeInTheDocument();

    // Headline + subheadline are visible.
    expect(screen.getByTestId("landing-headline")).toHaveTextContent(
      SAMPLE_LANDING.headline,
    );
    expect(screen.getByTestId("landing-subheadline")).toHaveTextContent(
      SAMPLE_LANDING.subheadline,
    );

    // Hero description is rendered.
    expect(screen.getByTestId("landing-hero-description")).toHaveTextContent(
      SAMPLE_LANDING.heroDescription,
    );

    // Features grid shows every feature (title + description).
    const featuresGrid = screen.getByTestId("landing-features-grid");
    for (const feature of SAMPLE_LANDING.features) {
      expect(featuresGrid.textContent).toContain(feature.title);
      expect(featuresGrid.textContent).toContain(feature.description);
    }

    // Pricing table shows every plan (plan + price + each feature).
    const pricingTable = screen.getByTestId("landing-pricing-table");
    for (const plan of SAMPLE_LANDING.pricing) {
      expect(pricingTable.textContent).toContain(plan.plan);
      expect(pricingTable.textContent).toContain(plan.price);
      for (const feature of plan.features) {
        expect(pricingTable.textContent).toContain(feature);
      }
    }

    // FAQ accordion shows every question + answer.
    const faqAccordion = screen.getByTestId("landing-faq-accordion");
    for (const item of SAMPLE_LANDING.faq) {
      expect(faqAccordion.textContent).toContain(item.question);
      expect(faqAccordion.textContent).toContain(item.answer);
    }

    // CTA line is rendered.
    expect(screen.getByTestId("landing-cta")).toHaveTextContent(
      SAMPLE_LANDING.cta,
    );
  });

  it("shows error message in the result panel when generateLandingPage returns an error", async () => {
    vi.mocked(generateLandingPage).mockResolvedValue({
      error: "AI sedang sibuk, coba lagi nanti",
    });

    render(<LandingGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByTestId("landing-error")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/AI sedang sibuk, coba lagi nanti/i),
    ).toBeInTheDocument();
  });

  it("copies the full landing page (headline, hero, features, pricing, FAQ, CTA) to the clipboard when the copy button is clicked", async () => {
    vi.mocked(generateLandingPage).mockResolvedValue({
      data: SAMPLE_LANDING,
    });

    render(<LandingGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    // Wait for the landing card to appear, then click the copy button.
    await screen.findByTestId("landing-card");
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalled();
    });

    // The full text contains the headline, every section, and the CTA.
    const writtenText = mockWriteText.mock.calls[0]?.[0] as string;
    expect(writtenText).toContain(SAMPLE_LANDING.headline);
    expect(writtenText).toContain(SAMPLE_LANDING.subheadline);
    expect(writtenText).toContain(SAMPLE_LANDING.heroDescription);
    for (const feature of SAMPLE_LANDING.features) {
      expect(writtenText).toContain(feature.title);
    }
    for (const plan of SAMPLE_LANDING.pricing) {
      expect(writtenText).toContain(plan.plan);
    }
    for (const item of SAMPLE_LANDING.faq) {
      expect(writtenText).toContain(item.question);
    }
    expect(writtenText).toContain(SAMPLE_LANDING.cta);
  });

  it("shows 'Belum ada produk' link when no products returned from Supabase", async () => {
    order.mockResolvedValue({ data: [], error: null });

    render(<LandingGenerator />);

    await waitFor(() => {
      expect(screen.getByText(/Belum ada produk/i)).toBeInTheDocument();
    });

    // The CTA is a link to /produk so the user can create their first
    // product without leaving the dashboard.
    const link = screen.getByRole("link", { name: /buat produk/i });
    expect(link).toHaveAttribute("href", "/produk");
  });

  it("forwards productId and tone to the server action via FormData", async () => {
    vi.mocked(generateLandingPage).mockResolvedValue({
      data: SAMPLE_LANDING,
    });

    render(<LandingGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByLabelText(/^Produk$/i), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.change(screen.getByLabelText(/tone penulisan/i), {
      target: { value: "persuasif" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await screen.findByTestId("landing-card");

    expect(generateLandingPage).toHaveBeenCalledTimes(1);
    const formData = (
      vi.mocked(generateLandingPage).mock.calls[0]?.[0] as FormData
    );
    expect(formData.get("productId")).toBe(SAMPLE_PRODUCTS[0].id);
    expect(formData.get("tone")).toBe("persuasif");
  });
});
