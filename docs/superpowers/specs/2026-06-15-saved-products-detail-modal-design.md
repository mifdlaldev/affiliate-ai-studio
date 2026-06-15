# Design: View-Only Detail Modal untuk Saved Products

## Context

Section "Produk Tersimpan" di `/produk` saat ini cuma render card dengan field minimal (image, name, category, brand, created_at). Field "Detail Informasi" (price, target_market, usp, benefits) yang di-generate AI di Product Studio tidak pernah accessible setelah produk di-save. User harus re-analyze produk untuk lihat field tersebut.

## Goal

Setelah save, user bisa akses semua Detail Informasi tanpa re-analyze, via dialog modal yang terbuka saat card di-klik.

## Decisions (sudah disetujui user)

- **View-only** (no edit) — modal cuma display
- **Trigger** — whole card click (kecuali tombol Hapus)
- **Approach** — A: Eager fetch all fields + dedicated `ProductDetailModal` component

## Component Structure

### New File: `components/shared/product-detail-modal.tsx`

Exports:
```typescript
interface ProductDetailModalProps {
  product: ProductWithDetails | null;  // null = modal closed
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
```

Uses:
- `components/ui/dialog.tsx` (shadcn Dialog — already installed)
- `components/ui/dialog.tsx` primitives: `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription`
- Phosphor `X` icon for close button

Renders:
- Header: image (jika ada) + name + (brand · category)
- Body: 7 field rows (Kategori, Brand, Harga, Target Pasar, USP, Benefits)
- Footer: "Disimpan: {created_at formatted}" + tombol Tutup (optional, ESC/X juga close)

### Modified File: `components/shared/product-list.tsx`

Changes:
- Update `Product` interface → rename to `ProductWithDetails` + add `price, target_market, usp, benefits` (all `string | null`)
- Update supabase query: `.select("id, name, category, brand, price, target_market, usp, benefits, image_url, created_at")`
- Add state: `const [selectedProduct, setSelectedProduct] = useState<ProductWithDetails | null>(null)`
- Card: 
  - `onClick={() => setSelectedProduct(product)}`
  - `role="button"`, `tabIndex={0}`, `aria-label={\`Lihat detail ${product.name}\`}`
  - `onKeyDown`: Enter/Space → setSelectedProduct
  - `cursor-pointer`, `hover:shadow-md transition-shadow` untuk affordance
- Tombol Hapus: 
  - Existing onClick → wrap dengan `e.stopPropagation()` di awal
- Render `<ProductDetailModal>` at the end of component, outside the grid

## Modal Content Layout

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  [Image]   Product Name              [X]        │
│            Brand · Category                       │
│                                                  │
├──────────────────────────────────────────────────┤
│  Detail Informasi                                │
│                                                  │
│  Kategori        [value or —]                    │
│  Brand           [value or —]                    │
│  Harga           [value or —]                    │
│  Target Pasar    [value or —]                    │
│  USP             [value or —]                    │
│  Benefits        [value or —]                    │
│                                                  │
├──────────────────────────────────────────────────┤
│  Disimpan: 12 Juni 2026                         │
│                                          [Tutup]  │
└──────────────────────────────────────────────────┘
```

Empty field convention: `—` (em-dash) with `text-slate-400`, label tetap ditampilkan untuk konsistensi layout.

## Accessibility (shadcn Dialog defaults + extras)

- ✅ Focus trap (shadcn)
- ✅ ESC closes (shadcn)
- ✅ ARIA labels (shadcn)
- ✅ Click backdrop closes (shadcn)
- ✅ Card has `role="button"` + `tabIndex={0}` + keyboard handler (Enter/Space)
- ✅ Modal `aria-labelledby` points to product name

## Edge Cases

- Product dengan semua field null (cuma name) → tampil `—` di semua field, layout tetap konsisten
- Benefits panjang / multi-line → `<p>` dengan `whitespace-pre-line` (preserve newlines dari AI output)
- Modal dibuka cepat-cepat (click multiple cards) → `selectedProduct` di-set ulang, modal re-renders dengan product baru (no flicker)
- Tombol Hapus diklik → `e.stopPropagation()` di onClick, modal tidak terbuka, delete confirmation jalan seperti biasa

## Testing Strategy

### Unit test: `ProductDetailModal`
- Renders all 7 fields correctly when product has all data
- Renders `—` untuk null/empty fields
- Multi-line benefits preserved (whitespace-pre-line)
- close handler fires on X click
- Dialog accessibility attrs present

### Component test: `ProductList` (existing or new)
- Clicking card sets `selectedProduct` + opens modal
- Clicking tombol Hapus does NOT set `selectedProduct` (stopPropagation)
- Enter/Space on focused card sets `selectedProduct`
- Loading state renders skeleton/empty when no products

## Out of Scope

- Editing products in modal (user explicitly chose view-only)
- Delete from inside modal (user can still use the Hapus button on the card)
- Pagination / filtering of saved products (separate concern)
- Bulk actions (separate concern)
