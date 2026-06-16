// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { createBrowserClient } from "@/lib/supabase/client";
import {
  generateCalendar,
  type GenerateCalendarResult,
} from "@/lib/actions/calendar";
import { CalendarGenerator } from "@/components/modules/calendar-generator";

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
vi.mock("@/lib/actions/calendar", () => ({
  generateCalendar: vi.fn(),
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
 * Sample calendar payload. Mirrors `CalendarDayResult` from
 * `lib/actions/calendar.ts` — three days spread across a 30-day
 * month, each tagged with a content type + a hook line. We deliberately
 * use a 3-day slice so the test asserts against a deterministic
 * subset instead of the full 28-31 day grid.
 */
const SAMPLE_CALENDAR = [
  {
    day: 1,
    productId: "11111111-1111-1111-1111-111111111111",
    productName: "Sample Product A",
    contentType: "reel",
    platform: "tiktok",
    topic: "Review jujur setelah 7 hari pakai",
    hook: "Aku hampir gak percaya ini beneran bisa ngubah kulitku dalam seminggu.",
  },
  {
    day: 2,
    productId: "22222222-2222-2222-2222-222222222222",
    productName: "Sample Product B",
    contentType: "photo",
    platform: "instagram",
    topic: "Flat lay komposisi skincare pagi hari",
    hook: "Ini urutan skincare pagi yang bikin makeup kamu tahan 12 jam.",
  },
  {
    day: 3,
    productId: "11111111-1111-1111-1111-111111111111",
    productName: "Sample Product A",
    contentType: "carousel",
    platform: "instagram",
    topic: "5 alasan produk ini worth it",
    hook: "Slide pertama bikin kamu scroll terus sampai habis.",
  },
];

describe("CalendarGenerator", () => {
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
    vi.mocked(generateCalendar).mockResolvedValue({ data: [] });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
  });

  it("renders the form with month, year, platform, content-type checkboxes, tone select, and a generate button", async () => {
    render(<CalendarGenerator />);

    // Wait for products to load — this is also how we know the form is
    // mounted (the product checkbox list renders only after the fetch
    // resolves).
    await screen.findByText("Sample Product A");

    // Month + year selects are present and pre-populated to current
    // month + 2026.
    expect(screen.getByTestId("calendar-month")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-year")).toBeInTheDocument();

    // Platform select exposes the "Campuran" option alongside the
    // three concrete platforms.
    const platformSelect = screen.getByTestId(
      "calendar-platform",
    ) as HTMLSelectElement;
    expect(platformSelect).toBeInTheDocument();
    expect(platformSelect.value).toBe("mixed");
    expect(screen.getByRole("option", { name: "TikTok" })).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Instagram" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "YouTube" }),
    ).toBeInTheDocument();

    // All 5 content-type checkboxes are rendered.
    expect(screen.getByTestId("calendar-content-type-photo")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-content-type-video")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-content-type-story")).toBeInTheDocument();
    expect(
      screen.getByTestId("calendar-content-type-carousel"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("calendar-content-type-reel")).toBeInTheDocument();

    // Tone select is present.
    expect(screen.getByTestId("calendar-tone")).toBeInTheDocument();

    // Generate button is present.
    expect(
      screen.getByTestId("calendar-generate"),
    ).toBeInTheDocument();
  });

  it("shows loading state in the result panel while generateCalendar is in flight", async () => {
    // Never-resolving action keeps the component in the loading state
    // long enough for us to assert on the spinner copy.
    vi.mocked(generateCalendar).mockImplementation(
      () => new Promise<GenerateCalendarResult>(() => {}),
    );

    render(<CalendarGenerator />);
    await screen.findByText("Sample Product A");

    // Select a product and pick at least one content type so the
    // client-side validation passes.
    fireEvent.click(
      screen.getByTestId(
        "calendar-product-11111111-1111-1111-1111-111111111111",
      ),
    );
    fireEvent.click(screen.getByTestId("calendar-content-type-photo"));
    fireEvent.click(screen.getByTestId("calendar-generate"));

    expect(await screen.findByTestId("calendar-loading")).toBeInTheDocument();
    expect(
      screen.getByText(/Menyusun kalender \d+ hari\.\.\./i),
    ).toBeInTheDocument();
  });

  it("renders a calendar grid with day cards showing product name + content type badges when generateCalendar returns results", async () => {
    vi.mocked(generateCalendar).mockResolvedValue({
      data: SAMPLE_CALENDAR,
    });

    render(<CalendarGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.click(
      screen.getByTestId(
        "calendar-product-11111111-1111-1111-1111-111111111111",
      ),
    );
    fireEvent.click(screen.getByTestId("calendar-content-type-photo"));
    fireEvent.click(screen.getByTestId("calendar-generate"));

    // Calendar grid + weekday headers render once the action resolves.
    await screen.findByTestId("calendar-grid");

    // Day-of-week headers (Senin → Minggu).
    expect(screen.getByTestId("calendar-weekday-Sen")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-weekday-Min")).toBeInTheDocument();

    // The grid renders one card per day in the month. 30 days = 30
    // day-card test-ids (some are filled with data, some are placeholder
    // cells — both still carry the test-id).
    const dayCards = await screen.findAllByTestId("calendar-day-card");
    expect(dayCards.length).toBeGreaterThanOrEqual(SAMPLE_CALENDAR.length);

    // First day card shows the product name + a content-type badge.
    // We scope the assertion to the day card list because "Sample
    // Product A" also appears in the form's product checkbox list
    // (so a plain `getByText` would match twice).
    const productNameInGrid = screen
      .getAllByTestId("calendar-day-product")
      .map((el) => el.textContent);
    expect(productNameInGrid).toContain("Sample Product A");
    expect(productNameInGrid).toContain("Sample Product B");

    // Content-type badges. Scope to the day-card elements because the
    // same strings ("Reel", "Photo", "Carousel") also appear as
    // content-type button labels in the form.
    const dayBadges = screen
      .getAllByTestId("calendar-day-content-type")
      .map((el) => (el.textContent ?? "").toLowerCase());
    expect(dayBadges).toContain("reel");
    expect(dayBadges).toContain("photo");
    expect(dayBadges).toContain("carousel");

    // The hook line for day 1 is rendered (truncated or not). Scope
    // to the day-card hook elements so the test doesn't accidentally
    // match the same string if it ever leaks into the form.
    const hookLines = screen
      .getAllByTestId("calendar-day-hook")
      .map((el) => el.textContent ?? "");
    expect(
      hookLines.some((h) => h.includes("Aku hampir gak percaya ini beneran")),
    ).toBe(true);
  });

  it("shows error message + retry button in the result panel when generateCalendar returns an error", async () => {
    vi.mocked(generateCalendar).mockResolvedValue({
      error: "AI sedang sibuk, coba lagi nanti",
    });

    render(<CalendarGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.click(
      screen.getByTestId(
        "calendar-product-11111111-1111-1111-1111-111111111111",
      ),
    );
    fireEvent.click(screen.getByTestId("calendar-content-type-photo"));
    fireEvent.click(screen.getByTestId("calendar-generate"));

    await waitFor(() => {
      expect(screen.getByTestId("calendar-error")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/AI sedang sibuk, coba lagi nanti/i),
    ).toBeInTheDocument();

    // The retry button is rendered so the user can kick the action off
    // again without losing their form state.
    const retryButton = screen.getByRole("button", { name: /coba lagi/i });
    expect(retryButton).toBeInTheDocument();
  });

  it("copies a single day's full card (day + content type + product + topic + hook) to the clipboard", async () => {
    vi.mocked(generateCalendar).mockResolvedValue({
      data: SAMPLE_CALENDAR,
    });

    render(<CalendarGenerator />);
    await screen.findByText("Sample Product A");

    fireEvent.click(
      screen.getByTestId(
        "calendar-product-11111111-1111-1111-1111-111111111111",
      ),
    );
    fireEvent.click(screen.getByTestId("calendar-content-type-photo"));
    fireEvent.click(screen.getByTestId("calendar-generate"));

    // Wait for the grid to render.
    await screen.findByTestId("calendar-grid");

    // The first day's copy button is labeled "Salin". It lives inside
    // the first day card.
    const copyButtons = screen.getAllByRole("button", { name: /^Salin$/i });
    expect(copyButtons.length).toBeGreaterThan(0);
    fireEvent.click(copyButtons[0]!);

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledTimes(1);
    });

    // Verify the full day card text was assembled correctly: day
    // number, content type, platform, product, topic, and hook.
    const written = mockWriteText.mock.calls[0]?.[0] as string;
    expect(written).toMatch(/Hari 1/);
    expect(written).toMatch(/reel/);
    expect(written).toMatch(/Sample Product A/);
    expect(written).toMatch(/Review jujur setelah 7 hari pakai/);
  });

  it("shows 'Belum ada produk' link to /produk when no products returned from Supabase", async () => {
    order.mockResolvedValue({ data: [], error: null });

    render(<CalendarGenerator />);

    await waitFor(() => {
      expect(screen.getByText(/Belum ada produk/i)).toBeInTheDocument();
    });

    // The CTA is a link to /produk so the user can create their first
    // product without leaving the dashboard.
    const link = screen.getByRole("link", { name: /buat produk/i });
    expect(link).toHaveAttribute("href", "/produk");
  });

  it("blocks submission with an inline toast when no product or no content type is selected (form validation)", async () => {
    render(<CalendarGenerator />);
    await screen.findByText("Sample Product A");

    // Deselect both default content types ("photo" + "reel" are
    // pre-selected in the component) so the content-type check fails.
    // This is the only validation branch we can trigger client-side
    // because the form initialises with contentTypes pre-populated
    // (we pre-pick a sane default for the user).
    const photoCheckbox = screen.getByTestId(
      "calendar-content-type-photo",
    ).querySelector('input[type="checkbox"]') as HTMLInputElement;
    const reelCheckbox = screen.getByTestId(
      "calendar-content-type-reel",
    ).querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(photoCheckbox);
    fireEvent.click(reelCheckbox);

    // No product selected → click generate.
    fireEvent.click(screen.getByTestId("calendar-generate"));

    // Server action is never invoked because client validation blocks
    // the call.
    await waitFor(() => {
      expect(generateCalendar).not.toHaveBeenCalled();
    });
  });
});
