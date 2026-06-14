# ARCHITECTURE.md — System Architecture

> System design untuk AffiliateAI Studio. Read ini untuk understand bagaimana komponen-komponen fit together.

## 🏗 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                            │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Next.js 16 App (Client + Server)                       │  │
│  │                                                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │  │
│  │  │  Pages   │  │  Forms   │  │  Modals  │  │  Charts│ │  │
│  │  │  (RSC)   │  │  (RHF)   │  │  (Radix) │  │  (R)  │ │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬───┘ │  │
│  │       │              │              │             │     │  │
│  │       └──────────────┴──────────────┴─────────────┘     │  │
│  │                          │                               │  │
│  │                    ┌─────▼──────┐                        │  │
│  │                    │  Server    │                        │  │
│  │                    │  Actions   │                        │  │
│  │                    └─────┬──────┘                        │  │
│  └──────────────────────────┼──────────────────────────────┘  │
└─────────────────────────────┼─────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
    ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
    │   Supabase   │  │ OpenCode Zen│  │  HuggingFace │
    │              │  │     AI      │  │     BLIP-2   │
    │  ┌────────┐  │  │  (Text AI)  │  │ (Image→Text) │
    │  │Postgres│  │  └─────────────┘  └──────────────┘
    │  │  +RLS  │  │
    │  └────────┘  │
    │  ┌────────┐  │
    │  │  Auth  │  │
    │  └────────┘  │
    │  ┌────────┐  │
    │  │Storage │  │
    │  └────────┘  │
    └──────────────┘
```

## 📦 Tech Layers

### 1. Presentation Layer (Client)
- **React Server Components (RSC)** — Default untuk data fetching
- **Client Components** — Untuk interaktif (forms, modals, animations)
- **shadcn/ui** — Base component library (Radix UI primitives + Tailwind)
- **Tailwind CSS v4** — Utility-first styling
- **Phosphor Icons** — Icon library
- **Framer Motion** (optional) — Animations

### 2. Application Layer (Server)
- **Next.js Server Actions** — Mutations (create, update, delete)
- **Next.js Middleware** — Auth check, rate limiting
- **API Routes** — Untuk webhook, streaming, upload proxy

### 3. Data Layer
- **Supabase Postgres** — Primary database
- **Row Level Security (RLS)** — Data isolation per user
- **Supabase Storage** — File storage (images, documents)
- **Supabase Realtime** (future) — Real-time updates

### 4. AI Layer
- **OpenCode Zen** — Text generation (`deepseek-v4-flash-free`, FREE)
- **HuggingFace BLIP-2** — Image-to-text (free)
- **ChatGPT (user external)** — Image generation (user copy prompt → generate → upload)

### 5. External Layer
- **Vercel** — Hosting + Edge Functions
- **Google Analytics 4** — Pageview tracking
- **Google Tag Manager** — Custom event tracking

## 🔄 Data Flow Examples

### Example 1: User Generate Photo Prompt

```
[1] User fills form (Product Studio / AI Generator)
    ↓
[2] Client component validates input (Zod)
    ↓
[3] Submit → Server Action called
    ↓
[4] Server Action:
    a. Check usage limit (RPC: increment_user_usage)
    b. Build prompt from template (lib/ai/prompts/photo.ts)
    c. Call OpenCode Zen via OpenAI SDK
    d. Parse JSON response
    e. Save to generations table
    f. Return result to client
    ↓
[5] Client displays result in AIResponseViewer
    ↓
[6] User clicks "Copy" → toast "Disalin ke clipboard"
    ↓
[7] User opens ChatGPT separately, pastes prompt
    ↓
[8] User generates image, downloads
    ↓
[9] User uploads image back to Asset Library
```

### Example 2: User Login with Magic Link

```
[1] User enters email in login form
    ↓
[2] Client component calls signInWithOtp (Supabase)
    ↓
[3] Supabase sends email with magic link
    ↓
[4] User clicks link → redirect to /api/auth/callback?token=xxx
    ↓
[5] Middleware verifies token, sets session cookie
    ↓
[6] Redirect to /dashboard
    ↓
[7] Dashboard layout fetches user_profiles (RLS enforced)
    ↓
[8] If onboarding not completed → show OnboardingModal
    ↓
[9] User dismisses modal → mark onboarding_completed = true
```

### Example 3: Streaming Long Generation (Content Calendar)

```
[1] User submits Content Calendar form
    ↓
[2] Client opens AIProgressModal
    ↓
[3] Client opens EventSource connection to /api/ai/stream
    ↓
[4] Server starts OpenCode Zen streaming request
    ↓
[5] For each chunk:
    - Server sends SSE: data: {content: "..."}
    - Client appends to display
    - User sees real-time progress
    ↓
[6] On stream end:
    - Server sends final SSE: data: {done: true}
    - Server saves to generations table
    - Client closes modal, shows result
```

## 🗄 Database Schema (Visual)

```
┌──────────────┐
│  auth.users  │  (Supabase managed)
└──────┬───────┘
       │ 1:1
       ▼
┌──────────────────┐
│  user_profiles   │
│  ─────────────   │
│  id, email,      │
│  full_name,      │
│  avatar_url,     │
│  onboarding_*    │
└──┬─────┬─────┬───┘
   │     │     │
   │1:N  │1:N  │1:N
   ▼     ▼     ▼
