'use client'

import { useEffect, useRef } from 'react'

/**
 * Keyboard for step-by-step flows: Enter goes forward, Esc goes back, number keys pick option N.
 * Enter also works from a single-line field and on focused option buttons; it is left alone in textareas
 * (new lines) and on other focused buttons/links (they handle their own Enter). Number keys never fire while typing.
 */
export function useStepKeys({ onNext, onBack, onPick, enabled = true, enterInFields = true }: {
  onNext?: () => void; onBack?: () => void; onPick?: (index: number) => void; enabled?: boolean
  /** false: Enter in a text field stays with the field (screens whose fields have their own Save). */
  enterInFields?: boolean
}) {
  const ref = useRef({ onNext, onBack, onPick, enterInFields })
  useEffect(() => { ref.current = { onNext, onBack, onPick, enterInFields } })
  useEffect(() => {
    if (!enabled) return
    function onKey(e: KeyboardEvent) {
      if (e.defaultPrevented || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return
      const t = e.target instanceof HTMLElement ? e.target : null
      const tag = t?.tagName
      const typing = !!t && (t.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
      const { onNext, onBack, onPick } = ref.current
      if (e.key === 'Enter' && !e.shiftKey) {
        // Option buttons (choices) don't swallow Enter — Space selects, Enter moves on.
        const option = !!t?.closest('[role="radio"], [role="checkbox"], [aria-pressed]')
        if (tag === 'TEXTAREA' || tag === 'A' || tag === 'SELECT' || (tag === 'BUTTON' && !option)) return
        if (typing && !ref.current.enterInFields) return
        if (t?.closest('[data-no-step-keys]')) return
        if (onNext) { e.preventDefault(); onNext() }
      } else if (e.key === 'Escape' && onBack) {
        if (typing && (t as HTMLInputElement).value) return
        e.preventDefault(); onBack()
      } else if (!typing && onPick && /^[1-9]$/.test(e.key)) {
        e.preventDefault(); onPick(Number(e.key) - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}
