import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";
import { auth } from "@/auth";
import {
  supabaseAdmin,
  SUPABASE_STORAGE_BUCKET,
  isSupabaseStorageEnabled,
} from "@/lib/supabase";

/**
 * File upload endpoint.
 *
 * Storage backend:
 *  - Production / Vercel: Supabase Storage (Vercel's filesystem is read-only).
 *    Activated when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set.
 *  - Dev fallback: local `./public/uploads/` (legacy path, retained so existing
 *    dev workflows that already use it keep working without env changes).
 *
 * Security hardening:
 *  - Auth-only (any logged-in user can upload)
 *  - SVG removed from ALLOWED — SVG can carry <script> / event-handlers → stored XSS
 *  - MIME type checked against magic bytes (via `file-type`), NOT just `file.type`
 *    (client-supplied Content-Type is trivially spoofed)
 *  - Image dimensions capped — prevents decompression-bomb DoS where a 1MB
 *    PNG decodes to 50,000×50,000 pixels and OOMs the server when rendered
 *  - Random UUID filename — prevents directory traversal and overwrite attacks
 *  - Size hard-capped via MAX_UPLOAD_MB
 *  - Output extension derived from detected MIME, not user-supplied filename
 */

const MAX_MB = parseInt(process.env.MAX_UPLOAD_MB ?? "10", 10);

// Cap decoded image dimensions. 8000px is more than enough for an A4 page at
// 600 DPI and well below the 256 MP limit where sharp would start to thrash.
const MAX_IMAGE_DIM = 8000;

// Only raster formats. SVG is intentionally excluded (XSS vector).
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

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

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 });
  }

  // Size check first — cheapest gate, prevents loading huge buffers into memory
  if (file.size > MAX_MB * 1024 * 1024) {
    return NextResponse.json({ error: "too_large" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty_file" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // Magic-bytes check — never trust client-supplied Content-Type
  const detected = await fileTypeFromBuffer(buf);
  if (!detected || !ALLOWED_MIME.has(detected.mime)) {
    return NextResponse.json({ error: "type_not_allowed" }, { status: 400 });
  }

  // Dimension check (decompression-bomb defence). sharp's metadata read is
  // streaming/header-only, so it doesn't actually decode the pixels — cheap.
  try {
    const meta = await sharp(buf, { failOn: "none" }).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w === 0 || h === 0) {
      return NextResponse.json({ error: "invalid_image" }, { status: 400 });
    }
    if (w > MAX_IMAGE_DIM || h > MAX_IMAGE_DIM) {
      return NextResponse.json(
        { error: "dimensions_too_large", maxDim: MAX_IMAGE_DIM },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }

  const ext = EXT_BY_MIME[detected.mime];
  const filename = `${crypto.randomUUID()}.${ext}`;

  if (isSupabaseStorageEnabled() && supabaseAdmin) {
    // Production path: write to Supabase Storage. The bucket must be public-read
    // so that the returned URL renders without an extra signed-URL round-trip.
    const { error } = await supabaseAdmin.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(filename, buf, {
        contentType: detected.mime,
        cacheControl: "public, max-age=31536000, immutable",
        upsert: false,
      });
    if (error) {
      return NextResponse.json(
        { error: "storage_upload_failed", detail: error.message },
        { status: 502 },
      );
    }
    const { data } = supabaseAdmin.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .getPublicUrl(filename);
    return NextResponse.json({ url: data.publicUrl });
  }

  // Dev fallback: local filesystem. Only reached when SUPABASE_* env vars are
  // unset — never on Vercel (its FS is read-only and the write would 500).
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buf);
  return NextResponse.json({ url: `/uploads/${filename}` });
}
