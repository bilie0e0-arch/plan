export interface KeyInfo { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; typing: boolean }

export function keyInfo(e: KeyboardEvent): KeyInfo {
  const t = e.target instanceof HTMLElement ? e.target : null
  const typing = !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
  return { key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, typing }
}

/** Plain single-key shortcuts only fire outside text fields and without modifiers. */
export function plainKey(k: KeyInfo): string | null {
  if (k.typing || k.ctrlKey || k.metaKey || k.altKey) return null
  return k.key.toLowerCase()
}
