# Implementation Plan: Saved Products Detail Modal

**Date:** 2026-06-15
**Feature:** Saved Products Detail Modal (view-only, triggered by card click)
**Spec:** `docs/superpowers/specs/2026-06-15-saved-products-detail-modal-design.md`

## Overview

Add a view-only modal to the saved products list at `/produk` that surfaces the full Detail Informasi (price, target_market, usp, benefits) when the user clicks a product card. Currently the saved products grid only shows minimal fields (image, name, category, brand, created_at) — the AI-generated analysis fields are saved to the database but never visible after save, forcing the user to re-analyze the product to see them.

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `components/shared/product-detail-modal.tsx` | **new** | shadcn Dialog wrapper, renders 7 fields + image header + date footer, handles null fields with em-dash, multi-line benefits with `whitespace-pre-line` |
| `components/shared/product-list.tsx` | **modified** | Expand `Product` interface to include 4 new fields, update Supabase query to `select` all fields, add `selectedProduct` state, add card `onClick` + `role="button"` + `tabIndex={0}` + keyboard handler, add `e.stopPropagation()` to Hapus onClick, render `<ProductDetailModal>` at end |
| `tests/unit/components/product-list.test.tsx` | **new** | Component test: click opens modal, Hapus doesn't, keyboard handler works, fetches all fields |
| `tests/unit/components/product-detail-modal.test.tsx` | **new** | Component test: renders all 7 fields, null fields show em-dash, multi-line benefits preserved, close handlers work |
| `tests/setup.ts` | **modified** | Add `import "@testing-library/jest-dom/vitest"` already present; need to verify happy-dom env is registered for these new test files |
| `vitest.config.ts` | **modified** | Add `environmentMatchGlobs` so `tests/unit/components/**` uses `happy-dom` (preserving `node` for `tests/unit/lib/**`) |

**Files that change together:** all 4 — the modal needs the new fields, the list needs to fetch them, the list needs to manage modal state, the tests verify the wiring.

## Task Dependency Graph

```
Task 1 (interface + query)
    ↓
Task 2 (modal state + card click)
    ↓
Task 3 (Hapus stopPropagation)
    ↓
Task 4 (keyboard a11y on card)
    ↓
Task 5 (ProductDetailModal component)
    ↓
Task 6 (null field handling in modal)
    ↓
Task 7 (date formatter in modal)
    ↓
Task 8 (render modal in ProductList)
    ↓
Task 9 (product-list component tests)
    ↓
Task 10 (modal component tests)
    ↓
Task 11 (final verification)
    ↓
Task 12 (commit + push + merge)
```

Tasks 1-8 are sequential (each builds on the previous). Tasks 9-10 can run in parallel after Task 8. Tasks 11-12 are gates.

## Tasks

### Task 1: Expand Product interface + Supabase query in product-list.tsx

- [ ] **Step 1.1: Write the failing test** — In `tests/unit/components/product-list.test.tsx`, write a test that renders `<ProductList refreshKey={0} />` with a mocked `createBrowserClient` whose `.from("products").select(...)` returns 3 sample products. Assert that the rendered DOM contains a product's `price`, `target_market`, `usp`, and `benefits` values (these are the new fields).
  Expected: FAIL because the current `Product` interface doesn't include these fields and the query doesn't select them.
- [ ] **Step 1.2: Run test to verify it fails** — `pnpm test tests/unit/components/product-list.test.tsx`
  Expected: FAIL with "price is undefined" or similar
- [ ] **Step 1.3: Update the `Product` interface in `product-list.tsx`** — Add fields: `price: string | null; target_market: string | null; usp: string | null; benefits: string | null;`
- [ ] **Step 1.4: Update the supabase query in `product-list.tsx`** — Change `.select("id, name, category, brand, image_url, created_at")` to `.select("id, name, category, brand, price, target_market, usp, benefits, image_url, created_at")`
- [ ] **Step 1.5: Run test to verify it passes** — `pnpm test tests/unit/components/product-list.test.tsx`
  Expected: PASS

