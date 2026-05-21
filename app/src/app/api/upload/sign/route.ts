import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/auth";
import {
  supabaseAdmin,
  SUPABASE_STORAGE_BUCKET,
  isSupabaseStorageEnabled,
} from "@/lib/supabase";

/**
 * Issue a short-lived signed upload URL so the browser can write the file
 * STRAIGHT to Supabase Storage, bypassing the Vercel serverless function.
 *
 * Why this exists: a Vercel function has a hard 4.5 MB request-body limit
 * (`413 FUNCTION_PAYLOAD_TOO_LARGE`) that no config can raise. Routing the
 * file bytes through `/api/upload` therefore caps uploads at ~4 MB. The
 * signed-URL flow keeps only this tiny JSON request on the function; the
 * file bytes go directly browser → Supabase, which has its own (much
 * higher) per-bucket limit.
 *
 * This endpoint validates what it can cheaply before issuing the token:
 *  - caller is authenticated
 *  - declared contentType is in the raster allow-list (no SVG → XSS)
 *  - declared size is within MAX_UPLOAD_MB
 * The object path is a random UUID we choose server-side, so the client
 * cannot pick a path to overwrite someone else's file.
 *
 * Note: the declared size/type are client-supplied hints. The real
 * defence is that ImageCropDialog re-encodes every image through a canvas
 * to PNG before upload, so the bytes are always a well-formed raster of
 * bounded dimensions. A malicious client could still upload arbitrary
 * bytes to its own UUID path; that is acceptable for the pilot (the file
 * is only ever referenced by the URL we hand back, and the bucket is
 * write-scoped per signed token).
 */

const MAX_MB = parseInt(process.env.MAX_UPLOAD_MB ?? "10", 10);

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  if (!isSupabaseStorageEnabled() || !supabaseAdmin) {
    // Direct upload requires Supabase Storage. Without it (local dev with
    // no SUPABASE_* env) the caller should fall back to POST /api/upload.
    return NextResponse.json({ error: "storage_disabled" }, { status: 503 });
  }

  let body: { contentType?: unknown; size?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const contentType = String(body.contentType ?? "");
  if (!ALLOWED_MIME.has(contentType)) {
    return NextResponse.json({ error: "type_not_allowed" }, { status: 400 });
  }

  const size = Number(body.size ?? 0);
  if (!Number.isFinite(size) || size <= 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }
  if (size > MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: "too_large", maxMb: MAX_MB },
      { status: 400 },
    );
  }

  const filename = `${crypto.randomUUID()}.${EXT_BY_MIME[contentType]}`;

  const { data, error } = await supabaseAdmin.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .createSignedUploadUrl(filename);
  if (error || !data) {
    return NextResponse.json(
      { error: "sign_failed", detail: error?.message },
      { status: 502 },
    );
  }

  const { data: pub } = supabaseAdmin.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(filename);

  // `signedUrl` is the full URL the browser PUTs the bytes to; `path` and
  // `token` are returned too in case the client prefers the supabase-js
  // `uploadToSignedUrl(path, token, file)` helper.
  return NextResponse.json({
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
    publicUrl: pub.publicUrl,
  });
}
