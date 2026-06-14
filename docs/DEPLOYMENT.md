# Deployment Guide

This guide walks through deploying **AffiliateAI Studio** to production on
Vercel, with Supabase as the database and authentication backend.

Plan 1 (Foundation & Product Studio) is feature-complete and verified. This
document is what you (the developer) follow to push it live.

> **Time estimate**: 30-45 minutes (excluding DNS propagation if you use a
> custom domain).
>
> **Cost during low-traffic production**: ~$1-2/month (domain excluded).

---

## Prerequisites

You will need accounts on the following services. All have generous free
tiers suitable for a launch.

| Service | URL | Free Tier |
|---|---|---|
| GitHub | https://github.com | Unlimited public/private repos |
| Vercel | https://vercel.com | 100GB bandwidth/mo, Hobby plan |
| Supabase | https://supabase.com | 500MB DB, 1GB storage |
| OpenCode Zen | https://opencode.ai/zen | $50 credit/month |
| HuggingFace | https://huggingface.co | Free inference API |
| Domain registrar (optional) | Namecheap / Cloudflare / Porkbun | ~$10-15/year |

> **Optional** services: Kimchi.dev as a backup AI provider, Google Analytics
> for usage tracking.

---

## Step 1: Create the GitHub Repository

1. Go to https://github.com/new
2. Repository name: `affiliate-ai-studio` (or your preference)
3. Visibility: **Private** is recommended during early development
4. Do **not** initialize with README, .gitignore, or license (your local
   repo already has these)
5. Click **Create repository**

Push the local code:

```bash
cd /home/mifdlal/Documents/proyek-portfolio-2026/dashboard-affiliate-ai
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

> If you have been working on a feature branch, merge to `main` first:
> ```bash
> git checkout main
> git merge feat/plan-1-foundation
> git push -u origin main
> ```

Verify the push is clean:

```bash
git log --oneline | head -5
```

You should see the full Plan 1 commit history (~16 commits).

---

## Step 2: Create the Supabase Project

1. Go to https://supabase.com/dashboard
2. Click **New project**
3. **Name**: `affiliate-ai-studio`
4. **Database password**: generate a strong one and **save it in a password
   manager** (1Password, Bitwarden, etc.). Supabase does not email this back
   to you.
5. **Region**: choose the closest region to your primary users.
   `Singapore (ap-southeast-1)` is recommended for Indonesia.
6. **Plan**: Free
7. Click **Create new project** and wait ~2 minutes for provisioning.

### 2a. Grab API credentials

In the Supabase dashboard, go to **Project Settings -> API**:

| Setting | Env var | Where to put it |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | Vercel env (Step 4) |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel env |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` | Vercel env (server-only) |

The `service_role` key bypasses Row Level Security — it must **never** be
exposed to the browser. Vercel environment variables are server-side only by
default, which is exactly what we want.

### 2b. Apply the database migrations

The eight migration files under `supabase/migrations/` define the entire
schema (7 tables, RLS policies, triggers, `increment_user_usage` function).

```bash
# Install the Supabase CLI if you have not already
pnpm dlx supabase --version   # verifies it runs via pnpm dlx

# Authenticate (opens browser)
pnpm dlx supabase login

# Link the local repo to the remote project
# The <project-ref> is the subdomain in https://<project-ref>.supabase.co
pnpm dlx supabase link --project-ref=<project-ref>

# Apply all migrations in order
pnpm dlx supabase db push
```