### Task 2: Add modal state and card onClick handler

- [ ] **Step 2.1: Write the failing test** — In `product-list.test.tsx`, add a test that finds a product card by its name text, simulates a click, and asserts that `<ProductDetailModal>` is rendered with the product data (use a test ID like `data-testid="product-detail-modal"` on the modal root).
  Expected: FAIL because the modal isn't rendered yet.
- [ ] **Step 2.2: Run test to verify it fails** — `pnpm test tests/unit/components/product-list.test.tsx`
  Expected: FAIL with "Unable to find element with data-testid product-detail-modal"
- [ ] **Step 2.3: Add `selectedProduct` state in `ProductList`** — `const [selectedProduct, setSelectedProduct] = useState<ProductWithDetails | null>(null);` (rename the interface to `ProductWithDetails` to avoid future name conflict).
- [ ] **Step 2.4: Add `onClick` to the card div in `ProductList`** — `onClick={() => setSelectedProduct(product)}`. Also add `role="button"`, `tabIndex={0}`, `aria-label={\`Lihat detail ${product.name}\`}`, and `cursor-pointer hover:shadow-md transition-shadow` for visual affordance.
- [ ] **Step 2.5: Render a placeholder `<ProductDetailModal />` at the end of `ProductList`** with the required props. The component doesn't exist yet — create a stub at `components/shared/product-detail-modal.tsx` that just returns `null` for now.
  File contents of stub:
  ```tsx
  "use client";
  import type { Database } from "@/lib/supabase/types";
  export type ProductWithDetails = Database["public"]["Tables"]["products"]["Row"];
  interface ProductDetailModalProps {
    product: ProductWithDetails | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }
  export function ProductDetailModal(_props: ProductDetailModalProps) {
    return null;
  }
  ```
- [ ] **Step 2.6: Run test to verify it passes** — `pnpm test tests/unit/components/product-list.test.tsx`
  Expected: PASS (the test will find the modal element now, even though it renders nothing)

### Task 3: Hapus button must not open the modal

- [ ] **Step 3.1: Write the failing test** — In `product-list.test.tsx`, add a test that finds the Hapus button, simulates a click, and asserts that the modal does NOT open (no product data visible in modal).
  Expected: FAIL because `setSelectedProduct` is currently called on every card click including the Hapus area.
- [ ] **Step 3.2: Run test to verify it fails** — `pnpm test tests/unit/components/product-list.test.tsx`
  Expected: FAIL with product data visible after clicking Hapus
- [ ] **Step 3.3: Add `e.stopPropagation()` to the Hapus onClick handler in `ProductList`** — change the existing onClick to `(e) => { e.stopPropagation(); handleDelete(product.id); }`
- [ ] **Step 3.4: Run test to verify it passes** — `pnpm test tests/unit/components/product-list.test.tsx`
  Expected: PASS

### Task 4: Card keyboard support (Enter/Space to open)

- [ ] **Step 4.1: Write the failing test** — In `product-list.test.tsx`, add a test that finds the card by role "button", focuses it, simulates a `keydown` event with key="Enter", and asserts that the modal opens.
  Expected: FAIL because the card has no `onKeyDown` handler.
- [ ] **Step 4.2: Run test to verify it fails** — `pnpm test tests/unit/components/product-list.test.tsx`
  Expected: FAIL because modal doesn't open on Enter key
- [ ] **Step 4.3: Add `onKeyDown` to the card in `ProductList`** — `onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedProduct(product); } }}`
- [ ] **Step 4.4: Add a test for Space key** — same as Step 4.1 but with `key=" "`. Should pass without further code change.
  Expected: PASS
- [ ] **Step 4.5: Run all product-list tests** — `pnpm test tests/unit/components/product-list.test.tsx`
  Expected: ALL PASS (Tasks 1-4 cumulative)

### Task 5: Create ProductDetailModal — render all 7 fields

