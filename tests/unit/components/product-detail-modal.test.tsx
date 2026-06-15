// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ProductDetailModal } from "@/components/shared/product-detail-modal";
import type { Database } from "@/lib/supabase/types";

/**
 * Full row sample — matches the shape of `Database["public"]["Tables"]
 * ["products"]["Row"]` exactly so TypeScript doesn't reject the object.
 * Only the 7 user-visible fields and `image_url` / `created_at` are
 * exercised by the assertions below; the remaining columns
 * (`reference_link`, `updated_at`, `user_id`) are present so the type
 * is satisfied but never read by the modal.
 */
const sampleProduct: Database["public"]["Tables"]["products"]["Row"] = {
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
  reference_link: null,
  updated_at: "2026-06-12T10:00:00Z",
  user_id: "22222222-2222-2222-2222-222222222222",
};

describe("ProductDetailModal", () => {
  it("renders all 7 Detail Informasi fields when open", async () => {
    render(
      <ProductDetailModal
        product={sampleProduct}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    // shadcn Dialog mounts the content via a Portal on document.body, so
    // we use `findByText` (which polls) rather than `getByText` to
    // tolerate the async portal mount.
    expect(await screen.findByText("Sample Product A")).toBeInTheDocument();
    expect(await screen.findByText("Electronics")).toBeInTheDocument();
    expect(await screen.findByText("BrandX")).toBeInTheDocument();
    expect(await screen.findByText("Rp 100.000")).toBeInTheDocument();
    expect(await screen.findByText("Young adults")).toBeInTheDocument();
    expect(await screen.findByText("Long battery life")).toBeInTheDocument();
    // `benefits` contains a literal newline; testing-library's default
    // normalizer collapses whitespace, so the rendered "Lightweight\n
    // Waterproof" matches the input "Lightweight\nWaterproof" after
    // normalization. If the newline is preserved (whitespace-pre-line),
    // both sides collapse to "Lightweight Waterproof" and still match.
    expect(
      await screen.findByText((content) => {
        const normalized = content.replace(/\s+/g, " ").trim();
        return normalized === "Lightweight Waterproof";
      }),
    ).toBeInTheDocument();
  });

  it("renders em-dash for null and empty Detail Informasi fields", async () => {
    const nullProduct: Database["public"]["Tables"]["products"]["Row"] = {
      id: "33333333-3333-3333-3333-333333333333",
      name: "Minimal Product",
      category: null,
      brand: null,
      price: null,
      target_market: null,
      usp: null,
      benefits: null,
      image_url: null,
      reference_link: null,
      created_at: "2026-06-12T10:00:00Z",
      updated_at: "2026-06-12T10:00:00Z",
      user_id: "00000000-0000-0000-0000-000000000000",
    };

    render(
      <ProductDetailModal
        product={nullProduct}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    // All 6 nullable Detail Informasi fields (Kategori, Brand, Harga,
    // Target Pasar, USP, Benefits) should render the em-dash "—" via
    // `formatValue`. Wait for the portal to mount before counting.
    await waitFor(() => {
      const emDashes = screen.getAllByText("—");
      expect(emDashes.length).toBeGreaterThanOrEqual(6);
    });
  });

  it("preserves newlines in benefits field via whitespace-pre-line", async () => {
    const multilineProduct: Database["public"]["Tables"]["products"]["Row"] =
      {
        id: "44444444-4444-4444-4444-444444444444",
        name: "Product With Benefits",
        category: "Health",
        brand: "BrandY",
        price: "Rp 50.000",
        target_market: "Everyone",
        usp: "Great quality",
        benefits: "Benefit 1\nBenefit 2\nBenefit 3",
        image_url: null,
        reference_link: null,
        created_at: "2026-06-12T10:00:00Z",
        updated_at: "2026-06-12T10:00:00Z",
        user_id: "00000000-0000-0000-0000-000000000000",
      };

    render(
      <ProductDetailModal
        product={multilineProduct}
        open={true}
        onOpenChange={() => {}}
      />,
    );

    // The benefits <dd> should render the multi-line text. Newlines are
    // preserved visually by `whitespace-pre-line`; when read via
    // textContent, they appear as `\n` in the string. Use a function
    // matcher to compare normalized whitespace.
    await waitFor(() => {
      const benefitsValue = screen.getByText((_content, element) => {
        if (!element) return false;
        return (
          element.tagName === "DD" &&
          element.textContent !== null &&
          element.textContent.replace(/\s+/g, " ").trim() ===
            "Benefit 1 Benefit 2 Benefit 3"
        );
      });
      expect(benefitsValue).toBeInTheDocument();
      expect(benefitsValue.className).toContain("whitespace-pre-line");
    });
  });

  it("formats the created_at date in Indonesian locale (id-ID, dateStyle: long)", async () => {
    // created_at is a specific UTC timestamp so the rendered Indonesian date
    // is deterministic regardless of the test runner's timezone.
    const productWithDate: Database["public"]["Tables"]["products"]["Row"] = {
      id: "55555555-5555-5555-5555-555555555555",
      name: "Dated Product",
      category: "Health",
      brand: "BrandZ",
      price: "Rp 50.000",
      target_market: "Everyone",
      usp: "Great quality",
      benefits: "Benefit",
      image_url: null,
      reference_link: null,
      // June 12, 2026 at 10:00 UTC. In Indonesian long format, this renders
      // as "12 Juni 2026".
      created_at: "2026-06-12T10:00:00.000Z",
      updated_at: "2026-06-12T10:00:00.000Z",
      user_id: "00000000-0000-0000-0000-000000000000",
    };
    render(
      <ProductDetailModal
        product={productWithDate}
        open={true}
        onOpenChange={() => {}}
      />,
    );
    // The footer text is "Disimpan: 12 Juni 2026". Assert the date part.
    await waitFor(() => {
      expect(screen.getByText(/Disimpan:\s*12 Juni 2026/)).toBeInTheDocument();
    });
  });
});
