# AffiliateAI Studio — Design Specification

**Date**: 2026-06-14
**Status**: ✅ Approved (ready for implementation planning)
**Author**: Sisyphus (AI orchestration) + User (client)
**Source Sample**: `dashboard_affiliate_ai.tsx` (1463 lines, single-file React mockup)

---

## 0. Executive Summary

**AffiliateAI Studio** adalah SaaS production-grade untuk content creator dan affiliate marketer berbahasa Indonesia. Aplikasi ini membantu user membuat materi pemasaran (hooks, scripts, storyboards, deskripsi produk, caption, landing page copy, dll) menggunakan AI, plus menghasilkan prompt detail untuk image generation yang di-eksekusi eksternal via ChatGPT.

### Key Decisions (TL;DR)
- **Stack**: Next.js 16.2.9 (App Router) + Supabase + Tailwind + shadcn/ui + Phosphor Icons + Geist Sans/Mono
- **AI Text**: OpenCode Zen (`deepseek-v4-flash-free`) — **FREE** ($0/0 per 1M token, reasoning effort 'max')
- **AI Image**: User generate eksternal via ChatGPT (kita hanya generate prompt)
- **Auth**: Supabase Auth (Magic Link + Google OAuth)
- **Hosting**: Vercel Hobby (free tier)
- **Cost Target**: $0/bulan (exclude domain ±$10-15/tahun)
- **Data Model**: Solo only (1 user = 1 workspace, no team/org)
- **Monetization**: 100% free untuk user
- **Design**: Clean Minimal Modern (Linear/Vercel-inspired)
- **Timeline**: 8 minggu (10 dengan buffer), 18 modul

### Sample Reference
File sample `dashboard_affiliate_ai.tsx` adalah mockup UI lengkap dengan 12+ modul. Semua modul akan dibangun ulang dengan real AI integration, real database, real auth, dan production-grade quality.

---

## 1. Tech Stack & Architecture

### 1.1 Stack Final

| Layer | Technology | Version | Alasan |
|---|---|---|---|
| **Framework** | Next.js | 16.2.9 (latest stable, 2026-06-10) | Server Components, Server Actions, native Vercel |
| **Language** | TypeScript | 5.x (strict mode) | Type safety, no `any` |
| **Runtime** | Node.js | 22 LTS | Required by Next.js 16 |
| **Package Manager** | pnpm | 9.x | Fast, disk-efficient |
| **Styling** | Tailwind CSS | v4 | Industry standard, v4 lebih cepat |
| **Components** | shadcn/ui | latest | Copy-paste, fully customizable |
| **Icons** | Phosphor Icons | latest (regular + bold weight) | 6 weight variants, MIT, 9000+ icons, ideal untuk SaaS |
| **Font (UI)** | Geist Sans | variable, OFL-1.1 | Vercel's font, distinctive letter shapes, 114KB |
| **Font (Data)** | Geist Mono | variable, OFL-1.1 | Untuk numerical data, code, JSON preview |
| **Database** | Supabase Postgres | latest | Free 500MB, RLS built-in, mudah setup |
| **Auth** | Supabase Auth | latest | Magic Link + Google OAuth, free, no third-party |
| **Storage** | Supabase Storage | latest | Free 1GB, integrated with auth |
| **AI Text** | OpenCode Zen (`deepseek-v4-flash-free`) | OpenAI-compatible | **FREE** (OpenCode Zen curated), $0/0 per 1M token. **Future option**: Kimchi.dev (`minimax-m2.7`) — kept as draft, switch kalau ada biaya |
| **Image-to-Text** | HuggingFace BLIP-2 | free inference | Untuk Product Auto-Analyze, no API key needed |
| **PDF Export** | @react-pdf/renderer | latest | Client-side PDF, no Puppeteer |
| **DOCX Export** | docx | latest | Client-side Word document |
| **Hosting** | Vercel | Hobby (free) | Native Next.js, auto-deploy, free SSL |
| **CI/CD** | GitHub + Vercel | — | Auto-deploy on push to main |
| **Analytics** | Google Analytics 4 + Google Tag Manager | — | Free, standar industri |
| **Linting** | ESLint + Prettier | latest | Standard, Next.js config |
| **Testing** | Vitest + React Testing Library + Playwright | latest | Unit + integration + E2E |

### 1.2 Architecture Pattern

- **Server Components** sebagai default untuk data fetching (no client-side fetching unless needed)
- **Server Actions** untuk mutations (create, update, delete) — no manual API routes unless untuk webhook
- **Client Components** hanya untuk interaktif: forms, modals, animations, real-time updates
- **Row Level Security (RLS)** di Supabase — user hanya bisa akses data miliknya
- **Streaming** dengan React Suspense + Server-Sent Events untuk long AI generation
- **API routes** hanya untuk:
  - Auth callback (`/api/auth/callback`)
  - Image upload proxy (jika perlu)
  - Webhook receiver (future)

### 1.3 Folder Structure (Planned)

