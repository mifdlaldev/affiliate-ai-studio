# Implementation Plan: Model Prompt Generator

## Route: `/generasikan/model`

Sama persis kaya Photo Prompt Generator, tapi output prompt untuk foto dengan model (orang) yang memakai/menggunakan produk.

**Input tambahan**: `gender` (pria/wanita/any), `age` (remaja/dewasa/paruh baya/lansia), `modelVibe` (casual/elegan/atletik/profesional)

**Output**: 3-5 prompts dengan detail model + produk + setting + lighting + angle

## Files (sama pattern)

| File | Status |
|---|---|
| `lib/ai/prompts/model.ts` | new |
| `lib/validation/model.ts` | new |
| `lib/actions/models.ts` | new |
| `components/modules/model-generator.tsx` | new |
| `app/(dashboard)/generasikan/model/page.tsx` | new |
| `components/shared/nav-items.ts` | modified |
