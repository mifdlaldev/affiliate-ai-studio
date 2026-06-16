// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateSocialCalendar,
  type GenerateSocialResult,
} from "@/lib/actions/social";
import { SocialGenerator } from "@/components/modules/social-generator";

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
vi.mock("@/lib/actions/social", () => ({
  generateSocialCalendar: vi.fn(),
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
 * Sample social calendar payload. Mirrors `SocialResult` from
 * `lib/actions/social.ts`. Seven day cards with the full per-day
 * shape (day, contentType, topic, caption, hashtags, bestTime).
 */
const SAMPLE_SOCIAL = {
  platform: "TikTok",
  days: [
    {
      day: 1,
      contentType: "Reels",
      topic: "Hook: 3 kesalahan skincare pagi",
      caption:
        "Hai bund! Sering skip skincare pagi? Ini 3 kesalahan yang sering kita lakukan tanpa sadar...",
      hashtags: ["#skincare", "#tipskincare", "#bundamuda"],
      bestTime: "07:00 WIB",
    },
    {
      day: 2,
      contentType: "Story",
      topic: "Polling: Kulitmu lagi kusam?",
      caption:
        "Cek kulitmu sekarang — pilih emoji yang paling cocok sama kondisi kulit kamu hari ini!",
      hashtags: ["#skincare", "#polling", "#glowup"],
      bestTime: "19:30 WIB",
    },
    {
      day: 3,
      contentType: "Carousel",
      topic: "5 bahan skincare yang wajib dihindari",
      caption:
        "Slide 1/5: Hindari 5 bahan ini kalau kulitmu sensitif. Save dulu biar nggak lupa!",
      hashtags: ["#skincare", "#bahanberbahaya", "#edukasikulit"],
      bestTime: "12:00 WIB",
    },
    {
      day: 4,
      contentType: "Reels",
      topic: "Before/after 14 hari pakai serum",
      caption:
        "Bukti nyata 14 hari konsisten pakai serum vitamin C 20%! Swipe buat lihat hasilnya.",
      hashtags: ["#beforeafter", "#serum", "#glowup"],
      bestTime: "20:00 WIB",
    },
    {
      day: 5,
      contentType: "Short",
      topic: "Myth vs Fact: Sunscreen di malam hari",
      caption:
        "Mitos atau fakta: masih perlu sunscreen di malam hari? Jawabannya bikin kamu kaget!",
      hashtags: ["#sunscreen", "#mythvsfact", "#skincaretips"],
      bestTime: "18:00 WIB",
    },
    {
      day: 6,
      contentType: "Story",
      topic: "Quiz: Jenis kulit kamu apa?",
      caption:
        "Yuk ikut quiz singkat ini buat tahu jenis kulit kamu: berminyak, kering, atau kombinasi?",
      hashtags: ["#quiz", "#jeniskulit", "#skincare"],
      bestTime: "10:00 WIB",
    },
    {
      day: 7,
      contentType: "Reels",
      topic: "Recap minggu ini + giveaway",
      caption:
        "Recap 7 hari konten skincare + giveaway spesial buat followers setia! Tag 2 teman kamu.",
      hashtags: ["#recap", "#giveaway", "#skincare"],
      bestTime: "21:00 WIB",
    },
  ],
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

describe("<SocialGenerator />", () => {
  it("renders the social form with product, platform, and tone selects populated", async () => {
    render(<SocialGenerator />);
    await screen.findByText("Sample Product A");

    // Platform options: TikTok, Instagram, YouTube, Twitter, Facebook.
    const platformSelect = screen.getByTestId(
      "social-platform",
    ) as HTMLSelectElement;
    const platformOptions = Array.from(platformSelect.options).map(
      (o) => o.value,
    );
    expect(platformOptions).toEqual([
      "tiktok",
      "instagram",
      "youtube",
      "twitter",
      "facebook",
    ]);

    // Tone options: Kasual, Profesional, Energik, Inspiratif, Edukatif.
    const toneSelect = screen.getByTestId("social-tone") as HTMLSelectElement;
    const toneOptions = Array.from(toneSelect.options).map((o) => o.value);
    expect(toneOptions).toEqual([
      "kasual",
      "profesional",
      "energik",
      "inspiratif",
      "edukatif",
    ]);
  });

  it("shows loading state in the result panel while generateSocialCalendar is in flight", async () => {
    // Never-resolving action keeps the component in the loading state
    // long enough for us to assert on the spinner copy.
    vi.mocked(generateSocialCalendar).mockImplementation(
      () => new Promise<GenerateSocialResult>(() => {}),
    );

    render(<SocialGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByTestId("social-product"), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    expect(await screen.findByTestId("social-loading")).toBeInTheDocument();
    expect(
      screen.getByText(/membuat kalender social media\.\.\./i),
    ).toBeInTheDocument();
  });

  it("renders 7 day cards with content type, topic, caption, hashtags, and best time on success", async () => {
    vi.mocked(generateSocialCalendar).mockResolvedValue({
      data: SAMPLE_SOCIAL,
    });

    render(<SocialGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByTestId("social-product"), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    // Wait for the result panel to appear and the day grid to render.
    await screen.findByTestId("social-result");
    await screen.findByTestId("social-days");

    // Exactly 7 day cards are rendered.
    const dayCards = screen.getAllByTestId("social-day-card");
    expect(dayCards).toHaveLength(7);

    // The full result panel shows every day's content type, topic,
    // caption, hashtags, and best posting time.
    const resultPanel = screen.getByTestId("social-result");
    for (const day of SAMPLE_SOCIAL.days) {
      expect(resultPanel.textContent).toContain(day.contentType);
      expect(resultPanel.textContent).toContain(day.topic);
      expect(resultPanel.textContent).toContain(day.caption);
      for (const tag of day.hashtags) {
        expect(resultPanel.textContent).toContain(tag);
      }
      expect(resultPanel.textContent).toContain(day.bestTime);
    }

    // Each day's hashtags are rendered inside their own scoped
    // testid (`social-day-hashtags-${day}`), so the user can target
    // a single day for copy / styling.
    for (const day of SAMPLE_SOCIAL.days) {
      expect(
        screen.getByTestId(`social-day-hashtags-${day.day}`),
      ).toBeInTheDocument();
    }
  });

  it("shows error message + retry button in the result panel when generateSocialCalendar returns an error", async () => {
    vi.mocked(generateSocialCalendar).mockResolvedValue({
      error: "AI sedang sibuk, coba lagi nanti",
    });

    render(<SocialGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByTestId("social-product"), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await waitFor(() => {
      expect(screen.getByTestId("social-error")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/AI sedang sibuk, coba lagi nanti/i),
    ).toBeInTheDocument();
  });

  it("copies a single day's caption + hashtags to the clipboard when the per-day copy button is clicked", async () => {
    vi.mocked(generateSocialCalendar).mockResolvedValue({
      data: SAMPLE_SOCIAL,
    });

    render(<SocialGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByTestId("social-product"), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    // Wait for the day cards to render before clicking the copy button.
    await screen.findAllByTestId("social-day-card");

    // Click the copy button on day 1.
    const copyButton = screen.getByTestId("social-day-copy-1");
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalled();
    });

    // The text written is caption + newline + space-separated hashtags.
    const dayOne = SAMPLE_SOCIAL.days[0];
    const expectedText = `${dayOne.caption}\n\n${dayOne.hashtags.join(" ")}`;
    expect(mockWriteText).toHaveBeenCalledWith(expectedText);
  });

  it("shows 'Belum ada produk' link when no products returned from Supabase", async () => {
    order.mockResolvedValue({ data: [], error: null });

    render(<SocialGenerator />);

    await waitFor(() => {
      expect(screen.getByText(/Belum ada produk/i)).toBeInTheDocument();
    });

    // The CTA is a link to /produk so the user can create their first
    // product without leaving the dashboard.
    const link = screen.getByRole("link", { name: /buat produk/i });
    expect(link).toHaveAttribute("href", "/produk");
  });

  it("forwards productId, platform, and tone to the server action via FormData", async () => {
    vi.mocked(generateSocialCalendar).mockResolvedValue({
      data: SAMPLE_SOCIAL,
    });

    render(<SocialGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.change(screen.getByTestId("social-product"), {
      target: { value: SAMPLE_PRODUCTS[0].id },
    });
    fireEvent.change(screen.getByTestId("social-platform"), {
      target: { value: "instagram" },
    });
    fireEvent.change(screen.getByTestId("social-tone"), {
      target: { value: "energik" },
    });
    fireEvent.click(screen.getByRole("button", { name: /generate/i }));

    await screen.findByTestId("social-result");

    expect(generateSocialCalendar).toHaveBeenCalledTimes(1);
    const formData = (
      vi.mocked(generateSocialCalendar).mock.calls[0]?.[0] as FormData
    );
    expect(formData.get("productId")).toBe(SAMPLE_PRODUCTS[0].id);
    expect(formData.get("platform")).toBe("instagram");
    expect(formData.get("tone")).toBe("energik");
  });
});