┌──────┐ ┌────────┐ ┌──────────────────┐
│prods │ │projects│ │   generations    │
│      │ │        │ │                  │
│      │ └───┬────┘ │  module,         │
│      │     │1:N   │  result (JSONB), │
│      │     ▼      │  tokens_used,    │
│      │ ┌──────┐   │  status          │
│      │ │assets│   └──────────────────┘
│      │ │      │   ┌──────────────────┐
│      │ └──────┘   │ product_analyses│
│      │            └──────────────────┘
│      │            ┌──────────────────┐
│      │            │competitor_       │
│      │            │analyses          │
└──────┘            └──────────────────┘
```

## 🔐 Security Architecture

### Authentication
- **Magic Link** — Email-based, no password
- **Google OAuth** — 1-click via Google account
- **Session** — Stored in httpOnly cookie
- **JWT** — Issued by Supabase, validated on every request

### Authorization (RLS)
```sql
-- Every table has RLS enabled
-- Pattern: users can only access their own data
CREATE POLICY "Users can manage their own products"
ON products FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

### Middleware (Auth Guard)
```typescript
// middleware.ts
export async function middleware(request: NextRequest) {
  // Check session
  const session = await getSession();
  
  // Protect /dashboard/* routes
  if (request.nextUrl.pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect('/login');
  }
  
  return NextResponse.next();
}
```

### Secrets Management
- All secrets in `.env.local` (gitignored)
- Public vars prefixed with `NEXT_PUBLIC_`
- Server-only vars (OPENCODE_API_KEY, HUGGINGFACE_API_KEY) NEVER exposed to client
- API keys for AI services called from Server Actions ONLY

## ⚡ Performance Optimizations

### Frontend
- **Code splitting** — Dynamic imports untuk heavy modules
- **Image optimization** — Next.js Image component dengan Supabase loader
- **Font optimization** — Geist variable font (114KB, includes all weights)
- **Tree-shaking** — Phosphor Icons supports tree-shaking per icon
- **Streaming** — React Suspense untuk slow-loading sections

### Backend
- **Server Components** — Default, reduce client JS
- **Server Actions** — Direct DB calls, no API round-trip
- **RLS at DB level** — No need for app-level filtering
- **Indexes** — On FK + composite untuk query patterns
- **Caching** — LRU cache untuk AI responses (1 hour TTL)

### AI
- **Caching** — Identical requests cached 1 hour
- **Retry with backoff** — Reduce wasted calls
- **Streaming** — User sees progress, can cancel early
- **Token tracking** — Monitor usage, prevent runaway costs

## 🚀 Deployment Architecture

```
┌────────────────┐
│   Cloudflare   │  (DNS only, free)
│   Registrar    │
└───────┬────────┘
        │ A/CNAME
        ▼
┌────────────────┐
│     Vercel     │
│  ┌──────────┐  │
│  │  Edge    │  │  (Static assets, image optimization)
│  │  Network │  │
│  └──────────┘  │
│  ┌──────────┐  │
│  │  Next.js │  │  (Server Components, Server Actions)
│  │  Runtime │  │
│  └──────────┘  │
└───────┬────────┘
        │
        ├─────→ Supabase (Postgres + Auth + Storage)
        ├─────→ OpenCode Zen (AI Text)
        └─────→ HuggingFace (BLIP-2)
```

## 📊 Monitoring & Observability

### Tracked Events (GA4 + GTM)
- **Pageviews** — All routes
- **Custom events**:
  - `signup` — User registered
  - `login` — User logged in
  - `product_created` — Product saved
  - `generation_started` — AI generation initiated
  - `generation_completed` — AI generation finished
  - `generation_failed` — AI generation error
  - `export` — User exported content
  - `project_created` — Project created
  - `asset_uploaded` — Asset uploaded

### Logs
- **Vercel logs** — Server-side errors, performance
- **Supabase logs** — DB queries, auth events
- **Browser console** — Client-side errors (caught by error boundary)

### Error Tracking
- **Next.js error.tsx** — Global error boundary
- **API route try-catch** — Server-side errors logged to console
- **User-friendly messages** — Indonesian, no stack traces exposed

## 🔄 CI/CD Pipeline

```
[Push to feature/* branch]
    ↓
[Vercel auto-creates preview deployment]
    ↓
[Open PR → CI runs: lint + type check + tests]
    ↓
[Merge to main → auto-deploy to production]
    ↓
[Post-deploy: Vercel runs smoke test]
```

## 📈 Scalability Considerations

### Current (0-1000 users)
- Vercel Hobby tier
- Supabase Free tier
- OpenCode Zen (free models via deepseek-v4-flash-free)
- Single region

### Future (1000-10K users)
- Vercel Pro ($20/bulan)
- Supabase Pro ($25/bulan)
- OpenCode Zen paid tier (usage-based)
- Add caching layer (Redis/Upstash)

### Future (10K+ users)
- Vercel Enterprise
- Supabase Team
- Dedicated OpenCode Zen plan or self-hosted models
- Multi-region
- Background jobs (BullMQ, Inngest)

## 📚 Related Documentation

- **[Design Spec](superpowers/specs/2026-06-14-affiliate-ai-studio-design.md)** — Complete design
- **[Design System](../DESIGN.md)** — UI tokens
- **[User Guide](USER_GUIDE.md)** — How to use
- **[Runbook](RUNBOOK.md)** — Operations

---

**Last updated**: 2026-06-14
