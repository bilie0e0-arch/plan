'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { publicEnv } from '@/lib/env'
import { serverEnv } from '@/lib/server-env'
import { passwordSchema, signupSchema } from '@/domain/auth/validation'
import { isPasswordBreached } from '@/domain/auth/breached-password'

export type AuthState = { error: string | null; notice?: string | null }

const GENERIC_LOGIN_ERROR = 'Username or password is incorrect.'
const GENERIC_FAILURE = 'Something went wrong. Please try again.'
const BREACHED = 'This password has appeared in a data breach. Please choose another.'

async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

async function breached(password: string): Promise<boolean> {
  return serverEnv.PASSWORD_BREACH_CHECK === 'on' && (await isPasswordBreached(password))
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password'),
    timezone: formData.get('timezone') || undefined,
  })
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE }
  const { username, email, password, timezone } = parsed.data

  if (await breached(password)) return { error: BREACHED }

  const admin = createAdminClient()
  const { data: available, error: availErr } = await admin.rpc('username_available', { p_username: username })
  if (availErr) return { error: GENERIC_FAILURE }
  if (!available) return { error: 'That username is taken.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username, timezone } } })
  if (error) return { error: 'Could not create the account. Please try again.' }

  if (!data.session) redirect('/check-email')
  redirect('/')
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const username = String(formData.get('username') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  if (!username || !password) return { error: GENERIC_LOGIN_ERROR }

  const ip = await clientIp()
  const admin = createAdminClient()

  const { data: allowed, error: limitErr } = await admin.rpc('login_allowed', { p_username: username, p_ip: ip })
  if (limitErr) return { error: GENERIC_FAILURE }
  if (!allowed) return { error: 'Too many attempts. Wait 15 minutes and try again.' }

  const { data: email } = await admin.rpc('email_for_username', { p_username: username })

  let success = false
  let unconfirmed = false
  if (email) {
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    success = !error
    unconfirmed = error?.code === 'email_not_confirmed'
  }
  await admin.rpc('record_login_attempt', { p_username: username, p_ip: ip, p_success: success })

  if (unconfirmed) return { error: 'Please confirm your email first — check your inbox.' }
  if (!success) return { error: GENERIC_LOGIN_ERROR }
  redirect('/')
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function logoutEverywhere(): Promise<void> {
  const supabase = await createClient()
  // Signed-out devices must stop receiving this account's notifications.
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('push_subscriptions').delete().eq('owner_id', user.id)
    await supabase.from('settings').update({ push_enabled: false }).eq('owner_id', user.id)
  }
  await supabase.auth.signOut({ scope: 'global' })
  redirect('/login')
}

export async function requestPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim()
  if (email) {
    const supabase = await createClient()
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
    })
  }
  return { error: null, notice: 'If an account uses that email, a reset link is on its way.' }
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = passwordSchema.safeParse(formData.get('password'))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_FAILURE }
  if (await breached(parsed.data)) return { error: BREACHED }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data })
  if (error) return { error: 'Could not update the password. Request a new reset link.' }
  redirect('/')
}