```
affiliate-ai-studio/
├── app/
│   ├── (auth)/                       # Group: unauthenticated routes
│   │   ├── login/page.tsx            # Magic link + Google login
│   │   ├── signup/page.tsx           # Onboarding flow
│   │   ├── callback/route.ts         # OAuth callback
│   │   └── layout.tsx                # Minimal auth layout
│   ├── (dashboard)/                  # Group: protected routes
│   │   ├── layout.tsx                # Sidebar + top bar
│   │   ├── page.tsx                  # Dashboard home (overview)
│   │   ├── produk/                   # Product Studio
│   │   │   └── page.tsx
│   │   ├── generator/                # AI Generator (sub-tabs)
│   │   │   ├── page.tsx              # Product Analyzer
│   │   │   ├── photo/page.tsx        # Photo Prompt Generator
│   │   │   ├── model/page.tsx        # Model Prompt Generator
│   │   │   ├── competitor/page.tsx   # Competitor Analyzer
│   │   │   ├── batch/page.tsx        # Batch Generator
│   │   │   └── kalender/page.tsx     # Content Calendar
│   │   ├── ugc/                      # UGC Generator (4 sub-tabs)
│   │   │   ├── page.tsx              # Hooks
│   │   │   ├── script/page.tsx
│   │   │   ├── storyboard/page.tsx
│   │   │   └── prompt/page.tsx
│   │   ├── storyboard/page.tsx       # Standalone Storyboard
│   │   ├── live-host/page.tsx
│   │   ├── marketplace/page.tsx
│   │   ├── social/page.tsx
│   │   ├── landing/page.tsx
│   │   ├── assets/page.tsx
│   │   ├── projects/page.tsx
│   │   ├── settings/page.tsx
│   │   └── export/page.tsx           # Export Center
│   ├── api/                          # API routes
│   │   ├── auth/callback/route.ts
│   │   ├── ai/stream/route.ts        # SSE streaming untuk AI
│   │   └── upload/route.ts           # File upload proxy
│   ├── layout.tsx                    # Root layout
│   ├── page.tsx                      # Landing/marketing page
│   └── globals.css
├── components/
│   ├── ui/                           # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── modules/                      # Module-specific components
│   │   ├── product-studio/
│   │   ├── ai-generator/
│   │   ├── ugc/
│   │   └── ...
│   ├── shared/                       # Shared components
│   │   ├── sidebar.tsx
│   │   ├── top-bar.tsx
│   │   ├── ai-progress-modal.tsx
│   │   ├── prompt-output-box.tsx
│   │   ├── empty-state.tsx
│   │   ├── stat-card.tsx
│   │   └── ...
│   └── marketing/                    # Landing page components
├── lib/
│   ├── ai/
│   │   ├── client.ts                 # OpenAI-compatible OpenCode Zen client
│   │   ├── prompts/                  # Prompt templates per module
│   │   │   ├── photo.ts
│   │   │   ├── model.ts
│   │   │   ├── ugc.ts
│   │   │   └── ...
│   │   ├── retry.ts                  # Retry logic
│   │   ├── stream.ts                 # SSE streaming helper
│   │   └── cache.ts                  # Request caching
│   ├── supabase/
│   │   ├── server.ts                 # Server-side client
│   │   ├── client.ts                 # Browser client
│   │   ├── middleware.ts             # Auth middleware
│   │   └── types.ts                  # Generated types
│   ├── export/
│   │   ├── pdf.ts                    # @react-pdf/renderer
│   │   ├── docx.ts                   # docx library
│   │   ├── txt.ts
│   │   ├── json.ts
│   │   └── csv.ts                    # papaparse
│   ├── utils/
│   │   ├── cn.ts                     # className helper
│   │   ├── format.ts                 # Format helpers (currency, date)
│   │   ├── validation.ts             # Zod schemas
│   │   └── ...
│   ├── usage/                        # Usage tracking
│   │   ├── limits.ts
│   │   └── tracking.ts
│   └── image-analysis/               # HuggingFace BLIP-2 integration
│       └── blip.ts
├── types/                            # Shared TypeScript types
│   ├── database.ts                   # Supabase generated
│   ├── api.ts
│   └── ...
├── docs/                             # Documentation
│   ├── ARCHITECTURE.md
│   ├── USER_GUIDE.md
│   ├── RUNBOOK.md
│   └── superpowers/
│       ├── specs/
│       │   └── 2026-06-14-affiliate-ai-studio-design.md  (this file)
│       └── plans/                    # Future: implementation plans
├── supabase/                         # Supabase config
│   ├── migrations/                   # SQL migrations
│   ├── functions/                    # Edge functions (jika ada)
│   └── config.toml
├── public/                           # Static assets
│   ├── favicon.ico
│   ├── logo.svg
│   └── ...
├── .env.example                      # Environment variables template
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── next.config.ts
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── AGENTS.md                         # Project context (auto-loaded)
├── PROJECT.md                        # Project info
├── DESIGN.md                         # Design system reference
└── README.md                         # Main readme
```

---

## 2. Data Model & Database Schema

### 2.1 Tables Overview

Total **7 tables** + 1 Supabase-managed (`auth.users`).

### 2.2 Table Schemas

