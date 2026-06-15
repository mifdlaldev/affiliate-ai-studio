// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProductList } from "@/components/shared/product-list";
import { createBrowserClient } from "@/lib/supabase/client";

/**
 * Mocks for `createBrowserClient`. We don't want a real Supabase client in
 * unit tests; the chain is rebuilt in `beforeEach` so each test gets a
 * fresh set of call-history entries to assert on.
 */
vi.mock("@/lib/supabase/client", () => ({
  createBrowserClient: vi.fn(),
}));

/**
 * `ProductList` imports `deleteProduct` from `@/lib/actions/product`,
 * which transitively imports the OpenAI client. That client refuses to
 * construct inside happy-dom (it would expose the API key in a
 * browser-like env), so we stub the entire actions module out.
 */
vi.mock("@/lib/actions/product", () => ({
  deleteProduct: vi.fn(),
}));

/**
 * Spy on the modal so Task 3's "Hapus click does not open the modal" test
 * can assert on its `product` prop. The placeholder modal stub always
 * renders `<div data-testid="product-detail-modal" className="hidden" />`
 * — it never reflects the `open` prop — so spying on props is the only
 * way to detect that the parent re-rendered with a non-null product.
 *
 * The mock keeps the same `data-testid` so the Task 2 smoke test
 * ("modal is in the document after a card click") still passes.
 */
const modalPropsSpy = vi.fn();
vi.mock("@/components/shared/product-detail-modal", () => ({
  ProductDetailModal: (props: {
    product: unknown;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => {
    modalPropsSpy(props);
    return <div data-testid="product-detail-modal" className="hidden" />;
  },
}));

/**
 * Three sample products covering all ten fields the future detail modal
 * will need. Field shapes match the `products` table in
 * `lib/supabase/types.ts` (id, name are required, everything else is
 * nullable).
 */
const SAMPLE_PRODUCTS = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Sample Product A",
    category: "Electronics",
    brand: "BrandX",
    price: "Rp 100.000",
    target_market: "Young adults",
    usp: "Long battery life",
    benefits: "Lightweight\nWaterproof",
    image_url: null,
    created_at: "2026-06-12T10:00:00Z",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Sample Product B",
    category: "Fashion",
    brand: "BrandY",
    price: "Rp 200.000",
    target_market: "Working professionals",
    usp: "Premium quality",
    benefits: "Handcrafted\nSustainable materials",
    image_url: "https://example.com/b.jpg",
    created_at: "2026-06-11T10:00:00Z",
  },
  {
    id: "33333333-3333-3333-3333-333333333333",
    name: "Sample Product C",
    category: "Beauty",
    brand: "BrandZ",
    price: "Rp 50.000",
    target_market: "Teenagers",
    usp: "Affordable everyday use",
    benefits: "Natural ingredients",
    image_url: null,
    created_at: "2026-06-10T10:00:00Z",
  },
];