- [ ] **Step 5.1: Write the failing test** — In `tests/unit/components/product-detail-modal.test.tsx`, write a test that renders the modal with a sample product (all 7 fields populated). Use `screen.getByText` to assert each field label AND value is present in the DOM.
  Expected: FAIL because the modal stub returns null.
- [ ] **Step 5.2: Run test to verify it fails** — `pnpm test tests/unit/components/product-detail-modal.test.tsx`
  Expected: FAIL with "Unable to find label Kategori" (or similar)
- [ ] **Step 5.3: Implement ProductDetailModal with shadcn Dialog** — Replace the stub with a full implementation. Use `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` from `@/components/ui/dialog`. Render:
  - Header: image (60x60 thumbnail, fallback icon if null) + `<DialogTitle>` (product name) + brand · category subtitle
  - Body: 7 rows in a definition-list style — Kategori, Brand, Harga, Target Pasar, USP, Benefits — each showing label (uppercase, slate-500) and value (slate-800, semibold)
  - Footer: "Disimpan: {formatted date}" + a "Tutup" button using shadcn Button
  - Pass `open` and `onOpenChange` to Dialog root
  Expected: PASS
- [ ] **Step 5.4: Run test to verify it passes** — `pnpm test tests/unit/components/product-detail-modal.test.tsx`
  Expected: PASS

### Task 6: Null field handling in modal

- [ ] **Step 6.1: Write the failing test** — In `product-detail-modal.test.tsx`, add a test that renders the modal with a product where `price`, `target_market`, and `usp` are null but `benefits` has multi-line content. Assert that the labels are still visible and the null values render as `—` (em-dash).
  Expected: FAIL because the current implementation renders "null" or empty for null fields.
- [ ] **Step 6.2: Run test to verify it fails** — `pnpm test tests/unit/components/product-detail-modal.test.tsx`
  Expected: FAIL with assertion on em-dash
- [ ] **Step 6.3: Add a `formatValue` helper in the modal** — `const formatValue = (v: string | null | undefined) => v && v.trim() ? v : "—";` Apply to all 7 fields.
- [ ] **Step 6.4: Handle multi-line `benefits` field** — Use `<p className="whitespace-pre-line">{formatValue(product.benefits)}</p>` so newlines from the AI output are preserved.
- [ ] **Step 6.5: Run test to verify it passes** — `pnpm test tests/unit/components/product-detail-modal.test.tsx`
  Expected: PASS

### Task 7: Date formatter in modal footer

- [ ] **Step 7.1: Write the failing test** — In `product-detail-modal.test.tsx`, add a test that renders the modal with a product whose `created_at` is `"2026-06-12T10:00:00Z"`. Assert the footer shows "Disimpan: 12 Juni 2026" (Indonesian locale, `dateStyle: "long"`).
  Expected: FAIL because the current footer doesn't format the date.
- [ ] **Step 7.2: Run test to verify it fails** — `pnpm test tests/unit/components/product-detail-modal.test.tsx`
  Expected: FAIL
- [ ] **Step 7.3: Add `formatDate` helper in the modal** — `const formatDate = (iso: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(iso));`
- [ ] **Step 7.4: Use the formatter in the footer** — Replace the placeholder with `Disimpan: {formatDate(product.created_at)}`
- [ ] **Step 7.5: Run test to verify it passes** — `pnpm test tests/unit/components/product-detail-modal.test.tsx`
  Expected: PASS

### Task 8: Wire `<ProductDetailModal>` into ProductList JSX

- [ ] **Step 8.1: Write the failing test** — In `product-list.test.tsx`, assert that the modal is rendered with `open={false}` when no product is selected, and with `open={true}` after a card click. Use a data-testid on the Dialog content to verify open state.
  Expected: FAIL because the modal is rendered with `open={!!selectedProduct}` but the test isn't checking open state.
- [ ] **Step 8.2: Run test to verify it fails** — `pnpm test tests/unit/components/product-list.test.tsx`
  Expected: FAIL
