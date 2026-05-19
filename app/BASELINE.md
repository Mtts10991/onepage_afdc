# Baseline Measurement Process

This document describes how the **One-Page Hardening** team freezes a
baseline reading of the system before any of milestones 2–5 ship. Every
"-50%" / "-30%" / "-60%" claim in the PRD is meaningless without a frozen
baseline to compare against, so this process is mandatory.

> PRD: `.claude/prds/onepage-hardening-line-integration.prd.md`
> Implementation plan: `~/.claude/plans/synthetic-sniffing-whistle.md`

---

## 1. Operating definitions

The dashboard at `/admin/metrics` and all baseline numbers below depend on
these definitions. Lock them before measuring; do not redefine mid-pilot.

- **publish** — the FIRST successful export (PPTX or PNG) for a given
  `OnePage.id`. The system has no explicit publish/status field; the
  first export is the best proxy for "the author is done". Recorded as
  the synthetic event `onepage.publish` once per onepage.
- **form error** — count of:
  1. `*.validation.failure` events (zod rejection at any API boundary), AND
  2. `onepage.update` events where `metadata.secondsSinceLastUpdate <= 300`
     (a "fix-up" within 5 minutes of the previous edit — strong proxy for
     correcting a mistake).
- **edit session** — bounded by the first `onepage.edit.started` for an
  `(actor, target)` pair → matched `onepage.publish` on the same target.
  Time-to-complete (TTC) = delta. Mounts of the editor after the first
  are de-duped on read.
- **mobile session** — distinct `(actor, day)` where the recorded
  `userAgent` matches `/Mobi|Android|iPhone|iPad|iPod|Line\//i`. UA
  classification runs on read in `src/lib/metrics.ts` via
  `src/lib/user-agent.ts` — no per-event device column.
- **support ticket** — `support.ticket.recorded` AuditLog row, entered
  manually by an admin from `/admin/metrics`. Categories: `login`,
  `format`, `export`, `mobile`, `other`. The unit is the entered row,
  not the upstream channel ticket.

### Known limitations to disclose in the rollout review

- `publish` misses authors who save but never export. Revisit in M4 with
  an explicit "mark complete" CTA.
- For onepages **created** (not just edited), the `edit.started` beacon
  fires AFTER the first save (the route needs a `targetId` to attribute
  the event to). TTC for create-mode therefore measures post-save
  duration only — not total time-in-editor.
- LINE Login adoption and LINE Notify opt-in cards are placeholders
  until M2 / M3 land. They render zero by design; do not interpret as
  baseline data.
- UA regex is intentionally simple (no `ua-parser-js`). Expected
  false-positive band ≤ 5% based on common Thai-network UA strings;
  revisit in M5 if dashboard numbers look suspicious.

## 2. Audit event catalog

| Event | Producer | Powers |
|---|---|---|
| `auth.login.success` / `auth.login.failure` / `auth.login.rate_limited` | `src/auth.ts` — now carries `metadata.provider = "credentials" \| "line"` | LINE adoption (M2+) |
| `auth.line.linked` **(M2)** | `src/auth.ts` events.signIn on first Account row | First-time LINE adoption |
| `auth.line.unlinked` **(M2)** | `POST /api/profile/line/unlink` | Adoption churn |
| `line.notify.opted_in` / `opted_out` **(M3)** | webhook follow/unfollow + opt-out POST | Notify opt-in rate |
| `line.notify.optin_orphan` **(M3)** | webhook `follow` without prior LINE Login Account | Onboarding sequencing health |
| `line.notify.success` / `failure` / `skipped` **(M3)** | `src/lib/push-line.ts` | Notify delivery health |
| `line.notify.no_target` **(M3)** | `src/lib/notify.ts` when owner has no `lineBotUserId` | Coverage gap signal |
| `line.cron.notify_deadlines.run` **(M3)** | `/api/cron/notify-deadlines` hourly tick | Cron health |
| `line.webhook.rejected` / `skipped` **(M3)** | `/api/line/webhook` | Webhook config issues |
| `onepage.autosave.conflict` **(M4)** | `PUT /api/onepages/[id]` optimistic-concurrency mismatch | Concurrent-edit incidents |
| `onepage.update` *(extended M4)* | adds `isAutosave`, `coalescedIntoVersion` metadata | Distinguishes autosave from explicit save |
| `onepage.draft.recovered` **(M4)** | `POST /api/onepages/[id]/beacon/draft-recovered` | Times the safety net actually paid off |

