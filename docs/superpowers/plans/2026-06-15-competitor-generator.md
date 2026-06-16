# Implementation Plan: Competitor Analyzer

## Route: `/generasikan/competitor`

## What it does
User enters a competitor URL (Shopee/TikTok/etc) + their own product → AI analyzes competitor's product, compares, and returns insights.

## Input
- productId (select from saved products)
- Competitor URL (Shopee, Tokopedia, TikTok Shop, etc.)
- Platform (shopee/tokopedia/tiktok-shop/lazada)

## Output
AI returns structured analysis: competitor name, price range, rating, strengths, weaknesses, content gaps, recommendations.

## Table: `competitor_analyses` (already exists from Plan 1 migrations)

## Files

| File | Status |
|---|---|
| `lib/ai/prompts/competitor.ts` | new |
| `lib/validation/competitor.ts` | new |
| `lib/actions/competitor.ts` | new |
| `components/modules/competitor-analyzer.tsx` | new |
| `app/(dashboard)/generasikan/competitor/page.tsx` | new |
| `components/shared/nav-items.ts` | modified — tambah MagnifyingGlass + link |
