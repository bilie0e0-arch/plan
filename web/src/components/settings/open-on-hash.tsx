'use client'

import { useEffect } from 'react'

/** Links like /settings#guide point inside the Advanced section: open it and scroll there. */
export function OpenOnHash({ detailsId }: { detailsId: string }) {
  useEffect(() => {
    const id = window.location.hash.slice(1)
    if (!id) return
    const target = document.getElementById(id)
    const details = document.getElementById(detailsId) as HTMLDetailsElement | null
    if (target && details?.contains(target)) {
      details.open = true
      requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }))
    }
  }, [detailsId])
  return null
}
