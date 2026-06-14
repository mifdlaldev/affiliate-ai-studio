# Post Plan 1 — Next Steps

Plan 1 (**Foundation & Product Studio**) is complete. The application is
functional, tested, and ready for production deployment.

> **Date completed**: 2026-06-14
> **Status**: feature-complete, deployment-ready
> **Next milestone**: User deploys to Vercel + Supabase using
> `docs/DEPLOYMENT.md`

---

## What Plan 1 Shipped

### Application surface

- **Marketing root** at `/` redirects to `/login` (or `/produk` if signed
  in)
- **Authentication** at `/login` (Magic Link + Google OAuth) and
  `/api/auth/callback`
- **Onboarding** at `/onboarding` (welcome modal, sample-data opt-in)
- **Dashboard** at `/produk` with sidebar, top bar, user menu
- **Product Studio** with upload, AI auto-analyze, form, save, and list
  views

### Backend

- **7 Supabase tables** with RLS enabled (`user_profiles`, `products`,
  `projects`, `assets`, `content_calendar`, `usage_tracking`,
  `user_preferences`)
- **Storage bucket** `product-images` (private)
- **Database functions**: `increment_user_usage`, `handle_new_user`
  trigger
- **Auth flows**: Magic Link + Google OAuth via `@supabase/ssr`
- **Server-side validation** with Zod for all write paths
- **Soft usage limit**: 50 generations per user per month

### AI integrations

- **OpenCode Zen** client with retry logic, exponential backoff, and
  automatic fallback to Kimchi.dev
- **HuggingFace BLIP-2** for image-to-text in Product Auto-Analyze
- **DeepSeek V4 Flash** as the default chat model (free tier)

### Quality

- **TypeScript strict** mode, zero type errors
- **ESLint** clean (3 pre-existing `<img>` warnings tracked for migration
  to `next/image`)
- **Production build** successful
- **41 unit tests** passing across 9 test files
- **8 E2E tests** (Playwright + Chromium) listed and ready
- **Performance**: `middleware` -> `proxy` migration tracked for Plan 3
  (Next.js 16 deprecation)

### Codebase size

- ~60 source files
- ~5,500 lines of TypeScript
- 8 database migrations
- 1 production Playwright config

---

## What's Next: Plan 2 (AI Generators Suite)

Plan 2 adds the **12 AI text/visual generation modules** that turn
AffiliateAI Studio from a single-purpose product analyzer into a full
content-generation platform.

All modules will share the AI client infrastructure shipped in Plan 1
(`lib/ai/`, retry logic, fallback, usage tracking) — no new dependencies
are required.

### Modules to build

Grouped by area, in priority order. Estimated effort: **3-4 weeks** of
focused work (1 developer, AI-assisted pair).

#### 1. Visual Prompt Generators (Week 2)

- **AI Photo Prompt Generator** — generate detailed image prompts for
  product photography. Output: structured JSON with shot, lighting,
  background, angle, mood fields.
- **AI Model Prompt Generator** — generate model character descriptions.
  Output: ethnicity, age, pose, wardrobe, expression, action.

#### 2. UGC Generator (Week 2-3) — flagship module

- **UGC Generator** with **4 sub-tabs**:
  1. **Hooks** — 10 viral hooks (curiosity, controversy, FOMO, list,
     question, story, statistic, confession, comparison, command)
  2. **Scripts** — 30s/60s/90s video scripts with hook-body-CTA
  3. **Storyboard** — scene-by-scene visual + narration table
  4. **Prompts** — AI video generation prompts + voice-over scripts

#### 3. Standalone Generators (Week 3)

- **Storyboard Generator** — scene/visual/narration table for an existing
  script
- **Live Host AI** — live streaming script generator (intro, Q&A,
  promo, outro blocks)

#### 4. Strategy Generators (Week 4)

- **Competitor Analyzer** (PRO badge) — paste a TikTok or Shopee URL,
  fetch metadata, analyze, output comparison table
- **Batch Generator** (PRO badge) — multi-output in one request (e.g.,
  generate 5 captions + 5 hooks in a single call)
- **Content Calendar** (PRO badge) — 30-day content plan with streaming
  UI (SSE) so users see results as they generate

#### 5. Platform Content (Week 4-5)

- **Marketplace Content** — Shopee + TikTok Shop product descriptions
- **Social Media Content** — TikTok + Instagram captions with hashtags
- **Landing Page Generator** — AIDA framework landing page copy

