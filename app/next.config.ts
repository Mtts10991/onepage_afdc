import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "node:path";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Security response headers (OWASP A05 — Security Misconfiguration).
 *
 * CSP is intentionally permissive for `'unsafe-inline'` styles + scripts
 * because Tailwind/Tiptap inline styles and Next.js inline RSC bootstrap
 * scripts need them. Tightening to nonce-based CSP requires Next middleware
 * changes — out of scope for this pass, but recommended later.
 *
 * `img-src` includes `data:` for the data-URL avatars / cropped images we
 * produce client-side, and `blob:` for html-to-image PNG export previews.
 */

// Origin of the Supabase project (scheme + host, no path). Derived from
// SUPABASE_URL so the CSP `connect-src` can allow the browser to PUT files
// straight to Supabase Storage via a signed URL. Empty when SUPABASE_URL
// is unset (local dev with no Supabase configured).
const SUPABASE_ORIGIN = (() => {
  const raw = process.env.SUPABASE_URL;
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
})();

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Disable browser features we don't use. Trims the attack surface for
  // injected scripts (e.g. clickjacking + sensor abuse).
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // Only enforce HSTS in production builds — localhost dev uses http.
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      // Supabase project origin is allowed so uploaded images served from
      // the public `uploads` bucket render. LINE CDN avatars are NOT listed
      // here on purpose — they go through /api/avatar-proxy (same-origin).
      `img-src 'self' data: blob:${SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN}` : ""}`,
      "font-src 'self' data:",
      // The browser PUTs files straight to Supabase Storage via a signed
      // URL (see /api/upload/sign), so the Supabase project origin must be
      // an allowed `connect-src` target. Derived from SUPABASE_URL so no
      // hostname is hard-coded; falls back to 'self' only when unset.
      `connect-src 'self'${SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN}` : ""}`,
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  poweredByHeader: false,
  sassOptions: {
    // ให้ทุก .scss/.module.scss resolve `@use "variables"` ได้
    includePaths: [path.join(process.cwd(), "src/styles")],
    silenceDeprecations: ["legacy-js-api"],
  },
  images: {
    remotePatterns: [{ protocol: "http", hostname: "localhost" }],
  },
  experimental: {
    // Server-action body limit — server actions in this app only post JSON
    // form data (text/numbers), no binaries. Keep tight to reduce DoS surface.
    // /api/upload (route handler, not a server action) handles uploads
    // separately and is bounded by `proxyClientMaxBodySize` + MAX_UPLOAD_MB.
    serverActions: {
      bodySizeLimit: "1mb",
    },
    // Next.js 16: proxy buffers request body — default 10MB, ต้องเพิ่มสำหรับ /api/upload
    // (renamed from middlewareClientMaxBodySize in Next.js 15)
    proxyClientMaxBodySize: "50mb",
  },
  turbopack: {
    root: __dirname,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
