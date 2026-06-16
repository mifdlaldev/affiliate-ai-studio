# Implementation Plan: Hook Generator

**Prerequisite:** `docs/superpowers/specs/2026-06-15-hook-generator-design.md`

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `lib/ai/prompts/hook.ts` | new | `HOOK_SYSTEM_PROMPT` + `buildHookPrompt(product, {platform, tone, audience})` |
| `lib/validation/hook.ts` | new | Zod schema for hook generation form inputs |
| `lib/actions/hooks.ts` | new | `generateHooks()` Server Action (usage check → AI → save to `generations`) |
| `components/modules/hook-generator.tsx` | new | Client component: product selector + form (L) + hook cards (R) |
| `app/(dashboard)/generasikan/hook/page.tsx` | new | Route page, thin wrapper |

## Tasks

### Task 1: Prompt builder + Zod schema
- Write `HOOK_SYSTEM_PROMPT` (system-level instructions: output format, Indonesian, constraints)
- Write `buildHookPrompt(product, {platform, tone, audience})` — pure function returning the user prompt
- Write Zod schema `generateHooksSchema`
- Write unit tests for prompt builder (all fields interpolate correctly, handles null product fields)
- **Test**: `pnpm test` → PASS
- **No commit**

### Task 2: Server Action
- Write `generateHooks(formData)`:
  - Parse + validate form data with Zod
  - `checkAndIncrementUsage(user.id)` → reject if over limit
  - Call `generateText({ systemPrompt, prompt, jsonMode: true })`
  - Parse JSON response as array of hooks
  - Save to `generations` table (user_id, model, module, prompt, result, tokens_used)
  - Return hooks array
- Write unit test with mocked `createServerClient` and `generateText`
- **Test**: `pnpm test` → PASS
- **No commit**

### Task 3: Main component + route page
- Write `HookGenerator` client component:
  - Fetch saved products on mount (via browser client)
  - Left form: <select> product, <select> platform, <select> tone, <input> audience, [Generate] button
  - Right result: hook cards with copy-to-clipboard + save button
  - States: empty (no products? guide to /produk), form, generating (loading), results, error
- Write route page `app/(dashboard)/generasikan/hook/page.tsx` as thin wrapper
- Write component test (render states + form interaction + result display)
- **Test**: `pnpm test` → PASS
- **No commit**

### Task 4: Final verification + commit
- `pnpm typecheck` (0 errors)
- `pnpm test` (all pass)
- `pnpm lint` (0 issues)
- Create feature branch → commit → push → PR → merge (USER AUTHORIZATION REQUIRED)