### Deliverables

For each module:

- 1 page under `app/(dashboard)/<module>/page.tsx`
- 1 server action under `lib/actions/`
- 1 Zod validation schema
- 1+ prompt template (in `lib/ai/prompts/`)
- Unit tests for the action and validation
- 1 E2E happy-path test

### Cross-cutting Plan 2 work

- **Generation history page** at `/history` — list all past generations
  with re-run
- **Streaming UI** for long-running modules (Calendar, Batch)
- **Prompt caching** in Supabase (24h LRU) to reduce API costs
- **Per-user cost tracking** (optional — requires logging every call)
- **PRO tier gating** — 3 modules require a flag in `user_profiles`

---

## Optional Plan 1.5 Improvements

If you want to polish Plan 1 before diving into Plan 2, these are
high-leverage, low-risk changes:

### Quick wins (1-2 days)

- **Real `<img>` -> `next/image` migration** — fix the 3 ESLint warnings
  in `page.tsx`, `product-list.tsx`, `product-uploader.tsx`. Will improve
  LCP and bundle size.
- **`middleware.ts` -> `proxy.ts`** — Next.js 16 deprecation. Rename the
  file and update the function name. Will silence the build warning.
- **Marketing landing page** at `/` — currently redirects to `/login`.
  Adding a public landing page with feature list, screenshots, and a
  "Mulai Gratis" CTA improves SEO and conversion. Estimated 4-6 hours.
- **Magic Link email template** — Supabase default is plain. Customize
  with AffiliateAI Studio branding (logo, accent color, Indonesian
  copy).
- **404 page polish** — currently a default Next.js page. Add branded
  design with link back to `/login` or `/produk`.

### Quality improvements (3-5 days)

- **Test coverage to 80%** — current ~60% (estimated from 41 tests over
  ~5500 LOC). Add tests for server actions, form validation edge cases.
- **Accessibility audit** — run `axe` against all pages, fix color
  contrast, add `aria-*` where missing.
- **i18n foundation** — Indonesian and English strings, with
  `next-intl` or similar. Required before marketing to non-Indonesian
  users.
- **Sentry integration** — error tracking in production. Free tier covers
  hobby usage.

### Should we do Plan 1.5 or jump to Plan 2?

**Recommend jumping to Plan 2** if you want to keep momentum — the
landing page and `<img>` migration are nice-to-haves, not blockers.
**Do Plan 1.5 first** if you plan to launch publicly and need the
marketing surface.

---

## Longer-Term Roadmap (Plans 3+)

These are sketched for context, not committed:

### Plan 3: Library, Export, Polish

- Asset Library page (all generated content, filterable, searchable)
- Project management (campaign, review, unboxing containers)
- Export: PDF, DOCX, TXT, JSON, CSV
- Mobile responsive polish
- Performance optimization (Lighthouse >= 95 mobile)

### Plan 4: Multi-tenant + Paid Tiers

- Stripe integration
- Pro tier limits (200 generations/month, premium modules)
- Team workspaces (invite by email, shared libraries)
- Usage analytics dashboard

### Plan 5: Integrations + API

- Public REST API (rate-limited, API key auth)
- Webhooks (notify on generation complete)
- Zapier connector
- Browser extension (capture product from any e-commerce site)

### Plan 6: Mobile + International

- React Native app (iOS + Android)
- Multi-currency (IDR, USD, MYR, SGD)
- English + Bahasa Indonesia + Bahasa Malaysia

---

## Tracking

If you have questions, blockers, or scope adjustments for Plan 2, drop
them in `docs/QUESTIONS.md` (create it if it does not exist) using the
template:

```markdown
## YYYY-MM-DD — <topic>

**Context**: what triggered this question
**Options**:
1. <option A>
2. <option B>
**Recommendation**: <which option and why>
**Decision needed by**: <date or "before Plan 2 starts">
```

---

## Reference

- **Plan file**: `docs/superpowers/plans/2026-06-14-01-foundation.md`
- **Design spec**: `docs/superpowers/specs/2026-06-14-affiliate-ai-studio-design.md`
- **Deployment guide**: `docs/DEPLOYMENT.md`
- **Runbook**: `docs/RUNBOOK.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **User guide**: `docs/USER_GUIDE.md`
- **Supabase setup**: `docs/SUPABASE_SETUP.md`
- **Project info**: `PROJECT.md`
- **Auto-loaded context**: `AGENTS.md`