**M5 note:** No new audit events. PPTX caption rendering now walks Tiptap
HTML via `src/lib/tiptap-to-pptx.ts:htmlToTextRuns()` and emits
pptxgenjs structured text runs instead of stripping formatting to plain
text — bold / italic / underline / per-run color / per-run font-size /
block alignment / lists / hyperlinks all survive into the exported
deck. PNG export pre-warms `document.fonts.ready` (capped at 1.5 s) so
captures don't race the Sarabun web font.
| `onepage.create` *(extended)* | `POST /api/onepages` | Volume |
| `onepage.update` *(extended)* | `PUT /api/onepages/[id]` | Fix-up rate |
| `onepage.delete` | `DELETE /api/onepages/[id]` | (audit context only) |
| `onepage.restore` | `POST .../versions/[vid]/restore` | (audit context only) |
| `onepage.validation.failure` **(new)** | POST + PUT zod rejection paths | Form error rate |
| `user.validation.failure` **(new)** | `POST /api/users` zod rejection | Form error rate |
| `profile.validation.failure` **(new)** | `POST /api/profile/password` zod rejection | Form error rate |
| `onepage.edit.started` **(new)** | `POST /api/onepages/[id]/beacon/edit-started` | TTC start |
| `onepage.export.success` **(new)** | PPTX server route + PNG beacon | Export volume, TTC end |
| `onepage.export.failure` **(new)** | PPTX server route + PNG beacon | Export error baseline |
| `onepage.publish` **(new, synthetic)** | First successful export per target | TTC canonical end |
| `support.ticket.recorded` **(new)** | `POST /api/support-tickets` (admin) | Support ticket count |

## 3. Freeze process

The clock starts the moment the M1 instrumentation has been live in
production for **24 consecutive hours**. The window is **14 days**.

1. **Tag the deploy** that landed the last instrumentation event. Record
   the tag and the UTC timestamp in this file at the bottom under
   `## Baseline snapshots`.
2. **Wait 14 calendar days.** Do not begin M2 implementation against the
   production DB during this period. Local feature branches are fine.
3. On day 15, an admin opens `/admin/metrics?days=14` and:
   - Screenshots every card.
   - Exports the underlying rows with the SQL below to
     `baseline/<YYYY-MM-DD>.json` in this repo. Commit it.
4. The PRD owner signs off on the snapshot in writing (PR description or
   issue comment is acceptable). Until sign-off the baseline is DRAFT.

## 4. SQL snippets (SQLite)

> All queries assume `DATABASE_URL` points at the prod SQLite file or a
> read-replica. Adapt syntax if the DB has been migrated to Postgres
> before measurement starts.

**Form error rate**

```sql
SELECT
  (SELECT COUNT(*) FROM AuditLog
     WHERE event LIKE '%.validation.failure'
       AND createdAt >= datetime('now','-14 days')) AS validation_failures,
  (SELECT COUNT(*) FROM AuditLog
     WHERE event = 'onepage.create'
       AND createdAt >= datetime('now','-14 days')) AS creates,
  (SELECT COUNT(*) FROM AuditLog
     WHERE event = 'onepage.update'
       AND createdAt >= datetime('now','-14 days')) AS updates;
```

Fix-ups need JSON parsing of `metadata.secondsSinceLastUpdate` — easier
to run via the dashboard or the `formErrorRate()` function in
`src/lib/metrics.ts` than raw SQL.

**Time-to-complete (matched pairs)**

```sql
SELECT s.targetId,
       MIN(s.createdAt) AS started,
       MIN(p.createdAt) AS published,
       (julianday(MIN(p.createdAt)) - julianday(MIN(s.createdAt))) * 86400 AS seconds
FROM AuditLog s
JOIN AuditLog p
  ON p.targetId = s.targetId
 AND p.event   = 'onepage.publish'
WHERE s.event = 'onepage.edit.started'
  AND s.createdAt >= datetime('now','-14 days')
GROUP BY s.targetId
HAVING published > started
ORDER BY seconds;
```

**Export failures**

```sql
SELECT event,
       json_extract(metadata, '$.format') AS format,
       COUNT(*) AS n
FROM AuditLog
WHERE event IN ('onepage.export.success', 'onepage.export.failure')
  AND createdAt >= datetime('now','-14 days')
GROUP BY event, format;
```

**Support tickets**

```sql
SELECT json_extract(metadata, '$.category') AS category, COUNT(*) AS n
FROM AuditLog
WHERE event = 'support.ticket.recorded'
  AND createdAt >= datetime('now','-14 days')
GROUP BY category;
```

## 5. Snapshot file format

`baseline/<YYYY-MM-DD>.json` — a single JSON object:

```jsonc
{
  "windowFrom": "2026-05-04T00:00:00Z",
  "windowTo":   "2026-05-18T00:00:00Z",
  "deployTag":  "v1.0.0-instrumentation",
  "metrics": {
    "formErrorRate":      { "rate": 0.18, "validation": 12, "fixups": 7, "denominator": 105 },
    "timeToCompleteSec":  { "p50": 540, "p90": 1820, "count": 38 },
    "supportTickets":     { "total": 22, "byCategory": { "login": 9, "format": 6 } },
    "exportFailureRate":  { "rate": 0.04, "totalSuccess": 71, "totalFailure": 3 },
    "mobileCompletionRate": { "rate": 0.62, "completed": 19, "sessions": 31 }
  },
  "signedOffBy": "<PRD owner email>",
  "signedOffAt": "2026-05-19T08:30:00Z",
  "notes": "Any caveats specific to this window (incidents, holidays, etc.)"
}
```

Cut sections that are placeholders in M1 — do not invent numbers for the
LINE adoption cards.

## 6. Baseline snapshots

| Window | Deploy tag | Snapshot | Signed off |
|---|---|---|---|
| _(to be populated after first 14-day window)_ | | | |
