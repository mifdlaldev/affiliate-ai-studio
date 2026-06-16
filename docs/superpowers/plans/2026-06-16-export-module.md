# Implementation Plan: Export Module

## What
Add export functionality to the Asset Library (/assets) — download generated content as PDF, DOCX, TXT, JSON, CSV.

## Approach: Export buttons in Asset Library
- Each asset card in Asset Library gets an "Export" dropdown button with format options
- Export formats: PDF, DOCX, TXT, JSON, CSV
- For multi-item exports: select multiple assets → bulk export

## Scalable scope (start small)
1. Add per-asset export button → exports single item as TXT or JSON
2. Add bulk export → multi-select → export all selected as CSV
3. Add PDF/DOCX rendering (complex — longer scope)
4. Use existing libs: @react-pdf/renderer, docx

## Files
- `lib/export/txt.ts` — export single asset as .txt
- `lib/export/json.ts` — export single asset as .json
- `lib/export/csv.ts` — export multiple assets as .csv
- `lib/export/pdf.ts` — PDF rendering (if time permits)
- `lib/export/docx.ts` — DOCX rendering (if time permits)
- Modify `components/modules/asset-library.tsx` — add export buttons

## Task 1: TXT + JSON + CSV export helpers
- Write pure functions for formatting asset data into each format
- Unit tests

## Task 2: Wire into Asset Library UI
- Export button per card → download as TXT or JSON
- Bulk select → download selected as CSV
