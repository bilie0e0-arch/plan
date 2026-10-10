/** Shown instantly on every click while the next screen loads, so taps never feel ignored. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4 pt-2">
      <div className="h-8 w-56 animate-pulse rounded-xl bg-muted" />
      <div className="h-14 animate-pulse rounded-2xl bg-muted/70" />
      <div className="h-16 animate-pulse rounded-2xl bg-muted/60" />
      <div className="h-16 animate-pulse rounded-2xl bg-muted/50" />
      <div className="h-16 animate-pulse rounded-2xl bg-muted/40" />
    </div>
  )
}
