# Supabase Setup

This document covers setting up Supabase for AffiliateAI Studio — both for
local development (when you have Docker) and for the hosted production
project.

> **TL;DR for the developer (you)**
> 1. The schema is fully prepared as 8 migration files under
>    `supabase/migrations/`. They have been validated against an in-process
>    PostgreSQL (`pglite`) — see "Schema Validation" below.
> 2. When you create a real Supabase project, run the steps under
>    [Production Setup](#production-setup).

---

## Schema Validation

Migrations are validated by `tests/unit/db/migrations.test.ts` (run with
`pnpm test`) and `pnpm db:validate`. Both use **pglite** — a WASM build of
PostgreSQL that runs in-process — so no Docker is required.

The validator:

- Applies all 8 migration files in order
- Verifies the 7 expected tables exist with RLS enabled
- Tests the `handle_new_user` trigger by inserting into `auth.users`
- Tests `increment_user_usage()` allows the first call and denies after 50
- Confirms `updated_at` triggers bump the column on UPDATE

```bash
pnpm test                       # includes the migration spec
pnpm db:validate                # standalone validator (same checks)
pnpm db:generate-types          # regenerate lib/supabase/types.ts
```

If you have a real Supabase project, you can also use the standard CLI:

```bash
pnpm dlx supabase gen types typescript --local > lib/supabase/types.ts
pnpm dlx supabase gen types typescript --project-id=<id> > lib/supabase/types.ts
```

---

## Local Development (Optional)

Skip this section if you don't have Docker. The in-process pglite validator
already covers syntax and DDL correctness, so a local Supabase instance is
not required for development.

If you have Docker and want the full PostgREST + Auth + Studio stack:

```bash
pnpm dlx supabase start
```

This starts local Supabase at:

| Service    | URL                                      |
| ---------- | ---------------------------------------- |
| API        | `http://localhost:54321`                 |
| Studio     | `http://localhost:54323`                 |
| Database   | `postgresql://postgres:postgres@localhost:54322/postgres` |
| Inbucket   | `http://localhost:54324`                 |

Update `.env.local` with the values printed in the terminal.

To stop:

```bash
pnpm dlx supabase stop
```

To reset the database (re-apply all migrations from scratch):

```bash
pnpm dlx supabase db reset
```

---

## Production Setup

### 1. Create a Supabase project

1. Go to <https://supabase.com/dashboard>
2. Click **New project**
3. Name: `affiliate-ai-studio`
4. Database password: **save this in a password manager** — you cannot
   recover it later and you'll need it for direct DB access
5. Region: pick one close to your primary users (Singapore for Indonesia)
6. Plan: Free (until you need more)
7. Wait ~2 minutes for provisioning

### 2. Grab your API credentials

In the Supabase dashboard, go to **Project Settings → API**:

| Setting             | Env var                          |
| ------------------- | -------------------------------- |
| Project URL         | `NEXT_PUBLIC_SUPABASE_URL`       |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY`  |
| `service_role` key  | `SUPABASE_SERVICE_ROLE_KEY`      |

Copy these into your local `.env.local` (never commit) and into the Vercel
project settings (for production).

### 3. Link the local CLI to the remote project

The `<project-ref>` is the segment in your Supabase URL:
`https://<project-ref>.supabase.co`.

```bash
pnpm dlx supabase login                      # opens browser for auth
pnpm dlx supabase link --project-ref=<project-ref>
```

### 4. Apply all migrations

```bash
pnpm dlx supabase db push
```

This applies every file under `supabase/migrations/` in order. You should
see all 8 files run successfully.

### 5. Regenerate TypeScript types

```bash
pnpm dlx supabase gen types typescript \
  --project-id=<project-ref> \
  > lib/supabase/types.ts
```

This replaces the locally-generated types with the ones from the real
project. Commit the change.

### 6. Set up the Storage bucket

The migration files don't touch `storage.objects` — that's managed
separately in the Supabase Studio:

1. Open **Storage** in the Supabase dashboard
2. Click **New bucket**
3. Name: `product-images`
4. **Public bucket**: ❌ (keep it private)
5. File size limit: `5 MB`
6. Allowed MIME types: `image/png, image/jpeg, image/webp`
7. Click **Create bucket**

Then run the following SQL in **SQL Editor → New query** to add per-user
folder policies:

```sql
-- Users can upload to their own folder: product-images/<user_id>/...
CREATE POLICY "Users can upload to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can read their own files
CREATE POLICY "Users can read their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can update/delete their own files
CREATE POLICY "Users can update their own files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
```

### 7. Configure Auth providers (Task 6)

In **Authentication → Providers**:

- **Email**: enable (for magic link)
- **Google**: enable, set OAuth client ID/secret from
  <https://console.cloud.google.com/apis/credentials>

### 8. Verify

```bash
pnpm test
pnpm build
```

Then sign up locally with a test email, check that:

- A row appears in `public.user_profiles` (auto-created by the trigger)
- A new auth user in the dashboard shows the linked profile

---

## Schema Overview

| Table                  | Purpose                                          | RLS |
| ---------------------- | ------------------------------------------------ | --- |
| `user_profiles`        | 1:1 with `auth.users`, app-level profile         | ✅  |
| `products`             | User's product catalog                           | ✅  |
| `projects`             | Campaign / review / unboxing containers          | ✅  |
| `assets`               | Unified library: images, text, docs, videos      | ✅  |
| `generations`          | Append-only AI history (audit log)               | ✅  |
| `product_analyses`     | Output of Product Auto-Analyze                   | ✅  |
| `competitor_analyses`  | Output of Competitor Analysis                    | ✅  |

Function: `public.increment_user_usage(p_user_id UUID)` — atomic
check-and-increment of the monthly AI generation limit (50/month by
default; returns `{ allowed, remaining }`).

Trigger: `on_auth_user_created` — auto-creates a `public.user_profiles`
row whenever a new row is inserted into `auth.users`.

See `docs/superpowers/specs/2026-06-14-affiliate-ai-studio-design.md`
section 2 for the full data model.

---

## Troubleshooting

**"role 'authenticated' does not exist"** when applying migrations
manually. This is normal — those roles are created by Supabase's platform
layer, not by migrations. Apply via `supabase db push` (which uses the
platform connection) instead of running SQL directly as a non-Supabase
user.

**`pglite` validation passes but production push fails** — pglite mocks
the Supabase `auth` schema and the platform roles. If production fails,
the most likely cause is a SQL syntax we accept but Supabase doesn't
(unlikely with the standard Postgres subset used here).

**`handle_new_user` trigger didn't fire** — check that
`SECURITY DEFINER` is preserved in the function definition. The trigger
function must run as the owner of `user_profiles` (typically `postgres`)
to bypass RLS on insert.

**Increment function returns `allowed=false, remaining=0` for a new
user** — the user_profiles row is missing. Confirm the
`on_auth_user_created` trigger fired; if not, manually create the
profile row.

---

## Auth Provider Configuration

The app ships with two sign-in paths wired up in
`lib/actions/auth.ts` + `app/(auth)/login/page.tsx`:

1. **Email Magic Link** (default, requires no external setup beyond
   Supabase's default Email provider).
2. **Google OAuth** (requires a Google Cloud project + redirect URI
   wiring).

### Email (Magic Link)

1. In Supabase Studio → **Authentication** → **Providers**
2. **Email** is enabled by default — no further config needed for dev.
3. Local Supabase: magic links are captured by Inbucket instead of being
   actually emailed. Open the Inbucket URL printed by
   `pnpm dlx supabase status` to view them.
4. Hosted Supabase: emails are delivered via Supabase's built-in SMTP
   unless you configure a custom SMTP provider.

### Google OAuth

#### 1. Create OAuth credentials in Google Cloud

1. Go to <https://console.cloud.google.com>.
2. Create a new project (or reuse an existing one).
3. **APIs & Services** → **Library** → search **Google+ API** → **Enable**.
   (Supabase requires the legacy Google+ API on; the more modern
   *Google Identity Services* is also accepted, but enabling Google+ API
   is the simplest path documented here.)
4. **APIs & Services** → **Credentials** → **Create Credentials** →
   **OAuth client ID**:
   - **Application type**: Web application
   - **Name**: `AffiliateAI Studio`
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (dev)
     - `https://<your-production-domain>` (when deployed)
   - **Authorized redirect URIs**:
     - `http://localhost:54321/auth/v1/callback` (local Supabase)
     - `https://<project-ref>.supabase.co/auth/v1/callback` (hosted)
5. Copy the **Client ID** and **Client Secret** from the dialog.

#### 2. Enable the Google provider in Supabase

1. Supabase Studio → **Authentication** → **Providers** → **Google**.
2. Toggle **Enabled** on.
3. Paste the **Client ID** and **Client Secret** from step 1.
4. Click **Save**.

#### 3. Configure Site URL + Redirect URLs

In Supabase Studio → **Authentication** → **URL Configuration**:

| Setting       | Local dev                       | Production (when deployed)             |
| ------------- | ------------------------------- | --------------------------------------- |
| Site URL      | `http://localhost:3000`         | `https://<your-production-domain>`      |
| Redirect URLs | `http://localhost:3000/api/auth/callback` | `https://<your-domain>/api/auth/callback` |

Add **both** URLs (dev + production) to the Redirect URLs list so the
same Supabase project supports both environments.

### Testing the Flow

#### Local development

```bash
pnpm dlx supabase start          # start local stack
pnpm dev                          # start Next.js on :3000
```

- **Magic Link**: visit `http://localhost:3000/login`, enter an email,
  then open the Inbucket URL printed by `supabase status` to read the
  email and click the link.
- **Google OAuth**: requires real Google OAuth credentials (the redirect
  URI for local dev is `http://localhost:54321/auth/v1/callback`). Use a
  real Google account.

#### Hosted (production)

After deploying, the production Site URL + Redirect URL is used. Magic
Links are delivered as real emails. Google OAuth uses the same Google
Cloud credentials as dev — only the redirect URI list needs the
production host added.
