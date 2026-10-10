'use client'

import Link from 'next/link'
import { useActionState, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FormMessage } from '@/components/auth/field'
import { signup, type AuthState } from '../actions'

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(signup, { error: null })
  const tzRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState('')
  const strength = Math.min(100, Math.round((password.length / 16) * 100))

  return (
    <form action={action} className="space-y-4"
      onSubmit={() => { if (tzRef.current) tzRef.current.value = Intl.DateTimeFormat().resolvedOptions().timeZone }}>
      <input ref={tzRef} type="hidden" name="timezone" defaultValue="UTC" />
      <Field id="username" label="Username" autoComplete="username" autoCapitalize="none" spellCheck={false} required
        hint="3–20 characters: lowercase letters, digits or _" />
      <Field id="email" label="Recovery email" type="email" autoComplete="email" required
        hint="Used only to reset your password." />
      <div className="space-y-1.5">
        <Field id="password" label="Password" type="password" autoComplete="new-password" minLength={10} required
          value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className={`h-full transition-all ${password.length >= 10 ? 'bg-primary' : 'bg-warning'}`} style={{ width: `${strength}%` }} />
        </div>
        <p className="text-xs text-muted-foreground">At least 10 characters. Length matters more than symbols.</p>
      </div>
      <FormMessage error={state.error} />
      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Have an account? <Link className="hover:text-foreground" href="/login">Log in</Link>
      </p>
    </form>
  )
}
