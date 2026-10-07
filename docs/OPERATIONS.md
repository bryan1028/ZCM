# Running ZCM: limits, backups, runbook

## Where everything lives
| Piece | Where | Notes |
|---|---|---|
| App | Netlify site `kijani-ridge` (free) | Deploy: `npx netlify-cli deploy --prod` (see README) |
| Database, auth, files | Supabase project `zist`, schema `zcm` | Shared with the parked Zist app. Move to its own project once there are paying users (`pg_dump --schema=zcm`) |
| Sign-in emails | Resend → Supabase SMTP, sender `noreply@zist.it.com` | Domain DNS lives in **Cloudflare** (not Netlify DNS) |
| Daily keep-alive | Netlify scheduled function `keepalive` | Pings zist + Zood so free projects never pause |

## Limits to watch (free tiers)
- **Resend: 100 emails/day, 3,000/month.** Every sign-in code is one email. Roughly 60+ sign-ins a day means upgrading (paid plans start around $20/month). Supabase is set to allow 100 auth emails/hour; Resend's daily cap is the real ceiling.
- **Supabase:** 500 MB database, 1 GB file storage, 50 MB per upload (videos are capped at 20 MB), project pauses after ~7 idle days (keep-alive handles it).
- **Netlify:** 100 GB bandwidth and 300 build minutes a month. Photos are compressed in the browser before upload to keep this low.

## Backups: there are none on the free plan
The Supabase free plan has **no automatic backups and no point-in-time recovery** (the API reports `backups: []`, `pitr_enabled: false`).
Until you upgrade (Pro includes daily backups):
1. Weekly, take a logical export: `pg_dump "$SUPABASE_DB_URL" --schema=zcm --no-owner --format=custom -f zcm-$(date +%F).dump`
   (connection string: Supabase → Project Settings → Database). Keep the file somewhere private and off the laptop it was made on.
2. Photos/videos are not in a database dump; they live in the `zcm-*` Storage buckets.
3. **Treat upgrading to Pro as a launch requirement once real residents depend on it.**

## Changing the database
1. Add a new numbered file in `supabase/migrations/` (never edit one that has been applied).
2. Run `scripts/test-db.sh` (needs a local Postgres; CI also runs it). Add assertions to `supabase/tests/` for new rules.
3. Apply to Supabase (SQL editor, or the Management API), then deploy the app change that uses it.
`supabase/teardown.sql` removes ZCM from a shared project. Rollback for the hardening migration: `grant execute on all functions in schema zcm to public, anon, authenticated;`.

## When something breaks
- **Residents say sign-in emails don't arrive:** Resend dashboard → Logs (bounced? daily cap hit?), then Supabase → Authentication → Logs. The domain's DKIM/SPF must stay verified.
- **Site down / blank:** Netlify → Deploys. Roll back by re-publishing the previous deploy.
- **"Project paused" email from Supabase:** restore it from the dashboard within 90 days; then check the `keepalive` function logs (Netlify → Logs → Functions).
- **Someone can't see listings:** they're probably not verified yet, or are suspended: Admin page → Residents.

## Secrets
Anything secret (Supabase access token, Resend key, Netlify token) lives only in the environment/dashboards, never in the repo. Rotate the Resend key by creating a new one and pasting it into Supabase → Authentication → SMTP.

## Known, accepted
- `npm audit` reports postcss advisories pulled in by Next 15. They concern attacker-controlled CSS at build time; the app only builds its own CSS. Revisit when moving to Next 16.
- Supabase's advisor lists `zcm` helper functions used by RLS as "callable by signed-in users"; that is required for RLS to work and they only expose what the caller could already see.

## Needs a human decision / review
- **Terms and Privacy pages are plain-language drafts.** Have a lawyer familiar with Kenya's Data Protection Act review them before launch, and set `NEXT_PUBLIC_SUPPORT_EMAIL` for a contact address.
- Business accounts are self-declared today (anyone can pick "Business"). Decide whether admins should approve them.
- Reviews are open to any resident; decide whether to require a completed order.
