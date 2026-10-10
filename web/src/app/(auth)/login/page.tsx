'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FormMessage } from '@/components/auth/field'
import { login, type AuthState } from '../actions'

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, { error: null })
  const notice = useLinkNotice()
  return (
    <form action={action} className="space-y-4">
      {notice && <p role="status" className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">{notice}</p>}
      <Field id="username" label="Username" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      <Field id="password" label="Password" type="password" autoComplete="current-password" required />
      <FormMessage error={state.error} />
      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
        {pending ? 'Logging in…' : 'Log in'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href="/forgot-password">Forgot password</Link>
        {' · '}
        <Link className="hover:text-foreground" href="/signup">Create account</Link>
      </p>
    </form>
  )
}

const NOTICES: Record<string, string> = {
  'confirmed=1': 'Email confirmed ✓ — log in below.',
  'error=link': 'That link didn’t work or has expired. Please try again.',
  'error=device': 'Open the reset link in the same browser where you asked for it — or request a new link.',
}

/** A one-line note after following an email link (read on the client so the page stays static). */
function useLinkNotice() {
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => {
    const q = window.location.search.slice(1)
    // Reading the URL once after load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotice(Object.entries(NOTICES).find(([k]) => q.includes(k))?.[1] ?? null)
  }, [])
  return notice
}
