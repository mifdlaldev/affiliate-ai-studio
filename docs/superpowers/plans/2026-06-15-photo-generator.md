# Implementation Plan: Photo Prompt Generator

## Route: `/generasikan/photo`

## Files

| File | Status |
|---|---|
| `lib/ai/prompts/photo.ts` | new — `PHOTO_SYSTEM_PROMPT` + `buildPhotoPrompt(product, {style, mood, setting, composition})` |
| `lib/validation/photo.ts` | new — Zod: productId, style (minimalist/professional/lifestyle/creative), mood (warm/cool/dramatic/natural/playful), setting (studio/outdoor/lifestyle/macro), composition (close-up/flat-lay/hero/lifestyle) |
| `lib/actions/photos.ts` | new — `generatePhotoPrompts(formData)` Server Action |
| `components/modules/photo-generator.tsx` | new — left form + right result (prompt cards with style/mood/setting badges + copy + refine) |
| `app/(dashboard)/generasikan/photo/page.tsx` | new — route page |
| `components/shared/nav-items.ts` | **modified** — tambah link + `ImageSquare` icon |

## Pattern
Sama persis kaya 3 generator sebelumnya (form L + result R / 3 subagent tasks). Output: 3-5 photo prompts siap pakai untuk Midjourney/Leonardo/DALL-E dengan detail teknis (shot type, lighting, angle, color palette, aspect ratio).
