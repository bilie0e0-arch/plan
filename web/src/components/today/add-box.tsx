'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useSyncExternalStore, useTransition } from 'react'
import { toast } from 'sonner'
import { Mic, Plus, Square } from 'lucide-react'
import { addToToday, moveTask } from '@/app/actions/tasks'
import { normalizeSpoken } from '@/domain/capture/parse-capture'
import { speechRecognitionCtor, type SR } from '@/lib/client/speech'

const noSubscribe = () => () => {}

/** "What do you want to do today?" — typed or spoken, straight onto Today. Ideas you saved earlier appear as one-tap chips. */
export function AddBox({ ideas, examples, showExamples, pulse }: { ideas: { id: string; title: string }[]; examples: string[]; showExamples: boolean; pulse: boolean }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [pending, start] = useTransition()
  const [listening, setListening] = useState(false)
  const canSpeak = useSyncExternalStore(noSubscribe, () => !!speechRecognitionCtor(), () => false)
  const rec = useRef<SR | null>(null)
  const saving = useRef(false)
  const input = useRef<HTMLInputElement>(null)

  const add = (value: string) => {
    const v = value.trim()
    if (!v || saving.current) return input.current?.focus()
    saving.current = true
    start(async () => {
      const r = await addToToday(v)
      saving.current = false
      if (!r.ok) return void toast(r.error)
      setText('')
      toast.success(r.where === 'ideas' ? 'Today is full — saved to Ideas 💡' : r.where === 'later' ? 'Saved — it shows up on that day 📅' : 'Added ✨ Press ▶ when you’re ready')
      router.refresh()
      input.current?.focus()
    })
  }
  const voice = () => {
    if (listening) return rec.current?.stop()
    const Ctor = speechRecognitionCtor()
    if (!Ctor) return
    const r = new Ctor()
    r.lang = navigator.language || 'en-US'
    r.interimResults = true
    r.continuous = false
    r.onresult = (e) => {
      let said = ''
      for (let i = 0; i < e.results.length; i++) said += e.results[i]![0].transcript
      setText(e.results[e.results.length - 1]?.isFinal ? normalizeSpoken(said) : said)
    }
    r.onerror = () => setListening(false)
    r.onend = () => setListening(false)
    rec.current = r
    try { r.start(); setListening(true) } catch { setListening(false) }
  }
  const chips = [...ideas.slice(0, 4).map((i) => ({ key: i.id, label: `💡 ${i.title}`, idea: i })), ...(showExamples ? examples.slice(0, Math.max(0, 4 - ideas.length)).map((e) => ({ key: e, label: e, idea: null })) : [])]

  return (
    <div className="space-y-2.5">
      <form onSubmit={(e) => { e.preventDefault(); add(text) }}
        className={`flex items-center gap-2 rounded-2xl border-2 border-transparent bg-card py-1.5 pl-4 pr-1.5 shadow-soft transition-colors focus-within:border-primary ${pulse ? 'animate-pulse-ring' : ''}`}>
        <Plus className="size-5 shrink-0 text-muted-foreground" />
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} aria-label="What do you want to do?"
          placeholder={listening ? 'Listening… e.g. “read 20 pages for 30 minutes”' : 'What do you want to do?'}
          className="h-10 w-0 min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-muted-foreground" />
        {canSpeak && (
          <button type="button" onClick={voice} aria-label={listening ? 'Stop listening' : 'Say it'} aria-pressed={listening}
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${listening ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
            {listening ? <Square className="size-3.5" /> : <Mic className="size-4" />}
          </button>
        )}
        <button type="submit" disabled={pending} className="h-10 shrink-0 rounded-xl bg-primary px-4 font-bold text-primary-foreground">Add</button>
      </form>
      {chips.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          {chips.map((c) => (
            <button key={c.key} disabled={pending}
              onClick={() => c.idea ? start(async () => { const r = await moveTask({ id: c.idea!.id, to: 'today' }); if (!r.ok) toast(r.error); else toast.success('Moved to Today ☀️'); router.refresh() }) : add(c.label)}
              className="max-w-56 shrink-0 truncate rounded-full bg-muted px-3.5 py-2 text-sm font-bold text-foreground/80 transition-colors hover:bg-accent">
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
