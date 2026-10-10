'use client'

/** Captures made while offline are queued in localStorage and flushed when the connection returns (DESIGN F58). */
const KEY = 'plan.captureQueue.v1'

export interface QueuedCapture { text: string; parked: boolean; at: number }

function read(): QueuedCapture[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as QueuedCapture[]
  } catch {
    return []
  }
}
function write(items: QueuedCapture[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items))
  } catch {
    /* storage unavailable: nothing to do */
  }
}

export function enqueueCapture(text: string, parked: boolean) {
  write([...read(), { text, parked, at: Date.now() }])
}

export function queuedCount(): number {
  return read().length
}

/** Sends queued items one by one; stops at the first failure and keeps the rest. */
export async function flushCaptures(send: (text: string, parked: boolean) => Promise<{ ok: boolean }>): Promise<number> {
  const items = read()
  let sent = 0
  for (const item of items) {
    try {
      const r = await send(item.text, item.parked)
      if (!r.ok) break
    } catch {
      break
    }
    sent++
    write(read().slice(1))
  }
  return sent
}