#### `user_profiles` (extends `auth.users`)
```sql
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  onboarding_completed BOOLEAN DEFAULT false,
  monthly_generation_count INT DEFAULT 0,
  monthly_reset_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `products`
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  price TEXT,  -- String untuk support "Rp 150.000" atau range
  target_market TEXT,
  usp TEXT,  -- Unique Selling Point
  benefits TEXT,
  image_url TEXT,  -- Supabase Storage URL
  reference_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### `projects`
```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Aktif' CHECK (status IN ('Aktif', 'Diarsipkan')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ
);
```

#### `assets` (unified library)
```sql
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'text', 'document', 'video')),
  subtype TEXT,  -- 'hook', 'script', 'storyboard', 'caption', etc.
  name TEXT NOT NULL,
  file_url TEXT,  -- For images/videos
  content TEXT,  -- For text-based assets
  thumbnail_url TEXT,
  metadata JSONB DEFAULT '{}',
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `generations` (AI history)
```sql
CREATE TABLE generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  module TEXT NOT NULL,  -- 'photo_prompt' | 'model_prompt' | 'competitor' | 'batch' | 'calendar' | 'ugc_hooks' | 'ugc_script' | 'ugc_storyboard' | 'ugc_prompt' | 'storyboard' | 'live_host' | 'marketplace' | 'social_media' | 'landing_page' | 'product_analyze'
  subtype TEXT,
  input_prompt TEXT,
  result JSONB,
  tokens_used INT,
  duration_ms INT,
  model TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `product_analyses` (output dari Product Auto-Analyze)
```sql
CREATE TABLE product_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('image', 'link', 'both')),
  source_url TEXT,
  analysis_result JSONB NOT NULL,
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### `competitor_analyses`
```sql
CREATE TABLE competitor_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tiktok_url TEXT,
  shopee_url TEXT,
  analysis_result JSONB NOT NULL,
  tokens_used INT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 2.3 Entity Relationship Diagram

```
auth.users (Supabase)
    │
    ├── 1:1 ─→ user_profiles
    │
    ├── 1:N ─→ products
    │              │
    │              ├── 1:N ─→ assets
    │              └── 1:N ─→ generations
    │
    ├── 1:N ─→ projects
    │              │
    │              ├── 1:N ─→ assets
    │              └── 1:N ─→ generations
    │
    ├── 1:N ─→ assets (langsung, tanpa project)
    ├── 1:N ─→ generations (langsung, tanpa project)
    ├── 1:N ─→ product_analyses
    └── 1:N ─→ competitor_analyses
```

### 2.4 Row Level Security (RLS)

**WAJIB untuk semua tabel**:
```sql
-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy: user hanya bisa akses data miliknya
CREATE POLICY "Users can manage their own products"
ON products FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
```

Pattern sama untuk semua tabel (products, projects, assets, generations, product_analyses, competitor_analyses).

### 2.5 Indexes

```sql
-- FK indexes
CREATE INDEX idx_products_user_id ON products(user_id);
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_assets_user_id ON assets(user_id);
CREATE INDEX idx_generations_user_id ON generations(user_id);
CREATE INDEX idx_product_analyses_user_id ON product_analyses(user_id);
CREATE INDEX idx_competitor_analyses_user_id ON competitor_analyses(user_id);

-- Composite untuk query pattern umum
CREATE INDEX idx_assets_user_type ON assets(user_id, type);
CREATE INDEX idx_assets_user_project ON assets(user_id, project_id);
CREATE INDEX idx_generations_user_module ON generations(user_id, module);
CREATE INDEX idx_generations_user_project ON generations(user_id, project_id);

-- Sorting
CREATE INDEX idx_assets_created_at ON assets(created_at DESC);
CREATE INDEX idx_generations_created_at ON generations(created_at DESC);
```

### 2.6 Soft Usage Limits

- **Default**: 50 AI generations per user per month
- **Tracked di**: `user_profiles.monthly_generation_count`
- **Reset**: Otomatis setiap awal bulan (check pada read)
- **Enforcement**: Atomic check + increment via Postgres function
- **Friendly message**: "Anda sudah mencapai 50 generate bulan ini. Tunggu bulan depan atau hubungi support."

---

## 3. AI Integration Architecture

### 3.1 AI Client Setup

**Primary Provider: OpenCode Zen** (https://opencode.ai/zen/v1) — curated set of models oleh OpenCode, OpenAI-compatible API. Model yang digunakan: `deepseek-v4-flash-free` dengan reasoning effort "max" (best quality).

```typescript
// lib/ai/client.ts
import OpenAI from 'openai';

export const aiClient = new OpenAI({
  apiKey: process.env.OPENCODE_API_KEY!,
  baseURL: 'https://opencode.ai/zen/v1',
});