describe("ProductList", () => {
  let order: ReturnType<typeof vi.fn>;
  let select: ReturnType<typeof vi.fn>;
  let from: ReturnType<typeof vi.fn>;
  let mockClient: { from: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    // Resolve the final `await supabase.from(...).select(...).order(...)` to
    // our sample dataset. Each step of the chain is its own vi.fn so we
    // can assert on the call arguments (e.g. the select column list).
    order = vi.fn().mockResolvedValue({ data: SAMPLE_PRODUCTS, error: null });
    select = vi.fn(() => ({ order }));
    from = vi.fn(() => ({ select }));
    mockClient = { from };

    vi.mocked(createBrowserClient).mockReturnValue(
      mockClient as unknown as ReturnType<typeof createBrowserClient>,
    );
  });

  it("renders the saved products and eagerly fetches every products-table column", async () => {
    render(<ProductList refreshKey={0} />);

    // Wait for the products to load. We assert on `name` because that's
    // the only field the existing card actually renders. If the fetch
    // never resolves (e.g. mock not wired up), this times out.
    await screen.findByText("Sample Product A");
    await screen.findByText("Sample Product B");
    await screen.findByText("Sample Product C");

    // Sanity-check the chain: we hit the `products` table exactly once.
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("products");
    expect(select).toHaveBeenCalledTimes(1);

    // The detail modal (Task 5) reads the full DB row, so the list must
    // eagerly fetch every column — not just the 4 fields the card UI
    // displays. Assert the full 13-column projection is selected.
    const selectArg = select.mock.calls[0]?.[0] as string | undefined;
    expect(selectArg).toBeDefined();
    expect(selectArg).toContain("id");
    expect(selectArg).toContain("name");
    expect(selectArg).toContain("category");
    expect(selectArg).toContain("brand");
    expect(selectArg).toContain("price");
    expect(selectArg).toContain("target_market");
    expect(selectArg).toContain("usp");
    expect(selectArg).toContain("benefits");
    expect(selectArg).toContain("image_url");
    expect(selectArg).toContain("reference_link");
    expect(selectArg).toContain("created_at");
    expect(selectArg).toContain("updated_at");
    expect(selectArg).toContain("user_id");
  });

  it("opens the detail modal placeholder when a product card is clicked", async () => {
    render(<ProductList refreshKey={0} />);

    const cardName = await screen.findByText("Sample Product A");
    const card = cardName.closest('[role="button"]');
    expect(card).not.toBeNull();
    fireEvent.click(card as HTMLElement);

    // The placeholder modal deliberately uses data-testid rather than
    // shadcn Dialog internals so this assertion stays stable across the
    // Task 5/6 refactors.
    expect(screen.getByTestId("product-detail-modal")).toBeInTheDocument();
  });

  it("does not open the detail modal when the Hapus button is clicked (no event bubbling)", async () => {
    const originalConfirm = window.confirm;
    window.confirm = () => false;

    render(<ProductList refreshKey={0} />);

    await screen.findByText("Sample Product A");

    const hapusButtons = screen.getAllByRole("button", { name: /hapus/i });
    fireEvent.click(hapusButtons[0]!);

    // If the click bubbles to the card's onClick, the modal re-renders
    // with `product: <the clicked product>`. With the fix, no re-render
    // happens — the last call is the initial mount with `product: null`.
    const lastProps = modalPropsSpy.mock.calls.at(-1)?.[0] as
      | { product: unknown; open: boolean }
      | undefined;
    expect(lastProps?.product).toBeNull();
    expect(lastProps?.open).toBe(false);

    window.confirm = originalConfirm;
  });

  it("opens the detail modal when the card receives an Enter keydown", async () => {
    render(<ProductList refreshKey={0} />);

    // The card exposes itself as a button via `role="button"` + aria-label
    // "Lihat detail Sample Product A". A regex on the product name is
    // stable across copy changes to the prefix.
    const card = await screen.findByRole("button", {
      name: /sample product a/i,
    });
    card.focus();
    fireEvent.keyDown(card, { key: "Enter" });

    // A working keyboard handler should call the same `setSelectedProduct`
    // the click handler does, which re-renders the parent and re-invokes
    // the modal mock with a non-null product. Without the handler the
    // spy is never re-called and the last call still has `product: null`.
    const lastProps = modalPropsSpy.mock.calls.at(-1)?.[0] as
      | { product: { name: string } | null; open: boolean }
      | undefined;
    expect(lastProps?.product).not.toBeNull();
    expect(lastProps?.product?.name).toBe("Sample Product A");
    expect(lastProps?.open).toBe(true);
  });

  it("opens the detail modal when the card receives a Space keydown", async () => {
    render(<ProductList refreshKey={0} />);

    const card = await screen.findByRole("button", {
      name: /sample product a/i,
    });
    card.focus();
    fireEvent.keyDown(card, { key: " " });

    // Space must trigger the same `setSelectedProduct` path; the
    // handler also calls `e.preventDefault()` so Space doesn't scroll.
    const lastProps = modalPropsSpy.mock.calls.at(-1)?.[0] as
      | { product: { name: string } | null; open: boolean }
      | undefined;
    expect(lastProps?.product).not.toBeNull();
    expect(lastProps?.product?.name).toBe("Sample Product A");
    expect(lastProps?.open).toBe(true);
  });

  it("passes open=false and product=null to the modal on initial mount", async () => {
    render(<ProductList refreshKey={0} />);

    // Wait for the populated grid branch to render — that's where the
    // modal sibling lives. Without this, the last spy call is from the
    // loading branch (no modal in the tree yet).
    await screen.findByText("Sample Product A");

    // The Dialog's `open` is wired to `!!selectedProduct`, which is
    // null on first mount, so the parent drives the open state and the
    // modal starts closed. The spy is invoked on every render of the
    // modal, so the last call reflects the current prop state.
    expect(modalPropsSpy).toHaveBeenCalled();
    const lastCall = modalPropsSpy.mock.calls.at(-1)?.[0] as
      | { product: unknown; open: boolean; onOpenChange: (open: boolean) => void }
      | undefined;
    expect(lastCall).toBeDefined();
    expect(lastCall?.open).toBe(false);
    expect(lastCall?.product).toBeNull();
    // Handler must be a function so the Dialog can call it on close
    // (ESC, X, click-outside, Tutup button).
    expect(typeof lastCall?.onOpenChange).toBe("function");
  });

  it("passes open=true and the selected product to the modal after a card click", async () => {
    render(<ProductList refreshKey={0} />);

    const cardName = await screen.findByText("Sample Product A");
    const card = cardName.closest('[role="button"]');
    expect(card).not.toBeNull();
    fireEvent.click(card as HTMLElement);

    // The click handler runs `setSelectedProduct(product)`, React
    // re-renders, and the modal mock is invoked again. The last call's
    // props should reflect the new state with the full product so the
    // modal has all 10 fields to display.
    expect(modalPropsSpy).toHaveBeenCalled();
    const lastCall = modalPropsSpy.mock.calls.at(-1)?.[0] as
      | {
          product: { name: string; id: string } | null;
          open: boolean;
        }
      | undefined;
    expect(lastCall).toBeDefined();
    expect(lastCall?.open).toBe(true);
    expect(lastCall?.product).not.toBeNull();
    expect(lastCall?.product).toEqual(
      expect.objectContaining({ name: "Sample Product A" }),
    );
  });
});
