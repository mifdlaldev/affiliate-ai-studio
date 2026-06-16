# Implementation Plan: Content Calendar

## Route: `/generasikan/kalender`

## What it does
User selects several products + month → AI generates a 30-day content plan: each day gets a content type (hook/caption/script/photo prompt/model prompt), a product focus, and platform recommendation.

## Input
- Products: multi-select checkboxes from user's saved products
- Month: month/year picker
- Content types: hook, caption, script, photo, model, mixed (AI chooses)
- Platform focus: TikTok, Instagram, YouTube, mixed (AI chooses)
- Tone: casual/professional/funny/inspirational

## Output
AI returns JSON array of 30 days: `{ day: number, productId: string, productName: string, contentType: string, platform: string, topic: string, hook: string }` — a daily content suggestion.

## UI
- Left: product multi-select + month + content type config
- Right: calendar grid (7-column, 4-5 week rows) with day cards showing: product name, content type badge, platform badge, hook text (truncated)
- Click day card → expand to see full hook text

## Files

| File | Status |
|---|---|
| `lib/ai/prompts/calendar.ts` | new — prompt for 30-day plan |
| `lib/validation/calendar.ts` | new — Zod schema |
| `lib/actions/calendar.ts` | new — Server Action |
| `components/modules/calendar-generator.tsx` | new — main component |
| `app/(dashboard)/generasikan/kalender/page.tsx` | new — route page |
| `components/shared/nav-items.ts` | modified — add CalendarBlank + link |
