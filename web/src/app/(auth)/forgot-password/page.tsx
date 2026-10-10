'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FormMessage } from '@/components/auth/field'
import { requestPasswordReset, type AuthState } from '../actions'

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, { error: null })
  return (
    <form action={action} className="space-y-4">
      <Field id="email" label="Recovery email" type="email" autoComplete="email" required />
      <FormMessage error={state.error} notice={state.notice} />
      <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>Send reset link</Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link className="hover:text-foreground" href="/login">Back to log in</Link>
      </p>
    </form>
  )
}
