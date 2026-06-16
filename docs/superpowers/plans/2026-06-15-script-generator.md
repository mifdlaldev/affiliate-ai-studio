# Implementation Plan: Script Generator

## Files

| File | Status |
|---|---|
| `lib/ai/prompts/script.ts` | new — `SCRIPT_SYSTEM_PROMPT` + `buildScriptPrompt(product, {platform, tone, audience, duration})` |
| `lib/validation/script.ts` | new — Zod schema: productId, platform (tiktok/instagram/youtube), tone, audience, duration (15/30/60) |
| `lib/actions/scripts.ts` | new — `generateScripts(formData)` Server Action |
| `components/modules/script-generator.tsx` | new — left form + right result (script cards with scene table) |
| `app/(dashboard)/generasikan/script/page.tsx` | new — route page |

## Tasks (3 tasks, same pattern)

### Task 1: Prompt + Schema
- `SCRIPT_SYSTEM_PROMPT`: instruct AI to return JSON array of scripts with scenes
- `buildScriptPrompt()`: includes product details + platform + duration + tone + audience
- `generateScriptsSchema`: Zod with duration enum
- 8 tests

### Task 2: Server Action
- `generateScripts(formData)`: Zod → usage check → fetch product → AI call → save → return
- 8 tests

### Task 3: Component + Route
- ScriptGenerator component: left form (product + platform + tone + audience + duration) + right result (script cards with scene table showing timing/visuals/audio/text)
- `TimelineClock` icon from Phosphor
- Route page wrapper
- 7 tests + nav link
