'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { BookOpen, ChevronsUpDown, LogOut, Plus, Settings, Sparkles } from 'lucide-react'
import { chapterFor } from '@/components/guide/chapters'
import { CaptureDialog } from '@/components/capture/capture-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { WhatsLeft } from '@/components/guide/whats-left'
import { CommandPalette } from './command-palette'
import { TimerBar } from './timer-bar'
import { keyInfo, plainKey } from '@/lib/hotkeys'
import { flushCaptures, queuedCount } from '@/lib/client/offline-queue'
import { captureTask } from '@/app/actions/tasks'
import { logout } from '@/app/(auth)/actions'
import { clearDevice } from '@/lib/client/sign-out'
import { usePartnerFeed, type FriendLite } from '@/lib/client/partner-feed'
import { PartnerHub } from '@/components/partner/partner-hub'
import { RequestsBell } from '@/components/partner/requests-bell'
import { WorkModeCard } from '@/components/partner/partner-widget'
import type { OpenSessionView, WhatsLeftData } from './types'

/**
 * Four sections (UI v0.6): Today · Plan · Progress · Friends. Each section shows its pages as soft pill tabs;
 * every page keeps its own URL and G-shortcut. Settings live in the account menu.
 */
type Page = { href: string; label: string; also?: string[] }
const SECTIONS: { href: string; label: string; emoji: string; tint: string; pages: Page[] }[] = [
  { href: '/', label: 'Today', emoji: '☀️', tint: 'bg-accent', pages: [] },
  { href: '/calendar', label: 'Plan', emoji: '🗓️', tint: 'bg-sky-soft', pages: [
    { href: '/calendar', label: 'Calendar' }, { href: '/goals', label: 'Goals' },
    { href: '/inbox', label: 'Lists', also: ['/projects', '/someday', '/aging'] }, { href: '/commitments', label: 'My promises' },
  ] },
  { href: '/skills', label: 'Progress', emoji: '🌱', tint: 'bg-sun-soft', pages: [
    { href: '/skills', label: 'Overview' }, { href: '/review', label: 'Weekly review' }, { href: '/habits', label: 'Habits' }, { href: '/speak', label: 'Speak' },
  ] },
  { href: '/partner', label: 'Friends', emoji: '👥', tint: 'bg-lilac-soft', pages: [] },
]
const LISTS: Page[] = [{ href: '/inbox', label: '💡 Ideas' }, { href: '/projects', label: '📁 Projects' }, { href: '/someday', label: '🌙 Maybe later' }, { href: '/aging', label: '🧹 Decide' }]

/** G-chords (DESIGN §12.5) still reach every page directly. */
const CHORDS: Record<string, string> = {
  h: '/', i: '/inbox', p: '/projects', c: '/calendar', o: '/goals', v: '/speak', s: '/skills', r: '/review', b: '/habits', f: '/partner',
}

