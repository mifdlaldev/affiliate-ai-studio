# AGENTS.md — Project Context for AI

> File ini dibaca otomatis oleh AI tools (OpenCode, Claude Code, dll) setiap kali bekerja di folder project ini.

## 🎯 Project Overview

**Name**: AffiliateAI Studio
**Type**: SaaS web application (multi-tenant-ready, currently solo)
**Target User**: Affiliate marketers & content creators berbahasa Indonesia
**Tagline**: "Buat Konten Affiliate 10x Lebih Cepat dengan AI"
**Domain**: TBD (cek `affiliateai.id`, `affiliateai.studio`)

## 🛠 Tech Stack (LOCKED)

| Layer | Technology | Version | Notes |
|---|---|---|---|
| **Framework** | Next.js | 16.2.9 (App Router) | Server Components, Server Actions |
| **Language** | TypeScript | 5.x strict | NO `any`, NO `@ts-ignore` |
| **Runtime** | Node.js | 22 LTS | Required by Next.js 16 |
| **Package Manager** | pnpm | 9.x | Lockfile committed |
| **Styling** | Tailwind CSS | v4 | Plus shadcn/ui |
| **Components** | shadcn/ui | latest | Copy-paste, fully customizable |
| **Icons** | Phosphor Icons | latest (regular + bold) | BUKAN Lucide |
| **Font UI** | Geist Sans | variable, OFL-1.1 | BUKAN Inter |
| **Font Data** | Geist Mono | variable, OFL-1.1 | Untuk numerical/code |
| **Database** | Supabase Postgres | latest | RLS enabled on all tables |
| **Auth** | Supabase Auth | latest | Magic Link + Google OAuth |
| **Storage** | Supabase Storage | latest | For product images, generated assets |
| **AI Text** | OpenCode Zen `deepseek-v4-flash-free` | OpenAI-compatible | **FREE** via OpenCode Zen, reasoning effort 'max' |
| **Image-to-Text** | HuggingFace BLIP-2 | free inference | Untuk Product Auto-Analyze |
| **PDF Export** | @react-pdf/renderer | latest | Client-side |
| **DOCX Export** | docx | latest | Client-side |
| **Hosting** | Vercel | Hobby (free) | Native Next.js |
| **Analytics** | GA4 + GTM | — | Free, no Sentry |

## 🚫 Hard Constraints (ZERO TOLERANCE)

### Frontend
- ❌ **Emoji as icons** — pakai Phosphor Icons (BUKAN Lucide, BUKAN emoji)
- ❌ **`as any`, `@ts-ignore`, `@ts-expect-error`** — NEVER use type suppression
- ❌ **`catch(e) {}`** — empty catch block. NEVER.
- ❌ **Horizontal overflow** — test di 375px, 768px, 1280px
- ❌ **Pure black `#000` atau pure white `#fff`** — pakai off-black/white dari slate
- ❌ **Gradient text** — `background-clip: text` NEVER
- ❌ **Inline style** — pakai Tailwind classes atau CSS variables
- ❌ **Magic number CSS** — pakai design tokens

### Backend
- ❌ **Hardcoded secrets** — `process.env.X` only
- ❌ **SQL string concat** — pakai parameterized queries
- ❌ **`SELECT *`** — specify columns
- ❌ **Plain text password** — bcrypt/argon2 only
- ❌ **Float untuk uang** — pakai string atau Decimal
- ❌ **No transaction untuk multi-write** — BEGIN/COMMIT required

### DevOps
- ❌ **Run as root di container** — non-root user
- ❌ **Commit `.env`** — `.gitignore` always
- ❌ **Latest tag di production** — pin version
- ❌ **No health check** — `/api/health` endpoint required

### AI/Agent Behavior
- ❌ **Skip evidence** — klaim "selesai" tanpa block EVIDENCE
- ❌ **Ngarang** — bikin API/library yang tidak exist
- ❌ **Asumsi tanpa disclosure** — disclose semua asumsi
- ❌ **Mark task selesai tanpa test pass** — NEVER

## 🔒 Security

- **RLS enabled** on all Supabase tables
- **Auth required** untuk semua dashboard routes (middleware)
- **Rate limiting** (recommended via Vercel Edge Middleware atau Upstash)
- **Input validation** client + server (Zod)
- **No PII in logs** — redact sensitive data
- **Secrets in env vars only** — `OPENCODE_API_KEY`, `HUGGINGFACE_API_KEY`, `NEXT_PUBLIC_SUPABASE_*` (future: `KIMCHI_API_KEY` if switch to Kimchi)

## 📊 Performance Budget

- **Lighthouse Performance**: > 90 (mobile), > 95 (desktop)
- **Lighthouse Accessibility**: > 95
- **Lighthouse Best Practices**: > 95
- **Lighthouse SEO**: > 95
- **LCP**: < 2.5s
- **FID/INP**: < 200ms
- **CLS**: < 0.1
- **Initial JS bundle**: < 200KB gzipped
- **Per-page JS**: < 100KB gzipped
- **CSS**: < 50KB gzipped

## 🛠 DevOps

- **CI/CD**: GitHub → Vercel auto-deploy on push to `main`
- **Branch strategy**: `main` (production), `develop` (staging), `feature/*` (work)
- **Conventional commits**: `feat:`, `fix:`, `chore:`, `docs:`, etc.
- **PR required** untuk merge ke `main`
- **Vercel preview** untuk setiap PR
- **GA4 + GTM** tracking pageviews + custom events (generate, export, dll)

## 📁 Project Structure

```
affiliate-ai-studio/
├── app/                  # Next.js App Router
├── components/           # UI + module components
├── lib/                  # Business logic, AI, Supabase, export
├── types/                # TypeScript types
├── docs/                 # Documentation
├── supabase/             # Supabase config + migrations
├── public/               # Static assets
├── AGENTS.md             # This file (auto-loaded)
├── PROJECT.md            # Project info
├── DESIGN.md             # Design system reference
├── README.md             # Main readme
└── ...config files
```

Lihat `docs/ARCHITECTURE.md` untuk detail arsitektur.

## 🔗 Related Documentation

- **Design Spec**: `docs/superpowers/specs/2026-06-14-affiliate-ai-studio-design.md`
- **Project Info**: `PROJECT.md`
- **Design System**: `DESIGN.md`
- **Architecture**: `docs/ARCHITECTURE.md`
- **User Guide**: `docs/USER_GUIDE.md`
- **Runbook**: `docs/RUNBOOK.md`

## 📝 Last Updated

2026-06-14 — Initial project context setup
