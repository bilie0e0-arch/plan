'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FormMessage } from '@/components/auth/field'
import { login, type AuthState } from '../actions'

export default function LoginPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(login, { error: null })
  return (
    <form action={action} className="space-y-4">
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
