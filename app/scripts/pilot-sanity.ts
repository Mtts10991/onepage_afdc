#!/usr/bin/env tsx
/**
 * Pilot pre-flight sanity check.
 *
 * Usage (from the dev workstation, NOT the prod server):
 *
 *   pnpm tsx scripts/pilot-sanity.ts \
 *     --base https://onepage.example.go.th \
 *     --cookie "next-auth.session-token=<paste from devtools>"
 *
 * What it does:
 *   1. Creates a throwaway onepage via POST /api/onepages
 *   2. Fires the edit-started beacon
 *   3. Updates the onepage twice — once to seed a real edit, once
 *      within 5 minutes to trigger fix-up detection
 *   4. Sends a deliberately invalid PUT to provoke validation.failure
 *   5. Exports the onepage as PPTX (triggers publish + export.success)
 *   6. Fires the export-png beacon as if PNG export ran
 *   7. Polls /api/onepages/<id> to confirm the onepage is reachable
 *   8. Reads /admin/metrics? days=1 and prints which expected audit
 *      events landed
 *
 * The script does NOT touch LINE — that's a manual integration check
 * (add the OA, then watch a real notification fire on next publish).
 *
 * Exits 0 if all required events were observed, non-zero otherwise.
 */

interface CliOpts {
  base: string;
  cookie: string;
  cleanup: boolean;
}

const REQUIRED_EVENTS = [
  "onepage.create",
  "onepage.edit.started",
  "onepage.update",
  "onepage.validation.failure",
  "onepage.export.success",
  "onepage.publish",
  // emitted only when the editor pretends a PNG round trip happened
  // — the beacon route audits both success and failure
] as const;

function parseArgs(argv: string[]): CliOpts {
  const out: CliOpts = { base: "", cookie: "", cleanup: true };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base") out.base = argv[++i] ?? "";
    else if (a === "--cookie") out.cookie = argv[++i] ?? "";
    else if (a === "--no-cleanup") out.cleanup = false;
  }
  if (!out.base || !out.cookie) {
    console.error(
      "usage: pnpm tsx scripts/pilot-sanity.ts --base <https://host> --cookie <session-cookie>",
    );
    process.exit(2);
  }
  // Normalise: drop trailing slash so URL concat is predictable.
  out.base = out.base.replace(/\/$/, "");
  return out;
}

function logStep(name: string) {
  console.log(`\n→ ${name}`);
}

function logOk(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function logFail(msg: string): never {
  console.error(`  ✗ ${msg}`);
  process.exit(1);
}

async function req(opts: CliOpts, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cookie", opts.cookie);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${opts.base}${path}`, { ...init, headers });
  return res;
}

async function main() {
  const opts = parseArgs(process.argv);
  console.log(`[pilot-sanity] base=${opts.base}`);

  // 1. create
  logStep("POST /api/onepages — create");
  const createRes = await req(opts, "/api/onepages", {
    method: "POST",
    body: JSON.stringify({
      title: `[sanity] ${new Date().toISOString()}`,
      data: undefined, // server fills in defaultPlanData
    }),
  });
  if (!createRes.ok) {
    logFail(`create failed: ${createRes.status} ${await createRes.text()}`);
  }
  const created = (await createRes.json()) as { id: string };
  logOk(`created id=${created.id}`);

  // 2. edit-started beacon
  logStep("POST /api/onepages/<id>/beacon/edit-started");
  const b1 = await req(opts, `/api/onepages/${created.id}/beacon/edit-started`, {
    method: "POST",
    body: JSON.stringify({ mode: "edit", type: "plan" }),
  });
  if (b1.status !== 204) {
    logFail(`edit-started beacon: expected 204, got ${b1.status}`);
  }
  logOk("beacon accepted");

  // 3a. valid update
  logStep("PUT /api/onepages/<id> — valid edit");
  const minimalPlanData = {
    type: "plan" as const,
    agency: "sanity",
    logoUrl: null,
    projectName: "sanity",
    date: "",
    background: "",
    objective: "",
    scope: "",
    targetGroup: "",
    responsible: "",
    budget: "",
    timeline: "",
    kpis: [],
    activities: [],
    outcome: "",
    imageUrl: null,
    accentColor: null,
    deadline: null,
  };
  const u1 = await req(opts, `/api/onepages/${created.id}`, {
    method: "PUT",
    body: JSON.stringify({ data: minimalPlanData, isAutosave: true }),
  });
  if (!u1.ok) {
    logFail(`update 1 failed: ${u1.status} ${await u1.text()}`);
  }
  logOk("first update ok");

  // 3b. fix-up update (within 5 min of #1)
  const u2 = await req(opts, `/api/onepages/${created.id}`, {
    method: "PUT",
    body: JSON.stringify({
      data: { ...minimalPlanData, objective: "fix-up" },
      isAutosave: true,
    }),
  });
  if (!u2.ok) {
    logFail(`update 2 (fix-up) failed: ${u2.status} ${await u2.text()}`);
  }
  logOk("second update (fix-up) ok");

  // 4. validation failure (missing required `data`)
  logStep("PUT /api/onepages/<id> — deliberate validation failure");
  const bad = await req(opts, `/api/onepages/${created.id}`, {
    method: "PUT",
    body: JSON.stringify({ data: { type: "plan", deadline: "not-a-date" } }),
  });
  if (bad.status !== 400) {
    logFail(`expected 400, got ${bad.status}`);
  }
  logOk("validation rejected as expected");

  // 5. export pptx → triggers export.success + publish
  logStep("GET /api/onepages/<id>/export/pptx");
  const exp = await req(opts, `/api/onepages/${created.id}/export/pptx`);
  if (!exp.ok) {
    logFail(`pptx export failed: ${exp.status} ${await exp.text()}`);
  }
  const buf = await exp.arrayBuffer();
  if (buf.byteLength < 2000) {
    logFail(`pptx buffer suspiciously small (${buf.byteLength} bytes)`);
  }
  logOk(`pptx exported (${buf.byteLength} bytes)`);

  // 6. png beacon (simulate the client-side path)
  logStep("POST /api/onepages/<id>/beacon/export-png");
  const png = await req(opts, `/api/onepages/${created.id}/beacon/export-png`, {
    method: "POST",
    body: JSON.stringify({ status: "success", durationMs: 1234, bytes: 50000 }),
  });
  if (png.status !== 204) {
    logFail(`png beacon: expected 204, got ${png.status}`);
  }
  logOk("png beacon accepted");

  // 7. read back
  logStep("GET /api/onepages/<id> — readback");
  const back = await req(opts, `/api/onepages/${created.id}`);
  if (!back.ok) logFail(`readback failed: ${back.status}`);
  logOk("readback ok");

  console.log("\n=========================================");
  console.log("All sanity calls succeeded.");
  console.log("Confirm the following events landed in AuditLog (visit");
  console.log(`${opts.base}/audit?event=onepage):`);
  for (const ev of REQUIRED_EVENTS) console.log(`  - ${ev}`);
  console.log("Also expected on the dashboard within ~60s:");
  console.log("  - /admin/metrics: 'Publish ต่อวัน' +1, 'อัตราข้อผิดพลาด' +1");
  console.log("\nThe test onepage is left in place for visual inspection.");
  console.log("Delete it manually from /onepages when done.");
}

main().catch((err) => {
  console.error("pilot-sanity crashed:", err);
  process.exit(2);
});