const under = (path: string, href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`))
const pageActive = (path: string, p: Page) => under(path, p.href) || (p.also ?? []).some((h) => under(path, h))
function sectionOf(path: string) {
  return SECTIONS.find((s) => s.pages.some((p) => pageActive(path, p))) ?? SECTIONS.find((s) => under(path, s.href)) ?? null
}

/** Soft pill tabs for the current section's pages (never the main colour: one main action per screen). */
function SectionTabs({ path }: { path: string }) {
  const section = sectionOf(path)
  if (!section || section.pages.length < 2) return null
  const inLists = LISTS.some((l) => under(path, l.href))
  return (
    <div className="mb-5 space-y-2">
      <nav aria-label={section.label} className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-full bg-muted p-1">
        {section.pages.map((p) => {
          const active = pageActive(path, p)
          return (
            <Link key={p.href} href={p.href} aria-current={active ? 'page' : undefined}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-bold transition-all duration-150 ${active ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'}`}>
              {p.label}
            </Link>
          )
        })}
      </nav>
      {inLists && (
        <nav aria-label="Lists" className="flex flex-wrap gap-1.5">
          {LISTS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={under(path, l.href) ? 'page' : undefined}
              className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition-colors duration-150 ${under(path, l.href) ? 'border-primary bg-accent text-accent-foreground' : 'border-transparent bg-muted text-muted-foreground hover:text-foreground'}`}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}

export function AppShell({
  username, whatsLeft, openSession, userId, friends, workMode, children,
}: {
  username: string; whatsLeft: WhatsLeftData; openSession: OpenSessionView | null
  userId: string; friends: FriendLite[]; workMode: 'solo' | 'pair'; children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [capture, setCapture] = useState(false)
  const [palette, setPalette] = useState(false)
  const [left, setLeft] = useState(false)
  const chord = useRef<number>(0)
  const { feed, refresh } = usePartnerFeed({ userId, friendIds: friends.map((f) => f.id), heartbeat: true })

  // An invite link opened while signed out is remembered and finished here after sign-in.
  useEffect(() => {
    try {
      const token = localStorage.getItem('plan.join')
      if (token) { localStorage.removeItem('plan.join'); router.push(`/join/${token}`) }
    } catch { /* storage unavailable */ }
  }, [router])

  // Global shortcuts (DESIGN §12.5)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented) return
      const k = keyInfo(e)
      if ((k.ctrlKey || k.metaKey) && !k.altKey && k.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((o) => !o)
        return
      }
      if (capture || palette) return
      const key = plainKey(k)
      if (!key) return
      if (Date.now() - chord.current < 900) {
        chord.current = 0
        const target = CHORDS[key]
        if (target) {
          e.preventDefault()
          router.push(target)
        }
        return
      }
      if (key === 'g') chord.current = Date.now()
      else if (key === 'q') { e.preventDefault(); setCapture(true) }
      else if (key === 'w') { e.preventDefault(); setLeft((o) => !o) }
      else if (key === '?') { e.preventDefault(); router.push(helpHref(location.pathname)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [capture, palette, router])

  // Service worker: push notifications + offline fallback
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  // Flush offline captures when the connection returns
  useEffect(() => {
    async function flush() {
      if (!navigator.onLine || queuedCount() === 0) return
      const sent = await flushCaptures((t, parked) => captureTask(t, parked))
      if (sent) {
        toast.success(`Synced ${sent} offline capture${sent > 1 ? 's' : ''}.`)
        router.refresh()
      }
    }
    void flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [router])

  const current = sectionOf(pathname)
  const wide = pathname.startsWith('/calendar')

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r bg-sidebar px-3.5 py-5 md:flex">
        <div className="mb-4 flex items-center gap-2 px-1.5">
          <Link href="/" className="flex flex-1 items-center gap-2.5 text-xl font-extrabold tracking-tight">
            <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-sky text-base text-white">✦</span>
            Plan
          </Link>
          <RequestsBell feed={feed} friends={friends} refresh={() => void refresh()} />
        </div>
        <nav className="space-y-1">
          {SECTIONS.map((n) => {
            const active = current === n
            return (
              <Link key={n.href} href={n.href} aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 font-bold transition-all duration-150 ${active ? 'bg-sidebar-accent text-foreground shadow-soft' : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground'}`}>
                <span className={`flex size-8 items-center justify-center rounded-xl text-base ${n.tint}`}>{n.emoji}</span>
                <span className="flex-1">{n.label}</span>
              </Link>
            )
          })}
        </nav>
        <button onClick={() => setCapture(true)} className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-dashed px-3 py-2.5 text-sm font-bold text-muted-foreground hover:border-primary hover:text-foreground">
          <Plus className="size-4" /> Add a task <kbd className="ml-auto rounded-md border px-1.5 font-mono text-[10px]">Q</kbd>
        </button>
        <div className="mt-auto space-y-2 pt-4">
          <WorkModeCard friends={friends} feed={feed} workMode={workMode} />
          <AccountMenu username={username} onWhatsLeft={() => setLeft(true)} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-14 md:px-10 md:pb-10 md:pt-7">
        {openSession && <TimerBar session={openSession} />}
        <div className={`mx-auto w-full ${wide ? 'max-w-6xl' : 'max-w-3xl'}`}>
          <SectionTabs path={pathname} />
          {children}
        </div>
      </main>

      {/* Phone: Today · Plan · ＋ · Progress · Friends */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {[SECTIONS[0]!, SECTIONS[1]!].map((n) => <TabLink key={n.href} n={n} active={current === n} />)}
        <button onClick={() => setCapture(true)} aria-label="Add a task" className="flex items-center justify-center">
          <span className="-mt-5 flex size-13 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_20px_color-mix(in_oklab,var(--primary)_40%,transparent)]"><Plus className="size-6" /></span>
        </button>
        {[SECTIONS[2]!, SECTIONS[3]!].map((n) => <TabLink key={n.href} n={n} active={current === n} />)}
      </nav>

      <div className="fixed right-3 top-3 z-40 flex items-center gap-1 rounded-full border bg-card/90 p-0.5 shadow-soft backdrop-blur md:hidden">
        <RequestsBell feed={feed} friends={friends} refresh={() => void refresh()} />
        <Link href={helpHref(pathname)} aria-label="Help for this screen" className="grid size-7 place-items-center rounded-full text-sm font-black text-muted-foreground hover:text-foreground">?</Link>
        <MobileAccount onWhatsLeft={() => setLeft(true)} />
      </div>
      <PartnerHub feed={feed} friends={friends} refresh={() => void refresh()} />
      <Link href={helpHref(pathname)} aria-label="Help for this screen" title="Help for this screen (?)"
        className="fixed bottom-5 right-5 z-30 hidden size-9 place-items-center rounded-full border bg-card text-sm font-black text-muted-foreground shadow-soft hover:text-foreground md:grid">?</Link>
      <CaptureDialog open={capture} onOpenChange={setCapture} />
      <CommandPalette open={palette} onOpenChange={setPalette} onCapture={() => setCapture(true)} onWhatsLeft={() => setLeft(true)} />
      <WhatsLeft open={left} onOpenChange={setLeft} data={whatsLeft} />
    </div>
  )
}

