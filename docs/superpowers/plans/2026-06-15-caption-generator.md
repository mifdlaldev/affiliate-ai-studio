# Implementation Plan: Caption Generator

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `lib/ai/prompts/caption.ts` | new | `CAPTION_SYSTEM_PROMPT` + `buildCaptionPrompt(product, inputs)` |
| `lib/validation/caption.ts` | new | Zod schema (productId, platform, tone, audience, cta) |
| `lib/actions/captions.ts` | new | `generateCaptions(formData)` Server Action |
| `components/modules/caption-generator.tsx` | new | Client component (left form + right result) |
| `app/(dashboard)/generasikan/caption/page.tsx` | new | Route page thin wrapper |

## Tasks (3 tasks, same pattern as Hook Generator)

### Task 1: Prompt + Schema
- `CAPTION_SYSTEM_PROMPT` + `buildCaptionPrompt()` pure function
- Zod schema `generateCaptionsSchema`
- 8 tests (same structure as hook prompt tests)

### Task 2: Server Action
- `generateCaptions(formData)` — usage check → fetch product → AI call → save to generations → return
- 8 tests (same structure as hooks action tests: success, limit, invalid JSON, not signed in)

### Task 3: Component + Route
- `CaptionGenerator` client component — left form (product select + platform/tone/audience/cta) + right result (caption cards with hashtags + copy)
- Route page thin wrapper
- 7 tests (same states: empty-products, form, loading, error, results, copy)