export const DEFAULT_TEXT_MODEL = 'deepseek-v4-flash-free';
export const REASONING_EFFORT = 'max'; // 'max' | 'high' | 'low' (or 'non-thinking')
```

**Model Specs (DeepSeek V4 Flash)**:
- 284B total params (13B active)
- 1M token context window
- 384K max output
- MIT licensed
- Supports: text generation, function calling, tool use, structured outputs, JSON mode
- Variants: Non-thinking (fast), Think High (balanced), Think Max (best quality, slower)

**Future Provider: Kimchi.dev** (kept as draft, switch when budget available):
- Model: `minimax-m2.7` ($0.30 input / $1.20 output per 1M token)
- Same OpenAI-compatible interface, just change `baseURL` + `apiKey`

### 3.2 Module-by-Module AI Logic

**All modules use `deepseek-v4-flash-free` with reasoning effort `'max'` (default).** Override per-module jika perlu (e.g., simple tasks bisa pakai 'high' atau 'non-thinking' untuk speed).

| Modul | Input | Output (JSON Schema) | Model | Reasoning | Avg Token |
|---|---|---|---|---|---|
| **Product Auto-Analyze** | image_url + reference_link | `{name, category, brand, price, target, usp, benefits}` | BLIP-2 + deepseek-v4-flash-free | max | ~1000 |
| **Photo Prompt Generator** | product_name, style, lighting, camera, ratio, background | `{prompt, variations: []}` | deepseek-v4-flash-free | max | ~400 |
| **Model Prompt Generator** | preset, gender, age, ethnicity, fashion, expression | `{character_description, image_prompt, styling_notes}` | deepseek-v4-flash-free | max | ~500 |
| **Competitor Analyzer** | tiktok_url, shopee_url | `{strengths, weaknesses, opportunities, content_gaps, recommended_strategy}` | deepseek-v4-flash-free | max | ~1500 |
| **Batch Generator** | product, options{hook,script,storyboard,prompt}, platform | `{hook, script, storyboard, prompt}` | deepseek-v4-flash-free | max | ~2000 |
| **Content Calendar** | product, platform, duration | `[{day, theme, format, hook, cta, hashtags}]` (30 items) | deepseek-v4-flash-free | max | ~3000 (streaming) |
| **UGC Hooks** | product, usp, target | `{hooks: []}` (10 hooks) | deepseek-v4-flash-free | high | ~600 |
| **UGC Script** | product, usp, target, duration | `{script, scenes, voiceover_notes}` | deepseek-v4-flash-free | max | ~1500 |
| **UGC Storyboard** | product, usp, target, duration | `[{scene, visual, narasi, camera, duration}]` | deepseek-v4-flash-free | max | ~1500 |
| **UGC Prompt** | product, usp, target | `{video_prompts: [], voice_prompts: []}` | deepseek-v4-flash-free | high | ~800 |
| **Storyboard Generator** | duration, platform, scenes | `[{scene, visual, narasi}]` | deepseek-v4-flash-free | max | ~1200 |
| **Live Host AI** | product, usp, host_type | `{opening, product_intro, demo, qa_prompts, closing_cta}` | deepseek-v4-flash-free | max | ~2000 |
| **Marketplace Content** | product, usp, platform | `{title, bullets, description, tags, seo_keywords}` | deepseek-v4-flash-free | high | ~1000 |
| **Social Media Content** | product, usp, platform | `{caption, hashtags, emoji_suggestions, posting_time_suggestion}` | deepseek-v4-flash-free | high | ~500 |
| **Landing Page Generator** | product, usp, target | `{headline, subheadline, features, social_proof, cta}` (AIDA) | deepseek-v4-flash-free | max | ~1500 |

**Reasoning Effort Strategy**:
- **`max`** (default): Best quality, slowest. Untuk task kompleks (analysis, multi-step, long-form content).
- **`high`**: Balanced. Untuk structured output yang well-defined (hooks, captions, descriptions).
- **`non-thinking`** (future): Fastest. Untuk simple tasks (jika perlu optimize latency).

### 3.3 Prompt Engineering

Setiap modul punya **prompt template** di `lib/ai/prompts/`. Pattern:

```typescript
export const PHOTO_PROMPT_TEMPLATE = (input: PhotoInput) => `
Anda adalah product photography director. Buatkan prompt detail untuk image generation AI.

Produk: ${input.productName}
Style: ${input.style}
Lighting: ${input.lighting}
Camera: ${input.camera}
Aspect Ratio: ${input.ratio}
Background: ${input.background}

Output JSON schema:
{
  "prompt": "string (prompt detail bahasa Inggris untuk image AI)",
  "variations": ["string (3 alternatif prompt)"]
}

Constraints:
- Prompt dalam bahasa Inggris (untuk image AI)
- Detail dan spesifik (lighting angle, camera settings, mood)
- Variations harus berbeda angle/mood/style
- Output HANYA JSON, tidak ada text lain
`;
```

### 3.4 Error Handling & Retry

```typescript
// lib/ai/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options = { maxRetries: 3, baseDelay: 1000 }
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < options.maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isLast = i === options.maxRetries - 1;
      const isRateLimit = error?.status === 429;
      
      if (isLast) throw lastError;
      
      const delay = isRateLimit
        ? (parseInt(error.headers?.['retry-after'] || '5') * 1000)
        : options.baseDelay * Math.pow(2, i);
      
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError!;
}
```

### 3.5 Streaming (SSE) untuk Long Generation

Untuk Content Calendar, Batch Generator, Storyboard — pakai Server-Sent Events:

```typescript
// app/api/ai/stream/route.ts
import { aiClient, DEFAULT_TEXT_MODEL } from '@/lib/ai/client';

