# Implementation Plan: UGC Generator

## Route: `/ugc`

## What it does
Single page with 4 internal tabs (client-side): Script, Storyboard, Prompt, Batch. Each tab is a mini-generator.

## Tabs
1. **Script** — testimonial/review/UGC style video script (1-2 scenes, casual tone)
2. **Storyboard** — visual storyboard for UGC video (4-6 panels with shot description)
3. **Prompt** — image generation prompt in "user-generated content" style (looks like phone photo)
4. **Batch** — mass generate multiple UGC scripts at once (select multiple products)

## Pattern
Each tab is similar to the existing generators: form (L) + result (R). The main component switches which sub-component renders.

## Files

| File | Status |
|---|---|
| `lib/ai/prompts/ugc-*.ts` | new — 4 prompt files (script/storyboard/prompt/batch) |
| `lib/validation/ugc.ts` | new — Zod for all 4 forms |
| `lib/actions/ugc.ts` | new — 4 Server Actions |
| `components/modules/ugc-generator.tsx` | new — tab container + 4 sub-components |
| `app/(dashboard)/ugc/page.tsx` | new — route page |
| `components/shared/nav-items.ts` | modified — sudah ada, verify href |

## Scale
Biggest single feature so far. 4 sub-generators in one page. ~2-3x size of previous modules.