function TabLink({ n, active }: { n: (typeof SECTIONS)[number]; active: boolean }) {
  return (
    <Link href={n.href} aria-current={active ? 'page' : undefined}
      className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold ${active ? 'text-primary' : 'text-muted-foreground'}`}>
      <span className="text-lg leading-none">{n.emoji}</span>{n.label}
    </Link>
  )
}

/** Account menu (DESIGN §12.2): settings, the day overview and log out live here, out of the main navigation. */
function AccountMenu({ username, onWhatsLeft }: { username: string; onWhatsLeft: () => void }) {
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left text-sm font-bold text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground">
        <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-lilac to-sky text-xs text-white">{username.slice(0, 1).toUpperCase()}</span>
        <span className="flex-1 truncate">@{username}</span>
        <ChevronsUpDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-52">
        <DropdownMenuItem onClick={onWhatsLeft}><Sparkles className="size-4" /> My day at a glance</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(helpHref(location.pathname))}><BookOpen className="size-4" /> How Plan works</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/settings')}><Settings className="size-4" /> Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void clearDevice().then(() => logout())}><LogOut className="size-4" /> Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MobileAccount({ onWhatsLeft }: { onWhatsLeft: () => void }) {
  const router = useRouter()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Settings className="size-4" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={onWhatsLeft}><Sparkles className="size-4" /> My day at a glance</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push(helpHref(location.pathname))}><BookOpen className="size-4" /> How Plan works</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push('/settings')}><Settings className="size-4" /> Settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void clearDevice().then(() => logout())}><LogOut className="size-4" /> Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The guide, opened at the chapter for this screen; closing it comes back here. */
function helpHref(path: string) {
  return `/guide?ch=${chapterFor(path)}&from=${encodeURIComponent(path)}`
}