export async function POST(req: Request) {
  const { prompt } = await req.json();
  
  const stream = await aiClient.chat.completions.create({
    model: DEFAULT_TEXT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });
  
  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
      }
      controller.close();
    },
  });
  
  return new Response(readable, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

UI: progress bar + partial output yang update real-time.

### 3.6 Token Tracking

Setiap AI call otomatis log ke `generations` table:

```typescript
const completion = await aiClient.chat.completions.create({...});
const tokensUsed = completion.usage?.total_tokens || 0;

await supabase.from('generations').insert({
  user_id: user.id,
  module: 'photo_prompt',
  input_prompt: prompt,
  result: completion.choices[0].message.content,
  tokens_used: tokensUsed,
  model: 'deepseek-v4-flash-free',
  duration_ms: Date.now() - startTime,
  status: 'success',
});
```

### 3.7 Soft Limits Enforcement

```typescript
// lib/usage/limits.ts
export async function checkAndIncrementUsage(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const supabase = createServerClient();
  
  // Atomic increment via RPC
  const { data, error } = await supabase.rpc('increment_user_usage', {
    p_user_id: userId,
  });
  
  if (error) throw error;
  return { allowed: data.allowed, remaining: data.remaining };
}
```

```sql
-- Postgres function untuk atomic increment
CREATE OR REPLACE FUNCTION increment_user_usage(p_user_id UUID)
RETURNS TABLE(allowed BOOLEAN, remaining INT) AS $$
DECLARE
  v_count INT;
  v_limit INT := 50;
BEGIN
  SELECT monthly_generation_count INTO v_count
  FROM user_profiles WHERE id = p_user_id FOR UPDATE;
  
  -- Reset jika bulan baru
  IF (SELECT date_trunc('month', monthly_reset_at) FROM user_profiles WHERE id = p_user_id)
     < date_trunc('month', now()) THEN
    UPDATE user_profiles
    SET monthly_generation_count = 1, monthly_reset_at = now()
    WHERE id = p_user_id;
    RETURN QUERY SELECT TRUE, v_limit - 1;
  ELSE
    IF v_count >= v_limit THEN
      RETURN QUERY SELECT FALSE, 0;
    ELSE
      UPDATE user_profiles
      SET monthly_generation_count = monthly_generation_count + 1
      WHERE id = p_user_id;
      RETURN QUERY SELECT TRUE, v_limit - (v_count + 1);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

### 3.8 Caching

Identical requests di-cache **1 jam**:

```typescript
// lib/ai/cache.ts
import { LRUCache } from 'lru-cache';

const cache = new LRUCache<string, any>({ max: 500, ttl: 3600 * 1000 });

export function getCachedResult<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCachedResult(key: string, value: any): void {
  cache.set(key, value);
}
```

Key = `hash(module + input + userId)`.

### 3.9 Image Analysis (HuggingFace BLIP-2 + deepseek-v4-flash-free)

Untuk **Product Auto-Analyze**:
1. User upload image → upload ke Supabase Storage → get URL
2. HuggingFace BLIP-2 analyze image → get text description
3. Combine description + link metadata → kirim ke deepseek-v4-flash-free
4. deepseek-v4-flash-free generate product details (JSON)
5. Save ke `product_analyses` table

```typescript
// lib/image-analysis/blip.ts
export async function analyzeImage(imageUrl: string): Promise<string> {
  const response = await fetch(
    'https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      },
      body: JSON.stringify({ inputs: imageUrl }),
    }
  );
  
  if (!response.ok) throw new Error('BLIP-2 failed');
  const result = await response.json();
  return result[0]?.generated_text || '';
}
```

### 3.10 Fallback Strategy (jika OpenCode Zen free model unavailable)

**Skenario**: OpenCode Zen free models "available for a limited time" — bisa dihapus sewaktu-waktu. Kita perlu abstraction layer untuk easy switch.

**Design**: AI client (`lib/ai/client.ts`) adalah single point of configuration. Switching provider/model = ubah env var + base URL, no business logic changes.

```typescript
// lib/ai/config.ts
export const AI_CONFIG = {
  primary: {
    baseURL: 'https://opencode.ai/zen/v1',
    apiKey: process.env.OPENCODE_API_KEY!,
    model: 'deepseek-v4-flash-free',
    reasoning: 'max',
  },
  fallbacks: [
    {
      name: 'DeepSeek V4 Flash (paid)',
      baseURL: 'https://opencode.ai/zen/v1',
      apiKey: process.env.OPENCODE_API_KEY!,
      model: 'deepseek-v4-flash',
      reasoning: 'max',
      cost: '$0.14 input / $0.28 output per 1M token',
    },
    {
      name: 'Kimchi.dev minimax-m2.7',
      baseURL: 'https://api.kimchi.dev/v1',
      apiKey: process.env.KIMCHI_API_KEY!,
      model: 'minimax-m2.7',
      reasoning: 'default',
      cost: '$0.30 input / $1.20 output per 1M token',
    },
    {
      name: 'Kimchi.dev kimi-k2.5',
      baseURL: 'https://api.kimchi.dev/v1',
      apiKey: process.env.KIMCHI_API_KEY!,
      model: 'kimi-k2.5',
      reasoning: 'default',
      cost: '$0.60 input / $3.00 output per 1M token',
    },
  ],
};
```

**Migration procedure** (kalau primary gagal):
1. Detect failure (404 model not found, atau rate limit 429 persistent)
2. Log warning ke console + Vercel logs
3. Switch ke fallback (deepseek-v4-flash paid atau Kimchi)
4. Display user-friendly banner: "AI service switched to backup. Responses may have slight quality differences."
5. Email admin untuk manual investigation

**Prompt template compatibility**: Karena semua provider di list ini OpenAI-compatible dengan JSON mode support, prompt templates tidak perlu diubah saat switch. Reasoning effort mungkin perlu di-mapping per-provider.

**Cost Impact** (worst case — semua pakai paid):
- 50 generations × ~1500 avg output tokens = 75,000 output tokens per user per month
- 75,000 / 1,000,000 = 0.075M output tokens
- DeepSeek V4 Flash paid: 0.075 × $0.28 = $0.021 per user per month (~$0.02)
- Kimchi minimax-m2.7: 0.075 × $1.20 = $0.09 per user per month

Sangat murah even di paid tier. Acceptable risk.

---

## 4. UI/UX Design System

### 4.1 Color Palette

#### Primary (Indigo)
```
indigo-50:  #eef2ff
indigo-100: #e0e7ff
indigo-200: #c7d2fe
indigo-300: #a5b4fc
indigo-400: #818cf8
indigo-500: #6366f1
indigo-600: #4f46e5  ← DEFAULT
indigo-700: #4338ca
indigo-800: #3730a3
indigo-900: #312e81
```

#### Neutral (Slate)
```
slate-50:  #f8fafc  ← Background
slate-100: #f1f5f9  ← Secondary BG
slate-200: #e2e8f0  ← Borders
slate-300: #cbd5e1
slate-400: #94a3b8  ← Placeholder
slate-500: #64748b  ← Secondary text
slate-600: #475569
slate-700: #334155
slate-800: #1e293b  ← Primary text
slate-900: #0f172a
```

#### Semantic
- **Success**: emerald-500 `#10b981` (status aktif, success toasts)
- **Warning**: amber-500 `#f59e0b` (Shopee brand, limit warning)
- **Error**: red-500 `#ef4444` (destructive actions)
- **Info**: sky-500 `#0ea5e9` (links, info toasts)

