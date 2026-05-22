/**
 * Route-level loading UI for every page under (app)/.
 *
 * Next.js renders this as the Suspense fallback while a server component
 * page awaits its data. It lives inside AppLayout, so the sidebar + header
 * stay put and only the content area swaps to this skeleton — the user
 * sees an immediate response instead of a blank, seemingly-frozen screen
 * during the (Tokyo round-trip) data fetch.
 */
export default function AppLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">กำลังโหลด…</span>

      {/* page heading + action button */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-md bg-muted animate-pulse" />
          <div className="h-4 w-72 rounded-md bg-muted/70 animate-pulse" />
        </div>
        <div className="h-9 w-32 rounded-md bg-muted animate-pulse" />
      </div>

      {/* stat / filter row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-24 rounded-lg border bg-card p-4"
          >
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="mt-4 h-8 w-16 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>

      {/* main content block (table / card list) */}
      <div className="rounded-lg border bg-card p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-12 rounded-md bg-muted/60 animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
