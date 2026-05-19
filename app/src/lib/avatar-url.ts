/**
 * Decide whether a stored `avatarUrl` should be rendered directly or
 * routed through `/api/avatar-proxy`. URLs from external image hosts
 * that block hotlinking (LINE, currently) get proxied; local
 * `/uploads/...` paths and `data:` URLs render as-is.
 *
 * Keeps the call sites tidy: components just do `<img src={proxyAvatar(u)} />`
 * without caring why some URLs are special.
 */

const PROXIED_HOSTS = new Set<string>([
  "profile.line-scdn.net",
  "obs.line-scdn.net",
  "sprofile.line-scdn.net",
]);

export function proxyAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  // Local upload or data URL — pass through.
  if (url.startsWith("/") || url.startsWith("data:")) return url;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return url;
    if (PROXIED_HOSTS.has(u.hostname)) {
      return `/api/avatar-proxy?u=${encodeURIComponent(url)}`;
    }
    return url;
  } catch {
    return null;
  }
}