#### Platform Brand Colors
- **Shopee**: `#f59e0b` (orange)
- **TikTok Shop**: `#1e293b` (slate-800)
- **Tokopedia**: `#10b981` (green)

### 4.2 Typography

- **UI / Heading / Body**: **Geist Sans** (variable, 9 weights)
  - Display/Heading: 700-800
  - Body: 400-500
  - Caption/Label: 400, smaller size
- **Numerical Data / Code**: **Geist Mono** (variable)
  - Table data, prices, numbers, JSON preview

Font sizes (Tailwind):
- text-xs: 12px (caption, table data)
- text-sm: 14px (body small)
- text-base: 16px (body)
- text-lg: 18px (sub-heading)
- text-xl: 20px (heading)
- text-2xl: 24px (page title)
- text-3xl: 30px (hero)

### 4.3 Spacing & Layout

- **Base unit**: 4px (Tailwind default)
- **Sidebar**: 256px wide (collapsible ke 64px on mobile)
- **Top bar**: 64px height
- **Content max-width**: 1280px
- **Card padding**: 24px (p-6)
- **Section gap**: 24px (gap-6)
- **Form gap**: 16px (space-y-4)

### 4.4 Border Radius

- **Default**: 8px (`rounded-lg`)
- **Cards**: 12px (`rounded-xl`)
- **Buttons**: 8px
- **Pills/Badges**: 9999px (`rounded-full`)

### 4.5 Shadows

- **Default card**: `shadow-sm`
- **Hover/elevated**: `shadow-md`
- **Modal/Dropdown**: `shadow-xl`

### 4.6 Component Library

**Base**: shadcn/ui (copy-paste, fully customizable)

**Custom Components**:
- `ModuleGeneratorLayout` (left form + right result panel pattern)
- `AIResponseViewer` (JSON viewer + copy button)
- `AssetCard`, `ProjectCard`, `ProductCard`
- `StatCard` (untuk Asset Library stats)
- `AIProgressModal` (with streaming text)
- `PromptOutputBox` (copy + regenerate + variations)
- `PlatformTabSwitcher` (Shopee/TikTok/IG)
- `ExportPanel` (multi-select format)
- `EmptyState` (icon + heading + CTA)
- `LoadingSkeleton` (for cards, tables)
- `OnboardingModal` (3-step welcome)

### 4.7 Animations

- **Page transitions**: `fade-in 300ms`
- **Section entrance**: `translate-y-2 → 0` + fade
- **Button click**: `scale(0.97)` on `:active`
- **AI generation loading**: `animate-pulse`
- **Card hover**: `scale(1.01)` + shadow-md (subtle)
- **Sidebar toggle**: smooth width transition
- **Modal**: fade + scale (0.95 → 1)
- **`prefers-reduced-motion`**: collapse all animations

### 4.8 Responsive Breakpoints

```
Mobile:   375px+  (sm)
Tablet:   768px+  (md)
Desktop:  1280px+ (lg)
Large:    1536px+ (xl)
```

Mobile-first. Sidebar jadi drawer (slide-in) on mobile.

### 4.9 Accessibility (WCAG 2.2 AA)

- Color contrast ≥ 4.5:1 untuk body text
- Keyboard navigation (Tab, Enter, Escape)
- Focus visible (ring-2 ring-indigo-500)
- ARIA labels untuk icon-only buttons
- Semantic HTML (header, main, nav, section, article)
- Screen reader friendly (sr-only untuk visual-only)
- Alt text untuk semua images
- Form labels yang proper

### 4.10 Empty States Pattern

```
[Icon - 64x64, slate-400]
Heading: "Belum ada [items]"
Description: "Klik tombol di bawah untuk mulai"
[CTA Button - primary color]
```

### 4.11 Loading States

- **Cards**: skeleton placeholder dengan `animate-pulse`
- **Tables**: skeleton rows
- **Buttons**: spinner + disabled state
- **Modals**: full-screen overlay dengan spinner
- **Streaming text**: blinking cursor `▍`

### 4.12 Error States

- **Form validation**: inline error message (red-500) di bawah field
- **API errors**: toast notification (top-right) dengan retry button
- **404**: friendly illustration + "Halaman tidak ditemukan" + back to home
- **500**: "Terjadi kesalahan" + retry button + support link

---

## 5. Module-by-Module Feature List

### A. System & Auth (3 modul)

| # | Modul | Features | Tech |
|---|---|---|---|
| 1 | **Auth Flow** | Magic Link login, Google OAuth, signup/logout, callback handler, session management | Supabase Auth |
| 2 | **Onboarding** | Welcome modal (3 steps), sample data opt-in, "Coba dengan data contoh" button | Client-side |
| 3 | **Dashboard Layout** | Sidebar (collapsible, 256px↔64px), top bar (search, notifications, user menu), responsive drawer on mobile | shadcn/ui + custom |

### B. Product & Asset Management (3 modul)

| # | Modul | Features | AI? |
|---|---|---|---|
| 4 | **Product Studio** | Upload foto, link referensi, Auto-Analyze (BLIP-2 + deepseek-v4-flash-free), form detail (name/category/brand/price/target/USP/benefits), Save/Reset, list saved products | ✅ Real |
| 5 | **Asset Library** | Search, category filter, grid/list view, stat cards per kategori, upload from device, copy AI output, delete | ❌ No AI |
| 6 | **Project Management** | Create/rename/duplicate/archive/delete, table view, modal forms, soft delete | ❌ No AI |

