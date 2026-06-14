# AffiliateAI Studio

> **AI-Powered Marketing Content Studio untuk Affiliate Indonesia.**
> Buat hooks, scripts, storyboards, captions, dan prompt image generation dalam hitungan detik.

![Status](https://img.shields.io/badge/status-design%20approved-yellow)
![Stack](https://img.shields.io/badge/stack-Next.js%2016%20%7C%20Supabase%20%7C%20Tailwind-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🎯 What is it?

**AffiliateAI Studio** adalah SaaS yang membantu content creator dan affiliate marketer Indonesia membuat materi pemasaran berkualitas tinggi dengan bantuan AI:

- 📦 **Product Studio** — Upload foto produk, AI auto-fill detail dari gambar + link
- 🎨 **AI Prompt Generators** — Generate prompt detail untuk image generation (Photo & Model)
- 📝 **AI Content Generators** — Hooks, scripts, storyboards, captions, descriptions, landing page copy
- 📅 **Content Calendar** — 30-day content plan otomatis
- 🗂 **Asset Library** — Simpan dan organize semua generated content
- 📁 **Project Management** — Organize campaigns, reviews, unboxings
- 📤 **Export** — PDF, DOCX, TXT, JSON, CSV

Lihat **[Design Spec](docs/superpowers/specs/2026-06-14-affiliate-ai-studio-design.md)** untuk detail lengkap.

## 🛠 Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **UI**: Tailwind CSS v4 + shadcn/ui + Phosphor Icons
- **Font**: Geist Sans + Geist Mono
- **Backend**: Supabase (Postgres + Auth + Storage)
- **AI Text**: OpenCode Zen (`deepseek-v4-flash-free`, FREE) — dengan fallback ke DeepSeek paid atau Kimchi.dev
- **AI Vision**: OpenCode Zen (`mimo-v2.5-free` — Xiaomi MiMo-V2.5, FREE, native image input)
- **Hosting**: Vercel Hobby (free)
- **Analytics**: Google Analytics 4 + Google Tag Manager

## 🚀 Quick Start

### Prerequisites

- Node.js 22 LTS
- pnpm 9.x
- Supabase account (free)
- OpenCode Zen account (free models, https://opencode.ai/zen)
- (Optional) Kimchi.dev account (paid backup, only if OpenCode Zen free model unavailable)
- HuggingFace account (free)

### Installation

```bash
# Clone repo
git clone <repo-url>
cd affiliate-ai-studio

# Install dependencies
pnpm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local dengan credentials Anda

# Setup Supabase
# 1. Buat project baru di https://supabase.com
# 2. Copy URL + anon key + service role key ke .env.local
# 3. Run migrations
pnpm supabase db push

# Start dev server
pnpm dev
```

Buka [http://localhost:3000](http://localhost:3000)

### Environment Variables

Lihat `.env.example` untuk template lengkap. Required:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# OpenCode Zen
OPENCODE_API_KEY=

# (Optional) Kimchi.dev - backup provider if OpenCode Zen free model unavailable
# KIMCHI_API_KEY=

# HuggingFace (no longer needed — vision handled by OpenCode Zen MiMo-V2.5)
# HUGGINGFACE_API_KEY=

# Google Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_GTM_ID=
```

## 📁 Project Structure

```
affiliate-ai-studio/
├── app/                  # Next.js App Router
│   ├── (auth)/           # Login, signup, callback
│   ├── (dashboard)/      # Protected routes
│   └── api/              # API routes
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── modules/          # Module-specific components
│   └── shared/           # Shared components
├── lib/
│   ├── ai/               # AI client + prompts
│   ├── supabase/         # Supabase client (server + browser)
│   ├── export/           # Export utilities
│   ├── usage/            # Usage tracking
│   └── utils/            # Helpers
├── supabase/             # DB migrations
├── docs/                 # Documentation
└── ...config files
```

Lihat [ARCHITECTURE.md](docs/ARCHITECTURE.md) untuk system architecture.

## 📚 Documentation

- 📋 **[Design Spec](docs/superpowers/specs/2026-06-14-affiliate-ai-studio-design.md)** — Complete design specification
- 🏗 **[Architecture](docs/ARCHITECTURE.md)** — System architecture & data flow
- 🎨 **[Design System](DESIGN.md)** — Colors, typography, components
- 👤 **[User Guide](docs/USER_GUIDE.md)** — How to use the app
- 🛠 **[Runbook](docs/RUNBOOK.md)** — Operations & deployment
- 🤖 **[AGENTS.md](AGENTS.md)** — Project context for AI tools
- 📦 **[PROJECT.md](PROJECT.md)** — Project info & timeline

## 🎨 Design Direction

**Clean Minimal Modern** — Linear/Vercel-inspired.

- **Primary**: Indigo `#4f46e5`
- **Background**: Slate-50 `#f8fafc`
- **Font**: Geist Sans (UI) + Geist Mono (data)
- **Icons**: Phosphor Icons (regular + bold weights)

Lihat [DESIGN.md](DESIGN.md) untuk design system lengkap.

## 📅 Timeline

| Phase | Status | ETA |
|---|---|---|
| Brainstorming + Design | ✅ Done | 2026-06-14 |
| Phase 1: Foundation | 🔴 Pending | Jun 15-28 |
| Phase 2: Core AI | 🔴 Pending | Jun 29-Jul 12 |
| Phase 3: Strategy | 🔴 Pending | Jul 13-26 |
| Phase 4: Platform | 🔴 Pending | Jul 27-Aug 9 |
| Phase 5: Library & Export | 🔴 Pending | Aug 10-23 |
| Phase 6: Polish | 🔴 Pending | Aug 24-Sep 6 |
| Phase 7: Production | 🔴 Pending | Sep 7-20 |

Lihat [PROJECT.md](PROJECT.md) untuk detail.

## 💰 Cost

**$0/bulan** (exclude domain ±$10-15/tahun)

- Vercel Hobby: Free
- Supabase Free: Free (500MB DB, 1GB storage)
- OpenCode Zen: Free ($0/1M token — `deepseek-v4-flash-free`)
- HuggingFace: Free tier

## 📝 License

MIT License

## 🙏 Credits

Built with:
- [Next.js](https://nextjs.org)
- [Supabase](https://supabase.com)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Phosphor Icons](https://phosphoricons.com)
- [Geist Font](https://vercel.com/font)
- [OpenCode Zen](https://opencode.ai/zen) (AI Text)
- [DeepSeek V4 Flash](https://api-docs.deepseek.com/news/news260424) (Model)
- [HuggingFace](https://huggingface.co) (Image-to-Text)

---

**Maintained by**: User (solo developer)
**Last updated**: 2026-06-14
