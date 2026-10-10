/** Browser speech recognition (free, on-device/browser service; Chrome/Edge). Plain dictation — no AI. */

export type SR = {
  continuous: boolean; interimResults: boolean; lang: string; start(): void; stop(): void; abort(): void
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null
}

export function speechRecognitionCtor(): (new () => SR) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}
