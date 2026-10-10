'use client'

import Link from 'next/link'
import { useEffect, useTransition } from 'react'
import { X } from 'lucide-react'
import { markPromptShown, resolvePrompt } from '@/app/actions/guide'

/** A budgeted, dismissible prompt (DESIGN §10.3, §10.8). Always carries its action and a "Not now". */
export function NudgeCard({ type, message, actionLabel, href }: { type: string; message: string; actionLabel: string; href: string }) {
  const [, start] = useTransition()
  useEffect(() => {
    void markPromptShown(type)
  }, [type])
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed bg-card/60 px-4 py-3 text-sm">
      <span className="flex-1">{message}</span>
      <Link href={href} onClick={() => start(() => void resolvePrompt(type, 'acted'))} className="font-medium text-primary hover:underline">
        {actionLabel}
      </Link>
      <button aria-label="Not now" className="rounded p-1 text-muted-foreground hover:bg-muted"
        onClick={() => start(() => void resolvePrompt(type, 'dismissed'))}>
        <X className="size-4" />
      </button>
    </div>
  )
}
