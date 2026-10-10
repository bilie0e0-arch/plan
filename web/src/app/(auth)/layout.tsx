/** Welcome screens (UI v0.6): a warm hello and three simple steps beside the form; one card on phones. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl bg-card shadow-soft md:grid-cols-2">
        <section className="hidden flex-col justify-between bg-gradient-to-br from-accent via-sky-soft to-lilac-soft p-10 md:flex">
          <div className="flex items-center gap-2.5 text-xl font-extrabold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-sky text-white">✦</span>
            Plan
          </div>
          <div className="space-y-5">
            <h2 className="text-3xl font-extrabold leading-tight">Get better at doing what matters — one focused step at a time.</h2>
            <ul className="space-y-3 font-bold">
              <li className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-card text-xl shadow-soft">＋</span>Add what you want to do</li>
              <li className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-card text-xl shadow-soft">▶</span>Press play and focus</li>
              <li className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-2xl bg-card text-xl shadow-soft">🌱</span>Watch yourself grow</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground">Private by default. You decide what a partner can see.</p>
        </section>
        <section className="space-y-6 p-7 sm:p-10">
          <div className="space-y-1 text-center md:text-left">
            <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-sky text-lg text-white md:hidden">✦</div>
            <h1 className="text-2xl font-extrabold tracking-tight">Welcome to Plan 👋</h1>
            <p className="text-sm text-muted-foreground">Focus, plan and grow — at your own pace.</p>
          </div>
          {children}
        </section>
      </div>
    </main>
  )
}
