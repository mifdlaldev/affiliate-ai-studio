# Design: Hook Generator

## Context
Phase 1 shipped Product Studio (save products with AI-generated Detail Informasi). The next step is Phase 2 (Core AI Generators) — using those products to generate marketing content. Hook Generator is the first module.

## Flow
1. User picks a saved product (dropdown)
2. Sets parameters: platform, tone, target audience
3. Clicks [Generate Hooks]
4. System: check usage → build prompt → AI call → parse → display → save to `generations`
5. User sees 3-5 hook cards with copy + save buttons

## Route
`/generasikan/hook` (protected route inside dashboard layout)

## Components
- `components/modules/hook-generator.tsx` — main interactive component (left form + right result)
- `lib/ai/prompts/hook.ts` — `buildHookPrompt()` (product + platform + tone + audience → prompt string)
- `lib/actions/hooks.ts` — `generateHooks()` Server Action (usage check → AI → save)
- `lib/validation/hook.ts` — Zod schema for hook generation form

## Data
- Reads: `products` table (user's saved products via browser client)
- Reads: `generations` table (history — future)
- Writes: `generations` table (AI output + tokens_used)
- Checks: `checkAndIncrementUsage()` for 50/month limit

## UI Layout
Left form panel (product select + platform/tone/audience + generate button) | Right result panel (hook cards)

## AI Call
- Model: `deepseek-v4-flash-free` (text-only, primary)
- JSON mode for structured output
- Prompt: system + user prompt with product details + parameters
- Returns: array of hook objects with `{ title, text, platform, note }`

## Save
- `generations` table: `model="deepseek-v4-flash-free"`, `module="hook"`, `input_prompt`, `result` (JSON array), `tokens_used`

## Dev Notes
- Reuses `lib/ai/client.ts`, `lib/usage/limits.ts`, `lib/supabase/client.ts`, Zod patterns
- **No new dependencies needed**
- Tests: unit for prompt builder + action, component for UI
