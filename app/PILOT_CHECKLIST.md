# Pilot Pre-flight Checklist

Read alongside `PILOT.md` (the runbook). This is the "did I actually
do every step?" tickbox. Do NOT start the 14-day clock until every
item below is checked.

---

## Supabase

- [ ] Project created at https://supabase.com, region noted (Singapore
      `ap-southeast-1` or Tokyo `ap-northeast-1`)
- [ ] Database password stored somewhere recoverable (1Password, etc.) —
      it cannot be retrieved later, only reset
- [ ] `uploads` Storage bucket exists and is marked **Public**
- [ ] Schema deployed (10 tables visible under Table Editor:
      `User`, `Account`, `Session`, `VerificationToken`, `OnePage`,
      `OnePageVersion`, `Template`, `Group`, `GroupMembership`,
      `AuditLog`)
- [ ] Bootstrap admin row exists in `User` table (role=`ADMIN`,
      status=`ACTIVE`)

## Secrets & environment

- [ ] `DATABASE_URL` uses the **transaction pooler** (port `6543`,
      `?pgbouncer=true&connection_limit=1`)
- [ ] `DIRECT_URL` uses the **session pooler** (port `5432`)
- [ ] Both URLs URL-encode special chars in the password (`@` → `%40`,
      `#` → `%23`, etc.)
- [ ] `SUPABASE_URL` is `https://<project-ref>.supabase.co` (the REST
      base URL, NOT `db.<ref>.supabase.co`)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is the `service_role` key (NOT the
      `anon` key — uploads write via service_role and bypass RLS)
- [ ] `SUPABASE_STORAGE_BUCKET=uploads` matches the bucket name above
- [ ] `AUTH_SECRET` is a fresh 32+ char random value (NOT the placeholder)
- [ ] `NEXTAUTH_URL` is the public HTTPS URL of the pilot environment
- [ ] `ADMIN_PASSWORD` has been rotated from the seed value
- [ ] `AUTH_LINE_ID` and `AUTH_LINE_SECRET` are populated AND match a
      LINE Login channel whose **email permission is APPROVED** (not
      "applied")
- [ ] `LINE_CHANNEL_ACCESS_TOKEN` and `LINE_CHANNEL_SECRET` are
      populated AND match a Messaging API channel in the **SAME LINE
      Provider** as the Login channel above
- [ ] `LINE_OA_ADD_URL` resolves to a real "Add friend" page when
      opened on a phone
- [ ] `CRON_SECRET` is a fresh 32+ char random value
- [ ] None of the values above are committed to the repo
      (`git grep AUTH_LINE_ID` should match `.env.example` only)

## LINE console

- [ ] LINE Login channel callback URL is set to
      `https://<your-domain>/api/auth/callback/line`
- [ ] Messaging API channel webhook URL is set to
      `https://<your-domain>/api/line/webhook`
- [ ] LINE console "Verify webhook" check passes (200)
- [ ] Messaging API "Default reply / Auto-reply" are both OFF
- [ ] The OA has an icon + name that pilot users will recognise as
      official

## Deploy

- [ ] Commit `0a347ab` (M5) or later is deployed to production
- [ ] Production build succeeded with the LINE env vars in place
      (check Vercel deployment log)
- [ ] `https://<your-domain>/login` loads
- [ ] "เข้าสู่ระบบด้วย LINE" button is visible (otherwise the LINE
      env vars are not reaching the server component)
- [ ] `vercel.json` cron schedule is registered (Vercel dashboard →
      Cron Jobs shows `/api/cron/notify-deadlines` every hour)

## Smoke test

- [ ] Logged in as ADMIN once
- [ ] Ran `pnpm tsx scripts/pilot-sanity.ts --base ... --cookie ...`
      and it exited 0
- [ ] Visited `/audit?event=onepage` and saw at least the 6 events
      the sanity script generated
- [ ] Visited `/admin/metrics` and saw `Publish ต่อวัน` card show ≥1
- [ ] Deleted the throwaway sanity onepage from `/onepages`
- [ ] Added the OA on your personal phone, then triggered a publish
      from another user account → received a LINE push within 30s
      (only required if LINE notifications are part of the pilot scope)

## People

- [ ] Pilot unit ("กองตัวอย่าง") name, size, and primary contact are
      recorded in `baseline/template.json` → `pilotUnit`
- [ ] Every pilot user has been provisioned via `/users` and emailed
      their initial password
- [ ] At least one admin from the pilot unit can log in and reach
      `/admin/metrics`
- [ ] PRD owner (the human who'll sign off the baseline on day 15) is
      named, agreed, and aware of the day-15 review meeting
- [ ] A communication channel (LINE group / Slack) exists for pilot
      users to report problems

## Baseline ready

- [ ] `baseline/template.json` exists
- [ ] Day-15 calendar event is on the PRD owner's calendar
- [ ] `BASELINE.md` "Baseline snapshots" table has a fresh row with
      `windowFrom` set (sign-off and metric values filled in on day 15)
- [ ] A `git tag v1.0.0-pilot` has been pushed marking the T-zero
      commit

## Stop the clock conditions (agreed in advance)

- [ ] Team agreed: any "auth.login.failure" rate >25% pauses the
      pilot
- [ ] Team agreed: any `line.notify.failure` rate >10% pauses LINE
      notifications (NOT the whole pilot)
- [ ] Team agreed: any `onepage.export.failure` rate >5% pauses
      export-related changes
- [ ] Team agreed: a P1 incident triggers a 24h pause + investigation,
      not a silent rollback

---

When every box above is checked, **then** start the 14-day window by
following `PILOT.md` section 5.

Until then, the pilot has not started — the dashboard might be
collecting data but the baseline window is not yet frozen.