### C. AI Generators — Visual Prompts (2 modul)

| # | Modul | Features | AI Model |
|---|---|---|---|
| 7 | **AI Photo Prompt Generator** | Input: product, style, lighting, camera, ratio, background. Output: detailed prompt + 3 variations. Copy button, history | deepseek-v4-flash-free |
| 8 | **AI Model Prompt Generator** | Input: preset, gender, age, ethnicity, fashion, expression. Output: character description + image prompt | deepseek-v4-flash-free |

### D. AI Generators — Text & Strategy (6 modul)

| # | Modul | Features | AI Model |
|---|---|---|---|
| 9 | **Competitor Analyzer** (PRO badge) | Input: TikTok URL, Shopee URL. Output: SWOT + content gaps + strategy | deepseek-v4-flash-free |
| 10 | **Batch Generator** (PRO badge) | Input: product, options, platform. Output: hook + script + storyboard + prompt in 1 request | deepseek-v4-flash-free |
| 11 | **Content Calendar** (PRO badge) | Input: product, platform, duration. Output: 30-day plan. **Streaming** | deepseek-v4-flash-free |
| 12 | **UGC Generator** (4 sub-tabs) | Hooks (10) / Scripts / Storyboard / Prompt (video/voice). Shared input form | deepseek-v4-flash-free |
| 13 | **Storyboard Generator** | Input: duration, platform, scene count. Output: table | deepseek-v4-flash-free |
| 14 | **Live Host AI** | Input: product, USP, host type. Output: full live streaming script | deepseek-v4-flash-free |

### E. Platform-specific Content (3 modul)

| # | Modul | Features | AI Model |
|---|---|---|---|
| 15 | **Marketplace Content** | Tab: Shopee / TikTok Shop. Output: SEO-optimized title, bullets, description, tags | deepseek-v4-flash-free |
| 16 | **Social Media Content** | Tab: TikTok / Instagram. Output: caption + hashtags + posting time | deepseek-v4-flash-free |
| 17 | **Landing Page Generator** | Input: product, USP, target. Output: AIDA copy | deepseek-v4-flash-free |

### F. Utilities (1 modul)

| # | Modul | Features | Tech |
|---|---|---|---|
| 18 | **Export Center** | Multi-select format (PDF/DOCX/TXT/JSON/CSV), export to file, toast | Client-side (jsPDF, docx, papaparse) |

---

## 6. Success Criteria & Quality Gates

### 6.1 Per Module (WAJIB pass)

- [ ] All inputs have client + server validation (Zod)
- [ ] AI integration functional (real API call, output rendered)
- [ ] Save to DB works
- [ ] Load from DB works
- [ ] Error states designed (network error, AI failure, validation)
- [ ] Empty state designed (no data)
- [ ] Loading state (skeleton/spinner)
- [ ] Mobile responsive (375px, 768px, 1280px)
- [ ] Keyboard accessible (Tab, Enter, Escape)
- [ ] Screen reader friendly (ARIA labels)
- [ ] `prefers-reduced-motion` honored
- [ ] No `as any`, no `@ts-ignore`

### 6.2 Per Phase (gate to next phase)

- [ ] All planned features in phase functional
- [ ] TypeScript strict, lsp_diagnostics clean
- [ ] `pnpm build` exit 0
- [ ] Critical paths have unit/integration tests
- [ ] Lighthouse Performance > 85 (mobile), > 95 (desktop)
- [ ] Lighthouse Accessibility > 95
- [ ] Git committed with conventional commit format
- [ ] Documentation updated

### 6.3 Project-Level (Final Delivery)

- [ ] All 18 modules functional
- [ ] Auth (Magic Link + Google) working
- [ ] All AI integrations real
- [ ] Export 5 format working
- [ ] Database persistence + RLS enforced
- [ ] Soft usage limits enforced
- [ ] CI/CD: GitHub → Vercel auto-deploy
- [ ] GA4 + GTM tracking
- [ ] No critical/high security issues
- [ ] No `as any`, no `@ts-ignore`, no empty catch
- [ ] No hardcoded secrets
- [ ] Mobile responsive (4 breakpoints)
- [ ] WCAG 2.2 AA accessibility
- [ ] Lighthouse Performance > 90
- [ ] Documentation complete (README + ARCHITECTURE + USER_GUIDE + RUNBOOK)

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Goal**: Project setup, auth, dashboard shell, Product Studio

**Deliverables**:
- Project init (Next.js 16, TypeScript, Tailwind v4, pnpm)
- Supabase project setup (DB, Auth, Storage)
- DB schema + migrations (7 tables + RLS + indexes)
- Auth flow (Magic Link + Google OAuth)
- Dashboard layout (sidebar, top bar, responsive)
- shadcn/ui base components
- Design tokens (Tailwind config + CSS variables)
- AI client setup (OpenCode Zen OpenAI-compatible)
- Product Studio (full module)
- Onboarding flow (welcome modal + sample data)

### Phase 2: Core AI Generators (Week 2-3)
**Goal**: Visual prompt generators + UGC + Storyboard

**Deliverables**:
- AI Photo Prompt Generator
- AI Model Prompt Generator
- UGC Generator (4 sub-tabs: Hooks, Script, Storyboard, Prompt)
- Storyboard Generator (standalone)

### Phase 3: Strategy & Calendar (Week 3-4)
**Goal**: Competitor, Batch, Calendar, Live Host

**Deliverables**:
- Competitor Analyzer (PRO)
- Batch Generator (PRO)
- Content Calendar (PRO, with SSE streaming)
- Live Host AI

### Phase 4: Platform Content (Week 4-5)
**Goal**: Marketplace, Social, Landing Page

