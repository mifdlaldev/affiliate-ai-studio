# PROJECT.md — AffiliateAI Studio

> Project info, client, timeline, status. Read this first untuk context.

## 📋 Project Info

| Field | Value |
|---|---|
| **Project Name** | AffiliateAI Studio |
| **Type** | SaaS Web Application |
| **Status** | 🟡 Planning (design approved, ready for implementation) |
| **Started** | 2026-06-14 |
| **Target Completion** | 2026-08-09 (8 weeks) |
| **Buffer** | +2 weeks (2026-08-23) |
| **Owner** | User (client) |
| **Repo** | TBD |
| **Production URL** | TBD |

## 🎯 What is it?

**AffiliateAI Studio** adalah aplikasi SaaS untuk content creator dan affiliate marketer berbahasa Indonesia. Aplikasi ini membantu user:

1. 📦 **Product Studio** — Upload foto produk + link referensi, AI auto-analyze dan isi form detail
2. 🎨 **AI Prompt Generators** — Generate prompt detail untuk image generation (Photo, Model)
3. 📝 **AI Text Generators** — Generate hooks, scripts, storyboards, captions, descriptions, landing page copy
4. 📅 **Content Calendar** — Generate 30-day content plan
5. 🗂 **Asset Library** — Simpan dan organize semua generated content
6. 📁 **Project Management** — Organize projects (campaign, review, unboxing, dll)
7. 📤 **Export** — Export ke PDF, DOCX, TXT, JSON, CSV

## 🎨 Design Direction

- **Style**: Clean Minimal Modern (Linear/Vercel-inspired)
- **Color**: Indigo primary (`#4f46e5`), slate neutrals
- **Font**: Geist Sans (UI) + Geist Mono (data)
- **Icons**: Phosphor Icons
- **Library**: shadcn/ui + Tailwind CSS v4

## 🛠 Tech Stack

Lihat `AGENTS.md` untuk detail lengkap. Singkatnya:
- **Frontend**: Next.js 16 + TypeScript + Tailwind + shadcn/ui
- **Backend**: Supabase (DB + Auth + Storage)
- **AI**: OpenCode Zen (`deepseek-v4-flash-free`, FREE) + HuggingFace BLIP-2 (image-to-text) + fallback ke Kimchi.dev jika diperlukan
- **Hosting**: Vercel Hobby (free)

## 👤 Client Info

- **Client**: TBD
- **PIC**: TBD
- **Channel**: TBD
- **Budget**: $0 (free tiers only, exclude domain)
- **Payment Terms**: N/A (solo project)

## 📅 Timeline & Phases

| Phase | Week | Status | Deliverables |
|---|---|---|---|
| **Brainstorming + Design** | 0 (Jun 14) | ✅ Done | Design spec approved |
| **Phase 1: Foundation** | 1-2 (Jun 15-28) | 🔴 Pending | Setup, Auth, DB, Dashboard, Product Studio |
| **Phase 2: Core AI** | 2-3 (Jun 29-Jul 12) | 🔴 Pending | Photo/Model Prompt, UGC, Storyboard |
| **Phase 3: Strategy** | 3-4 (Jul 13-26) | 🔴 Pending | Competitor, Batch, Calendar, Live Host |
| **Phase 4: Platform** | 4-5 (Jul 27-Aug 9) | 🔴 Pending | Marketplace, Social, Landing |
| **Phase 5: Library & Export** | 5-6 (Aug 10-23) | 🔴 Pending | Asset Library, Projects, Export |
| **Phase 6: Polish** | 6-7 (Aug 24-Sep 6) | 🔴 Pending | Mobile, A11y, Performance, SEO |
| **Phase 7: Production** | 7-8 (Sep 7-20) | 🔴 Pending | E2E, Security, Deploy, GA4, Docs |
| **Buffer** | 9-10 (Sep 21-Oct 4) | 🔴 Pending | Bug fixing, scope adjustment |

## 💰 Cost Estimation

| Service | Cost | Notes |
|---|---|---|
| **Vercel Hobby** | $0/bulan | 100GB bandwidth, OK untuk development & low-traffic production |
| **Supabase Free** | $0/bulan | 500MB DB, 1GB storage, pauses after 1 week inaktif |
| **OpenCode Zen** | $0/bulan | Free models (deepseek-v4-flash-free). Backup: DeepSeek paid ($0.02/user/mo) atau Kimchi.dev ($0.09/user/mo) |
| **HuggingFace Inference** | $0/bulan | Free tier |
| **Domain** | ~$10-15/tahun | Namecheap, Cloudflare Registrar, atau Porkbun |
| **TOTAL** | **~$1/bulan** (exclude domain) | |

⚠️ Catatan: Zero cost workable untuk development + low-traffic. Untuk production aktif dengan banyak user, mungkin perlu upgrade ke Vercel Pro ($20/bulan) dan Supabase Pro ($25/bulan).

## 📊 Success Metrics (Target Production)

- **Lighthouse Performance**: > 90
- **Lighthouse Accessibility**: > 95
- **Lighthouse Best Practices**: > 95
- **Lighthouse SEO**: > 95
- **Module completeness**: 18/18 (100%)
- **AI integration success rate**: > 95%
- **Export success rate**: > 99%
- **User satisfaction**: TBD (no analytics yet)
- **Uptime**: > 99.5% (Vercel SLA)

## 🔗 Documentation

- **Design Spec**: `docs/superpowers/specs/2026-06-14-affiliate-ai-studio-design.md` (FULL design)
- **Architecture**: `docs/ARCHITECTURE.md` (system design)
- **User Guide**: `docs/USER_GUIDE.md` (how to use)
- **Runbook**: `docs/RUNBOOK.md` (operations)
- **Design System**: `DESIGN.md` (colors, typography, components)
- **Auto-loaded Context**: `AGENTS.md` (rules, stack, constraints)

## 📝 Changelog

- **2026-06-14**: Project init. Brainstorming + design spec approved. Ready for implementation.

## 🚀 Next Steps

1. **Setup project** (Next.js 16 init, Supabase project, pnpm install)
2. **Phase 1 deliverables**: Auth, DB schema, dashboard layout, Product Studio
3. **Iteration**: Per phase, deliver → review → adjust

---

**Maintained by**: User (solo developer)
**Last updated**: 2026-06-14
