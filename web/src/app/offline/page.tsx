export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-xl font-semibold">You’re offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Pages you opened recently still work. Captures and running timers are saved and will sync when you’re back.
      </p>
    </main>
  )
}
