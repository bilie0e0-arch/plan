'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FormMessage } from '@/components/auth/field'
import { updatePassword, type AuthState } from '../(auth)/actions'

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(updatePassword, { error: null })
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form action={action} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Set a new password</h1>
        <Field id="password" label="New password" type="password" autoComplete="new-password" minLength={10} required />
        <FormMessage error={state.error} />
        <Button type="submit" size="lg" className="h-10 w-full" disabled={pending}>Save password</Button>
      </form>
    </main>
  )
}