- [ ] **Step 8.3: Update the modal JSX in `ProductList`** — Change `<ProductDetailModal product={selectedProduct} onOpenChange={setSelectedProduct} />` to also pass `open={!!selectedProduct}`. This makes the open state explicit.
- [ ] **Step 8.4: Update `onOpenChange` to handle close correctly** — `onOpenChange={(open) => !open && setSelectedProduct(null)}` so ESC/click-outside/X button all clear the selected product.
- [ ] **Step 8.5: Run test to verify it passes** — `pnpm test tests/unit/components/product-list.test.tsx`
  Expected: PASS

### Task 9: Setup happy-dom for component tests (Prerequisite for Tasks 1-8 tests to actually run)

- [ ] **Step 9.1: Add `happy-dom` as a dev dependency** — `pnpm add -D happy-dom`
- [ ] **Step 9.2: Update `vitest.config.ts`** — Add `environmentMatchGlobs: [["tests/unit/components/**", "happy-dom"]]` to the `test` config. This keeps `lib/**` tests on `node` and switches `components/**` to `happy-dom`.
- [ ] **Step 9.3: Re-run all tests** — `pnpm test`
  Expected: ALL PASS (or at least, the new component tests are now discoverable)

### Task 10: Final verification

- [ ] **Step 10.1: Run typecheck** — `pnpm typecheck`
  Expected: 0 errors
- [ ] **Step 10.2: Run all tests** — `pnpm test`
  Expected: all green
- [ ] **Step 10.3: Run lint** — `pnpm lint`
  Expected: 0 issues
- [ ] **Step 10.4: Manual browser smoke test (USER)** — User opens the deployed app, navigates to /produk, clicks a saved product card, verifies the modal opens with all 7 Detail Informasi fields, presses ESC to close, clicks Hapus and confirms it deletes without opening the modal.

### Task 11: Commit + push + PR + merge (USER AUTHORIZATION REQUIRED)

- [ ] **Step 11.1: Get explicit user authorization** — Per AGENTS.md `Commit without explicit request - **Never**`, do NOT commit without user saying "commit & push" or "commit & merge".
- [ ] **Step 11.2: Create feature branch** — `git checkout -b feat/saved-products-detail-modal`
- [ ] **Step 11.3: Stage all 5 files** — `git add components/shared/product-detail-modal.tsx components/shared/product-list.tsx tests/unit/components/ vitest.config.ts`
- [ ] **Step 11.4: Commit with conventional message** — Title: `feat(ui): add view-only detail modal for saved products`. Body: explains the user-facing problem, the architecture decisions, and the test coverage.
- [ ] **Step 11.5: Push** — `git push -u origin feat/saved-products-detail-modal`
- [ ] **Step 11.6: Create PR** — `gh pr create --base main --head feat/saved-products-detail-modal --title "..." --body-file <path> --reviewer mifdlaldev`
- [ ] **Step 11.7: Merge** — `gh pr merge <num> --squash --delete-branch` (per user explicit authorization)
- [ ] **Step 11.8: Verify final state** — `git log --oneline -3`, `git branch -vv`, `gh pr list` (should show "No Pull Requests")

## Out of Scope (per spec)

- Editing products in the modal
- Deleting products from the modal
- Pagination / filtering of saved products
- Bulk actions

## Risks & Notes

- **happy-dom is a new dev dependency** — small, but adds to install size. If user objects, fall back to manual browser testing only.
- **Test setup complexity** — Tasks 1-8 write tests that need a DOM. Task 9 is a separate prerequisite. If Task 9 is skipped, Tasks 1-8 tests will fail to run (not just fail the assertion — they won't even start).
- **Keyboard handler** — `e.preventDefault()` is called for Space to prevent page scroll. Important UX detail.
- **Date format dependency** — `Intl.DateTimeFormat("id-ID")` depends on Node.js ICU data. Should work in all modern Node.js versions (16+).
- **shadcn Dialog** — already installed and used by other components. Reuse it for consistency.
