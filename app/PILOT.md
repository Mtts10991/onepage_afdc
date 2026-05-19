# Pilot Runbook (Milestone 6)

This runbook walks the admin / ops owner through everything needed to
launch the 14-day pilot of the One-Page hardening release (M1–M5) with
a "กองตัวอย่าง" (sample battalion / 100–500 active users) and decide
go / no-go for the org-wide rollout.

> Read in order. Each step has a verification check at the bottom — do
> not skip them; the pilot's go/no-go decision is only as good as the
> data it's built on.

---

## 0. Prerequisites (one-time)

- [ ] You have shell + `pnpm` access to deploy the app.
- [ ] You have an account at https://vercel.com (or whichever host you
      use) with the ability to set environment variables.
- [ ] You have admin access to the LINE Developers console
      (https://developers.line.biz/console/).
- [ ] You have a "กองตัวอย่าง" / sample unit identified (name + size +
      contact person + an internal channel — LINE OA or Slack — for
      questions during pilot).
- [ ] A PRD owner has been named to sign off the frozen baseline at
      the end of week 2 (default: project lead).

---

## 1. Provision LINE channels

You need a **single LINE Developers Provider** that owns BOTH channels.
This is non-negotiable: when the channels share a provider, the LINE
Login `sub` and the Messaging API `userId` resolve to the same value
for a given user, which is what lets `src/auth.ts:resolveLineUser` /
`src/app/api/line/webhook/route.ts` work without an extra reconciliation
step.

### 1a. LINE Login channel (powers M2)

1. In the LINE console, create or select a Provider, then
   **Create channel → LINE Login**.
2. Channel name + icon: anything appropriate for your agency.
3. Region: Thailand.
4. **Email permission**: scroll to "OpenID Connect → Email address
   permission" and click **Apply**. This usually approves within ~1
   business day. Without it, no users can auto-link via email and the
   "no_email_no_link" rejection in `src/auth.ts` fires on every attempt.
5. **Callback URL**: `https://<your-domain>/api/auth/callback/line`
6. Copy the **Channel ID** → `AUTH_LINE_ID`
   and the **Channel secret** → `AUTH_LINE_SECRET`.

### 1b. Messaging API channel (powers M3)

1. In the SAME Provider, **Create channel → Messaging API**.
2. Set the OA name + icon (this is what users see when they add the bot).
3. Under **Messaging API → Webhook URL**, set:
   `https://<your-domain>/api/line/webhook`
   then click **Verify** — the LINE console should report success
   (200). The webhook handler responds 200 even when the secret is
   missing, but verify after step 2 below for an authenticated check.
4. Toggle **Use webhook = ON**.
5. Under **Messaging API → Channel access token**, **Issue** a long-lived
   token. Copy it → `LINE_CHANNEL_ACCESS_TOKEN`.
6. Under **Basic settings → Channel secret**, copy it → `LINE_CHANNEL_SECRET`.
7. Under **Messaging API → Default reply / Auto-reply**, turn both OFF —
   we don't run a chatbot, only outbound pushes.
8. Find the OA's **Add friend URL** (looks like
   `https://line.me/R/ti/p/@012abcde`) → `LINE_OA_ADD_URL`.

---

## 2. Set production environment variables

