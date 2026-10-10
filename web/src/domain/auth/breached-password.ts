import { createHash } from 'node:crypto'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/**
 * HaveIBeenPwned k-anonymity check: only the first 5 hex chars of the SHA-1 leave the server.
 * Fails open (false) if the service is unavailable so signups never break on it.
 */
export async function isPasswordBreached(password: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  const hash = createHash('sha1').update(password).digest('hex').toUpperCase()
  const prefix = hash.slice(0, 5)
  const suffix = hash.slice(5)
  try {
    const res = await fetchImpl(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) return false
    const body = await res.text()
    return body.split('\n').some((line) => {
      const [s, count] = line.trim().split(':')
      return s === suffix && Number(count) > 0
    })
  } catch {
    return false
  }
}
