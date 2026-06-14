# RUNBOOK.md — Operations Runbook

> Untuk operator/dev. Prosedur deployment, monitoring, troubleshooting, dan incident response.

## 📋 Table of Contents

1. [Daily Operations](#daily-operations)
2. [Deployment](#deployment)
3. [Monitoring](#monitoring)
4. [Troubleshooting](#troubleshooting)
5. [Incident Response](#incident-response)
6. [Maintenance](#maintenance)
7. [Backup & Recovery](#backup--recovery)

---

## 🌅 Daily Operations

### Morning Checklist (5 min)
- [ ] Cek OpenCode Zen dashboard — model availability normal
- [ ] Cek Supabase dashboard — DB status, no warnings
- [ ] Cek GA4 — traffic normal (no spike/drop)
- [ ] Cek error logs — no critical errors
- [ ] Cek OpenCode Zen model status — free model still available

### Weekly Tasks (30 min)
- [ ] Review GA4 metrics (pageviews, conversions, top pages)
- [ ] Review Supabase usage (DB size, storage, bandwidth)
- [ ] Review OpenCode Zen usage (token consumption, model availability)
- [ ] Review error trends (top errors, frequency)
- [ ] Update dependencies (if no breaking changes): `pnpm update`
- [ ] Review open issues / feedback

### Monthly Tasks (2 hours)
- [ ] Security audit (manual review of recent code)
- [ ] Performance audit (Lighthouse, Core Web Vitals)
- [ ] Backup verification (test restore from backup)
- [ ] Documentation review (update README, USER_GUIDE if needed)
- [ ] Plan next features / improvements

---

## 🚀 Deployment

### Initial Setup (One-time)

#### 1. Vercel Setup
```bash
# Install Vercel CLI
pnpm i -g vercel

# Login
vercel login

# Link project
cd /path/to/affiliate-ai-studio
vercel link

# Add environment variables
vercel env add OPENCODE_API_KEY
vercel env add HUGGINGFACE_API_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
# ... etc
```

#### 2. Supabase Setup
1. Create new project di [supabase.com](https://supabase.com)
2. Copy URL + anon key + service role key
3. Add to Vercel env vars + `.env.local`
4. Run migrations:
   ```bash
   pnpm supabase db push
   ```
5. Enable RLS on all tables (auto via migrations)
6. Configure Google OAuth di Supabase Auth settings

#### 3. Google OAuth Setup
1. Create project di [Google Cloud Console](https://console.cloud.google.com)
2. Enable Google+ API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URIs:
   - `https://<your-supabase-url>/auth/v1/callback`
5. Copy Client ID + Secret to Supabase

#### 4. Google Analytics 4 Setup
1. Create GA4 property di [analytics.google.com](https://analytics.google.com)
2. Get Measurement ID (G-XXXXXXXXXX)
3. Add to Vercel env: `NEXT_PUBLIC_GA_MEASUREMENT_ID`
4. (Optional) Create GTM container, add to Vercel env: `NEXT_PUBLIC_GTM_ID`

#### 5. Domain Setup
1. Buy domain di Namecheap / Cloudflare Registrar / Porkbun
2. Add domain di Vercel project settings
3. Update DNS records (A/CNAME) as instructed by Vercel
4. Wait for SSL provisioning (auto by Vercel, 5-10 min)

### Deployment Workflow

#### Feature Development
```bash
# 1. Create feature branch
git checkout -b feature/<feature-name>

# 2. Develop
pnpm dev

# 3. Run quality checks
pnpm lint
pnpm tsc --noEmit
pnpm test
pnpm build

# 4. Commit with conventional commits
git add .
git commit -m "feat: add photo prompt generator"

# 5. Push + create PR
git push -u origin feature/<feature-name>
# Open PR on GitHub

# 6. Wait for Vercel preview deployment + CI checks
# 7. Review preview, request reviews
# 8. Merge to main
```

#### Production Deploy
```bash
# Auto-deploy on merge to main
# 1. PR approved + merged
# 2. Vercel auto-builds + deploys
# 3. Monitor deployment status
vercel ls
# 4. Check production
open https://<your-domain>
# 5. Smoke test critical flows
```

#### Rollback
```bash
# If deployment has issues, rollback via Vercel dashboard
# 1. Go to Vercel project → Deployments
# 2. Find last working deployment
# 3. Click "Promote to Production"
# Or via CLI:
vercel rollback
```

### Database Migrations

#### Create New Migration
```bash
# Using Supabase CLI
pnpm supabase migration new <migration_name>

# Edit the generated SQL file in supabase/migrations/
# Add your schema changes (forward + rollback)
```

#### Apply Migration (Dev)
```bash
pnpm supabase db reset  # Reset + run all migrations
# Or:
pnpm supabase db push   # Apply pending migrations
```

#### Apply Migration (Production)
1. Test in staging/dev first
2. Use Supabase Studio → SQL Editor
3. Copy migration SQL, run in production
4. Verify no errors
5. Monitor for 24h

⚠️ **Zero-downtime migration checklist**:
- [ ] Backward compatible (no breaking changes)
- [ ] Tested in staging with production-like data
- [ ] Rollback plan documented
- [ ] Run during low-traffic hours
- [ ] Monitor error rate for 1h after

---

## 📊 Monitoring

### Metrics to Track

#### Vercel Analytics (Built-in)
- **Request count** — Total HTTP requests
- **Error rate** — 5xx responses
- **Response time** — p50, p95, p99
- **Bandwidth** — Total data transferred

#### Google Analytics 4
- **Pageviews** — Per route
- **Active users** — Daily/monthly active users
- **Conversion events**:
  - `signup`
  - `product_created`
  - `generation_completed`
  - `export`
- **Top pages** — Most visited routes
- **Traffic sources** — Where users come from

#### Supabase
- **Database size** — Should stay < 500MB (free tier)
- **Storage size** — Should stay < 1GB
- **Active connections** — Concurrent DB connections
- **Auth events** — Signups, logins
- **Query performance** — Slow queries

#### OpenCode Zen
- **Token usage** — Daily/monthly
- **Credit remaining** — $50/month
- **API errors** — Rate limit, model errors

### Alerting (Recommended)

Set up alerts for:
- **Vercel**: Build failures, 5xx error rate > 1%
- **Supabase**: DB size > 80% of 500MB, auth errors spike
- **OpenCode Zen**: Model availability alerts (free model removed → switch to fallback)
- **GA4**: Traffic drop > 50% vs 7-day average

Use:
- Vercel built-in email alerts
- Supabase email alerts
- UptimeRobot (free, 50 monitors) untuk external monitoring
- Optional: Sentry Free (5K events/month) untuk error tracking

### Dashboard Access
- Vercel: https://vercel.com/dashboard
- Supabase: https://app.supabase.com
- OpenCode Zen: https://opencode.ai/zen (dashboard)
- GA4: https://analytics.google.com

---

## 🔧 Troubleshooting

### Common Issues

#### Issue: "User tidak bisa login dengan Magic Link"
**Symptoms**: User klik link di email, tapi redirect ke error page.
**Cause**: Token expired atau Supabase misconfigured.
**Fix**:
1. Cek Supabase Auth settings: Magic Link enabled
2. Cek redirect URL: harus match dengan Vercel domain
3. User request new magic link
4. Cek email spam folder
5. Cek Supabase logs di dashboard

#### Issue: "AI generation error: 429 Too Many Requests"
**Symptoms**: User dapat error "rate limit exceeded".
**Cause**: OpenCode Zen rate limit (dynamic, infrastructure-dependent).
**Fix**:
1. Auto-retry sudah handle 3x dengan exponential backoff
2. User tunggu 1-5 menit, coba lagi
3. Cek OpenCode Zen status (https://opencode.ai/zen)
4. Jika persistent, consider switch ke fallback (DeepSeek paid atau Kimchi.dev)

#### Issue: "Image upload gagal"
**Symptoms**: User coba upload foto, error "Upload failed".
**Cause**: File too large, wrong format, atau Supabase Storage limit.
**Fix**:
1. Validate file size: max 5MB (client-side)
2. Validate format: PNG, JPG, WEBP only
3. Cek Supabase Storage usage: < 1GB
4. Cek browser console untuk error detail

#### Issue: "Generation tidak muncul di UI"
**Symptoms**: User klik Generate, loading selesai, tapi tidak ada hasil.
**Cause**: AI response malformed JSON atau network error.
**Fix**:
1. Cek browser console untuk error
2. Cek generations table di Supabase: ada record baru?
3. Cek status: 'success' atau 'failed'?
4. Jika 'failed', cek error_message field
5. User coba lagi (retry)
6. Jika persistent, lapor ke support dengan generation ID

#### Issue: "Export PDF tidak sesuai layout"
**Symptoms**: User export ke PDF, layout berantakan.
**Cause**: Complex tables / images tidak support di @react-pdf/renderer.
**Fix**:
1. Simplify layout (no complex tables)
2. Reduce image sizes
3. Use standard fonts (Geist may not support, fallback to Helvetica)
4. Test export sebelum production

#### Issue: "Site lambat / 504 Gateway Timeout"
**Symptoms**: Loading lama, timeout errors.
**Cause**: Cold start (Vercel Hobby), Supabase DB slow, atau OpenCode Zen slow.
**Fix**:
1. Vercel Hobby: first request setelah idle = slow (cold start)
2. Cek Supabase DB performance: slow queries?
3. Cek OpenCode Zen: biasanya < 5 detik untuk task simple, 30-60 detik untuk Content Calendar (max reasoning + streaming)
4. Add loading states dengan progress bar
5. Consider upgrade Vercel Pro untuk no cold start

### Debug Mode

Enable debug logging di development:
```bash
# .env.local
DEBUG=true
LOG_LEVEL=verbose
```

View logs:
```bash
# Vercel deployment logs
vercel logs <deployment-url>

# Real-time
vercel logs --follow

# Supabase logs
# Via Supabase Studio → Logs
```

---

## 🚨 Incident Response

### Severity Levels

| Level | Impact | Response Time | Examples |
|---|---|---|---|
| **P0 Critical** | Site down, data loss | Immediate (within 1h) | 500 errors, DB corrupt, auth broken |
| **P1 High** | Major feature broken | Within 4h | AI generation broken, export broken |
| **P2 Medium** | Minor feature broken | Within 24h | Specific module bug, UI glitch |
| **P3 Low** | Cosmetic / nice-to-have | Next sprint | Typo, minor style issue |

### P0 Response Procedure

1. **Identify scope** — How many users affected? All users or specific?
2. **Check status pages**:
   - Vercel status: https://vercel-status.com
   - Supabase status: https://status.supabase.com
   - OpenCode Zen: (no public status page, check via dashboard)
3. **Rollback if needed**:
   ```bash
   vercel rollback
   # Or rollback DB migration if schema issue
   ```
4. **Communicate**:
   - Post di status page (jika punya)
   - Notify user via email (jika extended outage)
5. **Investigate root cause**:
   - Cek error logs (Vercel + Supabase + browser console)
   - Reproduce locally
   - Identify fix
6. **Deploy fix**:
   - Hotfix branch → test → merge to main → auto-deploy
7. **Post-mortem**:
   - Document what happened
   - Why it happened
   - What we did to fix
   - How to prevent in future
   - Update this runbook

### P1 Response Procedure

1. Triage — Reproduce issue, identify scope
2. Fix in feature branch
3. Test locally
4. Deploy to production (or staging first)
5. Monitor for 1h
6. Update documentation if needed

### Communication Templates

#### Status Page Update (Outage)
```
🔴 [Time] Investigating
We are currently investigating an issue affecting [feature]. Users may experience [symptom]. Our team is working on a fix.

🟡 [Time] Identified
The issue has been identified as [cause]. A fix is being implemented. ETA: [time].

🟢 [Time] Resolved
The issue has been resolved. All services are operating normally. We apologize for the inconvenience.
```

---

## 🔧 Maintenance

### Dependency Updates

#### Weekly (Low Risk)
```bash
pnpm update --latest --interactive
# Pilih patch + minor versions only
pnpm test
pnpm build
git commit -m "chore: update dependencies"
```

#### Monthly (Higher Risk)
```bash
pnpm update --latest
# Include major versions
pnpm test
pnpm build
# Test in staging
# Deploy to production if green
```

### Performance Audits

#### Lighthouse (Monthly)
```bash
# Install Lighthouse CLI
pnpm i -g lighthouse

# Run audit
lighthouse https://<your-domain> --view
```

Target:
- Performance: > 90 mobile, > 95 desktop
- Accessibility: > 95
- Best Practices: > 95
- SEO: > 95

#### Bundle Size (Weekly)
```bash
pnpm build
# Check .next/analyze/ atau:
pnpm add -D @next/bundle-analyzer
# Configure in next.config.ts
```

Target: Initial JS < 200KB gzipped

### Security Audits (Monthly)

```bash
# Dependency vulnerabilities
pnpm audit
pnpm audit --fix  # Auto-fix if possible

# Code security
# Manual review of:
# - Auth flows
# - RLS policies
# - Input validation
# - Secrets management
```

### Database Maintenance (Quarterly)

```bash
# Vacuum + analyze
pnpm supabase db vacuum

# Check for unused indexes
pnpm supabase db stats
```

---

## 💾 Backup & Recovery

### Automated Backups

**Supabase Free Tier**:
- Daily automatic backups (point-in-time recovery, 7 days retention)
- Manual backup before major changes:
  ```bash
  pnpm supabase db dump -f backup-$(date +%Y%m%d).sql
  ```

**Vercel**:
- Deployment history (rollback via dashboard)

### Disaster Recovery Scenarios

#### Scenario 1: Supabase DB Lost
1. Create new Supabase project
2. Restore from latest backup:
   ```bash
   pnpm supabase db push  # Apply migrations
   psql <backup-file>.sql  # Restore data
   ```
3. Update Vercel env vars (new Supabase URL)
4. Redeploy

#### Scenario 2: Vercel Project Lost
1. Create new Vercel project
2. Link to GitHub repo
3. Add env vars
4. Auto-deploy from main branch

#### Scenario 3: Code Lost (worst case)
1. GitHub is source of truth
2. Clone fresh from GitHub
3. pnpm install
4. Setup env vars
5. Deploy

### RTO (Recovery Time Objective)
- **DB restore**: < 2 hours
- **Full environment**: < 4 hours

### RPO (Recovery Point Objective)
- **DB data**: < 24 hours (daily backup)
- **Code**: 0 (Git is source of truth)

---

## 📞 Support Contacts

### External Services
- **Vercel Support**: support@vercel.com (Hobby = community only, Pro = email)
- **Supabase Support**: support@supabase.com (Free = community, Pro = email)
- **OpenCode Zen**: Discord (https://discord.gg/castai)

### Internal (Solo)
- **Owner**: User
- **Escalation**: N/A (solo project)
- **On-call**: N/A (solo project)

---

## 📚 References

- [Next.js 16 Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Vercel Docs](https://vercel.com/docs)
- [OpenCode Zen Docs](https://opencode.ai/docs/zen/)
- [Design Spec](superpowers/specs/2026-06-14-affiliate-ai-studio-design.md)
- [Architecture](ARCHITECTURE.md)

---

**Last updated**: 2026-06-14
**Next review**: 2026-07-14 (monthly)