**Deliverables**:
- Marketplace Content (Shopee + TikTok Shop)
- Social Media Content (TikTok + Instagram)
- Landing Page Generator (AIDA)

### Phase 5: Library & Export (Week 5-6)
**Goal**: Asset Library, Projects, Export

**Deliverables**:
- Asset Library (full)
- Project Management (CRUD)
- Export Center (5 formats: PDF, DOCX, TXT, JSON, CSV)

### Phase 6: Polish & Mobile (Week 6-7)
**Goal**: Responsive, animations, accessibility, perf

**Deliverables**:
- Mobile responsiveness audit
- Animations polish
- Accessibility audit (WCAG 2.2 AA)
- Performance optimization
- SEO (meta tags, sitemap, robots.txt)

### Phase 7: Production & Deploy (Week 7-8)
**Goal**: E2E tests, security, deploy, monitoring, handoff

**Deliverables**:
- E2E tests (Playwright for critical flows)
- Security audit
- Vercel deployment
- GA4 + GTM setup
- Error monitoring
- Documentation finalization
- Handoff (if client)

**Buffer (Week 9-10)**: 2 weeks untuk bug fixing + scope adjustment

---

## 8. Risks & Mitigations

### Top Risks

| Risk | Impact | Probability | Mitigation |
|---|---|---|---|
| **AI prompt quality tidak sesuai ekspektasi** | High | High | Iterasi 3-5x per modul prompt. Build testing phase early. |
| **Timeline slip (8 minggu → 12 minggu)** | Medium | Medium | Phase-based delivery, scope-cut plan ready. |
| **OpenCode Zen free model removed / unavailable** | High | High | Abstraction layer in AI client (lib/ai/client.ts) untuk easy switch. Fallback: DeepSeek V4 Flash paid (OpenCode Zen, $0.14/$0.28 per 1M) atau Kimchi.dev (minimax-m2.7, $0.30/$1.20). Documented di Design Spec Section 3.10. |
| **Vercel Hobby ToS issue (commercial use)** | High | Low | Verify Hobby plan ToS. Upgrade ke Pro ($20/mo) jika perlu. |
| **Export 5 format kompleksitas tinggi** | Medium | Medium | Simple layouts (no complex tables), test di semua browser. |
| **HuggingFace BLIP-2 rate limit / downtime** | Medium | High | Retry + fallback ke "manual entry" mode (user input product details manual). |
| **Single dev burnout** | High | Medium | Realistic timeline (10 weeks), scope-cut plan, focus on P0 first. |
| **Bundle size bloat (Phosphor + shadcn)** | Low | Medium | Tree-shaking, dynamic imports, code splitting. |

### Scope-Cut Plan (jika time runs out)

**Priority Cut Order** (least impact first):
1. **Batch Generator** (PRO badge) — bisa di-skip, user bisa generate manual di modul lain
2. **Content Calendar 30 hari** → reduce ke **14 hari**
3. **PRO badges** — bisa di-keep sebagai visual only, tanpa functional difference
4. **Sample data opt-in** — bisa di-skip (user mulai dari empty)
5. **Onboarding 3 steps** → reduce ke **1 welcome message**
6. **TXT export** — minor, JSON/CSV cukup untuk data export
7. **Settings page** — bisa di-stub dengan "Coming soon"

**MUST KEEP** (P0):
- Auth + Product Studio + minimal 1 AI module working end-to-end
- Core value proposition: AI generates marketing content

---

## 9. Open Questions & Future Considerations

### Open Questions (untuk client nanti)
- Domain name pilihan? (cek `affiliateai.id`, `affiliateai.studio`, alternatif)
- Apakah perlu fitur "share" untuk assets/projects? (saat ini solo only)
- Apakah perlu dark mode? (saat ini light only)
- Apakah perlu internationalization (English version)? (saat ini Indonesian only)

### Future Considerations (post-MVP)
- Team/workspace features (multi-user)
- Stripe integration (paid tiers)
- Real-time collaboration (Supabase Realtime)
- Mobile app (React Native)
- Public API untuk integrasi dengan tools lain
- Affiliate link tracking
- AI fine-tuning untuk niche-specific content
- Template marketplace (user jual/beli prompt templates)

---

## 10. References

### Source
- **Sample file**: `/home/mifdlal/Downloads/dashboard_affiliate_ai.tsx` (1463 lines)
- **Module count verified**: 18 modules
- **Mock data structure**: 2 saved products, 4 sample projects

### External
- **Next.js 16**: https://nextjs.org/docs
- **Supabase**: https://supabase.com/docs
- **shadcn/ui**: https://ui.shadcn.com
- **Phosphor Icons**: https://phosphoricons.com
- **Geist Font**: https://vercel.com/font
- **Tailwind CSS v4**: https://tailwindcss.com
- **DeepSeek V4 Flash** (primary): https://api-docs.deepseek.com/news/news260424
- **OpenCode Zen**: https://opencode.ai/docs/zen/ (pricing & models: https://opencode.ai/zen)
- **HuggingFace Inference API**: https://huggingface.co/docs/api-inference
- **@react-pdf/renderer**: https://react-pdf.org
- **docx**: https://docx.js.org

### Skills Used During Brainstorming
- `brainstorming` (current skill)
- `webfetch` + `websearch_web_search_exa` (OpenCode Zen + DeepSeek V4 Flash verification, Next.js latest, icon library comparison, font comparison)

---

## Approval

**Status**: ✅ Approved by user on 2026-06-14

**Next Step**: Invoke `writing-plans` skill untuk create implementation plan dengan atomic tasks.
