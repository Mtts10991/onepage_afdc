import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

/**
 * Proxy LINE CDN avatars (or any allowlisted external profile image
 * host) through our origin so the browser doesn't get blocked by
 * LINE's Referer check and SSR pages don't leak third-party cookies.
 *
 * Why this exists: LINE returns `profile.line-scdn.net/...` URLs that
 * refuse to load when the Referer is anything other than an
 * access.line.me page — so an `<img src=" line-scdn... ">` inside our
 * admin pages just renders blank. Fetching server-side bypasses that
 * gate, and we only allow a small allowlist so the route can't be
 * abused as an open-internet proxy.
 *
 * Auth: any logged-in session can use it. We don't try to enforce
 * "you may only view avatars of users you'd see anyway" — the URL
 * itself is already an opaque LINE CDN token, and the upstream
 * always returns the same low-resolution profile picture.
 */

// Hosts whose profile images this proxy will fetch. Add new hosts here
// (NOT via env or query param) so the allowlist stays auditable in git.
const ALLOWED_HOSTS = new Set<string>([
  "profile.line-scdn.net",
  "obs.line-scdn.net",
  // common alternative we've seen LINE return in different regions
  "sprofile.line-scdn.net",
]);

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB hard cap — profile pics are tiny

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauth" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("u");
  if (!raw) return NextResponse.json({ error: "missing_url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "bad_url" }, { status: 400 });
  }
  if (target.protocol !== "https:") {
    return NextResponse.json({ error: "https_only" }, { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return NextResponse.json({ error: "host_not_allowed" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: {
        // LINE accepts requests with no Referer; the previous failure
        // mode was the browser sending `Referer: localhost` which they
        // reject. Server-side fetch sends none by default — that's the
        // whole point of the proxy.
        "User-Agent": "OnePageAvatarProxy/1.0",
      },
      // Cache aggressively on the upstream layer; CDN avatars don't change.
      next: { revalidate: 3600 },
    });
  } catch {
    return NextResponse.json({ error: "upstream_failed" }, { status: 502 });
  }
  if (!upstream.ok) {
    return NextResponse.json(
      { error: "upstream_status", status: upstream.status },
      { status: 502 },
    );
  }

  const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "not_image" }, { status: 502 });
  }

  const buf = await upstream.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 502 });
  }

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Let the browser cache for an hour — avatars are stable enough
      // and the LINE CDN URL itself rotates if the user changes their
      // picture.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