In Vercel (or your host's dashboard), set the following on the
**Production** environment:

```
DATABASE_URL=<postgres or production sqlite path>
AUTH_SECRET=<openssl rand -base64 32>
AUTH_TRUST_HOST=true
NEXTAUTH_URL=https://<your-domain>
ADMIN_EMAIL=<bootstrap admin email>
ADMIN_PASSWORD=<strong random — rotate after first seed>
UPLOAD_DIR=./public/uploads
MAX_UPLOAD_MB=10

# M2 (LINE Login)
AUTH_LINE_ID=<from step 1a>
AUTH_LINE_SECRET=<from step 1a>

# M3 (LINE Messaging API)
LINE_CHANNEL_ACCESS_TOKEN=<from step 1b>
LINE_CHANNEL_SECRET=<from step 1b>
LINE_OA_ADD_URL=<from step 1b>

# M3 (cron auth)
CRON_SECRET=<openssl rand -hex 32>
```

> **Do NOT** commit any of these to git. `app/.env.example` is the only
> file allowed to mention these names; values are environment-only.

After saving, **redeploy** so the new env is picked up.

---

## 3. Deploy & smoke test

1. Deploy current `main` (commit `0a347ab` or later).
2. Open `https://<your-domain>/login` → log in as ADMIN (email +
   password).
3. Open `https://<your-domain>/admin/metrics` — you should see 8
   cards. Six will read "—" because there's no data yet; that's
   correct.
4. Open `https://<your-domain>/audit` — should be empty or show only
   the auth.login.success event from your login.
5. Run the sanity script (from your dev workstation, NOT from the
   server):
   ```
   pnpm tsx scripts/pilot-sanity.ts \
     --base https://<your-domain> \
     --cookie "<paste session cookie from browser devtools>"
   ```
   This makes a real onepage, edits it, exports it, fires every
   beacon, and verifies each of the 9 M1–M5 audit events lands in
   AuditLog. See `scripts/pilot-sanity.ts` for what it checks.

If any check fails, **do not proceed** — fix the underlying issue and
re-run.

---

## 4. Provision pilot users

1. As ADMIN, create the pilot users via `/users` (or seed in bulk by
   editing `prisma/seed.ts` and re-running `pnpm db:seed`).
2. Email each user their initial password + a short note that:
   - They can change their password at `/profile`.
   - They can link LINE at `/profile` once they've added the OA as a
     friend using your `LINE_OA_ADD_URL`.
   - They can opt out of LINE notifications at any time from `/profile`.

---

## 5. Freeze T-zero

This is the moment the 14-day baseline window starts.

1. Tag the deploy: `git tag v1.0.0-pilot && git push --tags`.
2. Record the UTC timestamp at the bottom of `BASELINE.md` under
   **Baseline snapshots**:
   ```
   | 2026-MM-DD 00:00Z – 2026-MM-DD+14 00:00Z | v1.0.0-pilot | TBD | TBD |
   ```
3. From this moment on, **DO NOT** deploy product changes to the same
   environment until step 7 sign-off. Bugfixes only.

---

## 6. Run the pilot (14 days)

- Day 1: monitor `/audit` for the first hour. Confirm the audit stream
  is healthy (login + create + update events appear).
- Day 1–14: respond to user questions in your designated channel.
  When a question is filed as a real ticket, the admin enters it via
  `/admin/metrics` → "บันทึกตั๋ว support ด้วยตนเอง" with the right
  category.
- Day 7: mid-pilot health check — open `/admin/metrics?days=7` and
  spot-check that all 8 cards show non-zero (or a known-legitimate
  zero — e.g. zero LINE Notify if the OA wasn't published yet).

---

## 7. Freeze + sign-off (day 15)

1. Open `/admin/metrics?days=14` and screenshot every card.
2. Copy `baseline/template.json` to `baseline/<YYYY-MM-DD>.json` and
   fill in the metric values from the dashboard. Commit.
3. PRD owner reviews the snapshot and signs off via PR comment or
   issue. Until sign-off the snapshot is `signedOffBy: null`.
4. The signed snapshot becomes the comparison anchor for the
   post-rollout measurement in week 4+.

---

## 8. Decide go / no-go

The hypothesis in the PRD is:

> composite score of {error/rework reduced ≥50%, time-to-complete
> reduced, support ticket reduced} significantly better than the
> baseline

**Pilot succeeds when**, comparing baseline-week-1 (days 1–7) to
baseline-week-2 (days 8–14):

- form-error rate trending DOWN (any direction is informative, but flat
  or up means UX didn't help)
- median time-to-complete trending DOWN
- support tickets categorized as login/format/export trending DOWN
- LINE Login adoption ≥30% (lower target than the PRD's 70% — pilot is
  early)
- LINE Notify opt-in ≥20% (same reasoning)
- mobile completion rate ≥60% (PRD targets 80% for full rollout)

**No-go**: if any of error rate / time / ticket count gets WORSE, stop
and investigate before scaling.

---

## Troubleshooting

| Symptom | Likely cause | Where to look |
|---|---|---|
| "Sign in with LINE" button missing on login | `AUTH_LINE_ID`/`AUTH_LINE_SECRET` not set on prod | `src/app/login/page.tsx` flag |
| LINE login fails with `?error=line_no_email_no_link` | LINE channel email permission not approved yet | LINE console → wait + retry |
| LINE login fails with `?error=line_no_matching_user` | Pilot user not provisioned in `/users`, or email mismatch | Add user in `/users` first |
| No `line.notify.success` rows after publish | OA not added as friend; check `lineBotUserId` is null | `/admin/metrics` → LINE Notify card |
| Webhook returns 401 in LINE console | `LINE_CHANNEL_SECRET` mismatch | Re-copy from LINE console |
| Cron route 401 from Vercel logs | `CRON_SECRET` mismatch between env and cron header | Vercel cron docs |
| PPTX still loses bold/italic | Old client cache | Hard-reload, re-export |
| PNG export font looks wrong | Sarabun web font didn't load in time | Increase the 1500ms timeout in `export-buttons.tsx` (rare) |

---

## What this runbook does NOT do

- **It does not deploy for you.** Run `vercel deploy --prod` (or your
  equivalent) yourself.
- **It does not invite users for you.** Send the welcome email
  yourself.
- **It does not sign off the baseline for you.** The PRD owner is a
  human; they must read the snapshot and approve in writing.
- **It does not interpret the metrics for you.** Section 8 gives you
  the rubric; the call still belongs to the PRD owner.

These boundaries are intentional — the pilot is a business decision
the engineering team supports but does not own.