You should see all 8 migration files applied successfully. If any fail, see
[Troubleshooting](#troubleshooting).

### 2c. Regenerate the TypeScript types

The local `lib/supabase/types.ts` was generated against pglite for testing.
For production, regenerate from the real project so the types match
exactly:

```bash
pnpm dlx supabase gen types typescript --project-id=<project-ref> > lib/supabase/types.ts
```

Commit the regenerated file:

```bash
git add lib/supabase/types.ts
git commit -m "chore(supabase): regenerate types from production schema"
git push
```

### 2d. Configure authentication providers

In **Authentication -> Providers**:

**Email (Magic Link)** — should be enabled by default. Verify the toggle is
on. Customize the email template under **Email Templates -> Magic link** if
desired.

**Google OAuth** — enable and configure:

1. In Google Cloud Console (https://console.cloud.google.com/apis/credentials):
   - Create an OAuth 2.0 Client (type: Web application)
   - Add Authorized JavaScript origin: `https://<project-ref>.supabase.co`
   - Add Authorized redirect URI:
     `https://<project-ref>.supabase.co/auth/v1/callback`
   - Copy the **Client ID** and **Client Secret**
2. Back in Supabase, paste the credentials into the Google provider config
3. Click **Save**

For the full step-by-step, see `docs/SUPABASE_SETUP.md`.

### 2e. Configure the Site URL and Redirect URLs

In **Authentication -> URL Configuration**, do **not** save these yet — you
do not know the production URL until Vercel deploys (Step 4). Come back
to this after the first deploy.

### 2f. Create the Storage bucket

The product-image uploader will eventually write to a Supabase Storage
bucket. In **Storage**:

1. Click **Create a new bucket**
2. Name: `product-images`
3. **Public bucket**: OFF (keep it private)
4. Click **Create bucket**

Then add the RLS policies from `docs/SUPABASE_SETUP.md` section "Storage
policies" so authenticated users can upload and read their own images.

---

## Step 3: Get AI provider API keys

### OpenCode Zen (primary AI text provider)

1. Go to https://opencode.ai/zen
2. Sign in with GitHub
3. Open the dashboard and create an API key
4. Copy the key — this becomes `OPENCODE_API_KEY`

The free tier gives $50/month of credit, which is more than enough for
hobby usage. The default model is `deepseek-v4-flash-free`.

### HuggingFace (image-to-text for Product Auto-Analyze)

1. Go to https://huggingface.co/settings/tokens
2. Click **Create new token**
3. Type: **Read** (sufficient for inference)
4. Copy the token — this becomes `HUGGINGFACE_API_KEY`

### Kimchi.dev (optional backup AI provider)

If you want automatic failover when OpenCode Zen is unavailable:

1. Go to https://app.kimchi.dev
2. Sign up and create an API key
3. Save as `KIMCHI_API_KEY` in Vercel

The AI client in `lib/ai/` already implements retry with fallback to
Kimchi.dev if you provide the key.

---

## Step 4: Deploy to Vercel

### Option A: Vercel Dashboard (recommended for first deploy)

1. Go to https://vercel.com/new
2. Click **Import** next to your GitHub repository
3. Configure the project:

   | Setting | Value |
   |---|---|
   | Framework Preset | Next.js (auto-detected) |
   | Root Directory | `./` |
   | Build Command | `pnpm build` |
   | Output Directory | `.next` |
   | Install Command | `pnpm install --frozen-lockfile` |

4. Click **Environment Variables** and add each of the following:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from Step 2a |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Step 2a |
   | `SUPABASE_SERVICE_ROLE_KEY` | from Step 2a |
   | `OPENCODE_API_KEY` | from Step 3 |
   | `HUGGINGFACE_API_KEY` | from Step 3 |
   | `KIMCHI_API_KEY` | (optional) from Step 3 |
   | `NEXT_PUBLIC_GA_MEASUREMENT_ID` | (optional, for GA4) |

   Tip: paste keys one at a time. Vercel masks values as you type.

5. Click **Deploy**
6. Wait 3-5 minutes for the first build. Watch the build logs for errors.
7. When done, Vercel shows your production URL:
   `https://<project-name>.vercel.app`

> **Build cache invalidation**: if you change a Vercel environment variable
> after a deploy, trigger a redeploy (Deployments -> three-dot menu ->
> Redeploy) for the new value to take effect.

### Option B: Vercel CLI

```bash
# Install globally
pnpm i -g vercel

# Login
vercel login

# Deploy (interactive first time)
cd /home/mifdlal/Documents/proyek-portfolio-2026/dashboard-affiliate-ai
vercel

# Follow the prompts:
#   Set up and deploy? Y
#   Which scope? <your-account>
#   Link to existing project? N
#   Project name? affiliate-ai-studio
#   In which directory is your code located? ./
#   Override settings? N

# Add environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add OPENCODE_API_KEY production
vercel env add HUGGINGFACE_API_KEY production

# Deploy to production
vercel --prod
```

---

## Step 5: Update Supabase URL Configuration

Now that you have the production URL, go back to Supabase:

1. **Authentication -> URL Configuration**
2. **Site URL**: `https://<your-app>.vercel.app`
3. **Redirect URLs**: add these (one per line):
   - `https://<your-app>.vercel.app/api/auth/callback`
   - `https://<your-app>.vercel.app/login`
   - `https://<your-app>.vercel.app/produk`
4. Click **Save**

> If you set up a custom domain in Step 6, add those URLs here too.

---

## Step 6: Custom Domain (Optional)

A custom domain (e.g. `app.affiliateai.id`) costs ~$10-15/year and makes
OAuth flows more polished. Skip this for the first deploy; you can add it
later.

1. Buy a domain from Namecheap, Cloudflare Registrar, or Porkbun
2. In Vercel: **Project Settings -> Domains -> Add**
3. Enter your domain (e.g. `app.affiliateai.id`)
4. Vercel will show the DNS records you need to add at your registrar:

   For an apex domain (`affiliateai.id`):
   - A record: `@` -> `76.76.21.21`

   For a subdomain (`app.affiliateai.id`):
   - CNAME: `app` -> `cname.vercel-dns.com`

5. Add the records at your registrar
6. Wait 5-10 minutes for DNS propagation. Vercel will auto-issue a Let's
   Encrypt SSL certificate.
7. Update Supabase (Step 5) with the new domain

---

## Step 7: Verify Production

### 7a. Smoke test (manual)

Walk through the critical user flow in a real browser:

1. Visit the production URL
2. You should be redirected to `/login` (because the dashboard is gated)
3. Click **Mulai dengan Google** -> sign in with a real Google account
4. You should be redirected back to the dashboard (or onboarding if first
   login)
5. Complete the onboarding (either load 3 sample products or skip)
6. Click **Tambah Produk** or go to `/produk`
7. Upload a product image (drag-and-drop or click to browse)
8. (Optional) Add a reference URL like a Shopee product page
9. Click **Jalankan Auto-Analisis** -> wait ~5-10 seconds
10. The form fields should be filled in by the AI
11. Click **Simpan** -> the product should appear in the list
12. Sign out (top-right user menu) -> confirm redirect to `/login`
13. Sign back in -> confirm the saved product is still there

If any step fails, check the Vercel function logs (Project -> Logs) and
the Supabase logs (Project -> Logs).

### 7b. Lighthouse audit (target scores)

Install Lighthouse CLI and run an audit:

```bash
pnpm dlx lighthouse https://<your-app>.vercel.app --view
```

Target scores:

| Category | Mobile | Desktop |
|---|---|---|
| Performance | >= 85 | >= 95 |
| Accessibility | >= 95 | >= 95 |
| Best Practices | >= 95 | >= 95 |
| SEO | >= 95 | >= 95 |

If scores are below target, see the **Troubleshooting** section in
`docs/RUNBOOK.md` for common performance pitfalls.

---

## Step 8: Set Up Monitoring

### 8a. Vercel

- Dashboard: https://vercel.com/dashboard
- **Logs**: real-time function logs and build logs
- **Analytics**: Web Vitals and traffic (free on Hobby plan)
- **Speed Insights**: enable in Project Settings for Core Web Vitals

### 8b. Supabase

- Dashboard: https://app.supabase.com
- **Database**: monitor size, connections, slow queries
- **Auth**: monitor sign-ups, failed logins
- **Storage**: monitor bucket size
- **Logs**: query and API logs with filtering

### 8c. OpenCode Zen

- Dashboard: https://opencode.ai/zen
- Monitor: token usage, remaining $50/month credit, request rate

### 8d. Alerts (recommended)

Set up email alerts for:

- Vercel: deployment failures (Settings -> Notifications)
- Supabase: database size > 80% of free tier (custom script or third-party
  monitoring)
- OpenCode Zen: credit remaining < $10 (check dashboard weekly)

---

## Cost Estimation

| Service | Free Tier Limit | Estimated Production Cost |
|---|---|---|
| Vercel Hobby | 100GB bandwidth/mo | $0 (or $20/mo Pro for commercial) |
| Supabase Free | 500MB DB, 1GB storage | $0 (or $25/mo Pro for higher limits) |
| OpenCode Zen | $50 credit/mo | $0 during dev, ~$0.02-0.10/user/mo at scale |
| HuggingFace | Free inference API | $0 |
| Domain | n/a | ~$10-15/year |
| **Total (low traffic)** | | **~$1-2/month** |

### When to upgrade

| Trigger | Upgrade |
|---|---|
| > 100GB bandwidth/month | Vercel Pro ($20/mo) |
| > 500MB database or need backups > 7 days | Supabase Pro ($25/mo) |
| OpenCode Zen credit exhausted | Pay-as-you-go (~$0.14 per 1M tokens) |
| Want to remove "Hobby" badge from Vercel | Vercel Pro ($20/mo) |

---

## Troubleshooting

### "Build failed: Cannot find module '@supabase/ssr'"

Vercel did not install dev dependencies. Check that **Install Command** in
Step 4 is `pnpm install --frozen-lockfile` (not just `pnpm install`).

### "Auth callback fails with 'Invalid redirect URL'"

The Supabase Redirect URL list does not include your production URL. See
Step 5.

### "AI generation returns 401 Unauthorized"

`OPENCODE_API_KEY` is missing or invalid in Vercel environment variables.
Check **Project Settings -> Environment Variables** and redeploy.

### "RLS error: new row violates row-level security policy"

The authenticated user's `auth.uid()` does not match the row's `user_id`
column. Most often caused by a stale session. Have the user sign out and
back in.

### "HuggingFace inference times out"

The free inference API has rate limits. Consider:

- Adding a fallback in `lib/image-analysis/` to use the OpenCode Zen
  vision model instead
- Caching the BLIP-2 result for 24 hours in Supabase

### "Vercel build succeeds but `/login` returns 500"

Check **Logs** in the Vercel dashboard. Most common cause: missing
`NEXT_PUBLIC_SUPABASE_URL` env var. The public var must be set with no
trailing slash.

### "middleware.ts deprecation warning in build log"

Known Next.js 16 change — `middleware.ts` should be renamed to `proxy.ts`.
This is a deprecation warning, not an error. The migration is tracked for
Plan 3.

### "Image uploads don't appear in /produk list"

The Storage bucket was not created or its RLS policies are missing. See
Step 2f and `docs/SUPABASE_SETUP.md`.

---

## Post-Deployment Checklist

Before announcing the launch:

- [ ] All environment variables are set in Vercel (production scope)
- [ ] Supabase Redirect URLs include the production URL
- [ ] Custom domain is configured (if applicable)
- [ ] SSL certificate is active (Vercel auto-provisions)
- [ ] Manual smoke test passes end-to-end
- [ ] Lighthouse scores meet targets
- [ ] Vercel Analytics enabled
- [ ] Error monitoring enabled (consider Sentry free tier)
- [ ] `.env.local` is **not** committed (verify `git status` is clean)
- [ ] Supabase automatic backups enabled (Pro plan) or weekly manual
      export (Free plan)

---

## Next Steps

After successful deployment:

1. Announce the launch to your target users
2. Monitor the dashboards daily for the first week
3. Collect user feedback
4. Plan 2 (AI Generators Suite) is next — see
   `docs/POST_PLAN_1_NEXT_STEPS.md`

For ongoing operations, see `docs/RUNBOOK.md`.
