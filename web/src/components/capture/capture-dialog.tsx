'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { toast } from 'sonner'
import { Mic, Square } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { captureTask } from '@/app/actions/tasks'
import { normalizeSpoken, parseCapture } from '@/domain/capture/parse-capture'
import { enqueueCapture } from '@/lib/client/offline-queue'
import { speechRecognitionCtor, type SR } from '@/lib/client/speech'

const noSubscribe = () => () => {}
const localToday = () => new Intl.DateTimeFormat('en-CA').format(new Date())
const fmtMinute = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const fmtDay = (key: string) => new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${key}T00:00:00Z`))

export function CaptureDialog({
  open, onOpenChange, parked = false,
}: { open: boolean; onOpenChange: (o: boolean) => void; parked?: boolean }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [listening, setListening] = useState(false)
  const canSpeak = useSyncExternalStore(noSubscribe, () => !!speechRecognitionCtor(), () => false)
  const rec = useRef<SR | null>(null)
  const saving = useRef(false)
  const today = localToday()
  const preview = parseCapture(text, today)

  useEffect(() => {
    if (!open) rec.current?.abort()
  }, [open])

  // Voice capture: browser dictation, then the same fixed rules as typing ("tomorrow at 3 pm for 15 minutes").
  function toggleVoice() {
    if (listening) return rec.current?.stop()
    const Ctor = speechRecognitionCtor()
    if (!Ctor) return
    const r = new Ctor()
    r.lang = navigator.language || 'en-US'
    r.interimResults = true
    r.continuous = false
    const before = text ? `${text} ` : ''
    r.onresult = (e) => {
      let said = ''
      for (let i = 0; i < e.results.length; i++) said += e.results[i]![0].transcript
      setText(before + (e.results[e.results.length - 1]?.isFinal ? normalizeSpoken(said) : said))
    }
    r.onerror = (e) => { if (e.error !== 'no-speech' && e.error !== 'aborted') toast('Voice capture isn’t available right now.') }
    r.onend = () => setListening(false)
    rec.current = r
    try { r.start(); setListening(true) } catch { setListening(false) }
  }

  function submit(keepOpen: boolean) {
    const value = text.trim()
    if (!value || saving.current) return
    const finish = () => {
      setText('')
      setError(null)
      if (!keepOpen) onOpenChange(false)
    }
    if (!navigator.onLine) {
      enqueueCapture(value, parked)
      toast('Saved offline — it will sync when you’re back online.')
      finish()
      return
    }
    // Only the save itself blocks a second submit; the list refresh runs in the background,
    // so rapid captures (and Shift+Enter "save & next") never wait on it.
    saving.current = true
    void captureTask(value, parked)
      .then((r) => {
        if (!r.ok) return setError(r.error)
        toast.success(parked ? 'Parked in Inbox. Back to it.' : preview.showOn && preview.showOn > today ? `Captured — shows up ${fmtDay(preview.showOn)}.` : 'Captured to Inbox.')
        finish()
        startTransition(() => router.refresh())
      })
      .catch(() => {
        enqueueCapture(value, parked)
        toast('Connection dropped — saved offline, will sync.')
        finish()
      })
      .finally(() => { saving.current = false })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="top-[18%] translate-y-0 gap-3 p-3 sm:max-w-lg">
        <DialogTitle className="sr-only">{parked ? 'Park a thought' : 'Quick capture'}</DialogTitle>
        <DialogDescription className="sr-only">Type or speak, then press Enter to save.</DialogDescription>
        <div className="flex items-center gap-1">
          <input
            autoFocus
            aria-label="Capture"
            className="h-11 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-base outline-none placeholder:text-muted-foreground"
            placeholder={parked ? 'Park the thought, then back to work…' : 'Call Sam tomorrow 3pm #Work ~15m'}
            value={text}
            aria-busy={pending}
            onChange={(e) => {
              setText(e.target.value)
              setError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit(e.shiftKey)
              }
            }}
          />
          {canSpeak && (
            <button type="button" onClick={toggleVoice} aria-label={listening ? 'Stop voice capture' : 'Capture by voice'} aria-pressed={listening}
              className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${listening ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              {listening ? <Square className="size-3.5" /> : <Mic className="size-4" />}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t px-1 pt-2 text-xs text-muted-foreground">
          {listening && <span className="animate-pulse text-foreground">Listening… say “tomorrow at 3 pm for 15 minutes, project work”</span>}
          {preview.showOn && <Chip>{preview.showOn === today ? 'today' : fmtDay(preview.showOn)}</Chip>}
          {preview.atMinute !== null && <Chip>{fmtMinute(preview.atMinute)}</Chip>}
          {preview.projectName && <Chip>#{preview.projectName}</Chip>}
          {preview.estimateMinutes && <Chip>{preview.estimateMinutes}m</Chip>}
          {preview.energy && <Chip>{preview.energy}</Chip>}
          {preview.kind === 'speak' && <Chip>speak</Chip>}
          <span className="ml-auto hidden sm:inline">Enter save · Shift+Enter save & next · Esc close</span>
        </div>
        {error && <p role="alert" className="px-1 text-sm text-warning-foreground">{error}</p>}
      </DialogContent>
    </Dialog>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-accent px-1.5 py-0.5 text-accent-foreground">{children}</span>
}
