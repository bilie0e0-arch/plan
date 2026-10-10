import type { EmailOtpType } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/domain/auth/safe-next'

/**
 * Email links land here. Two shapes:
 * - custom template: ?token_hash=…&type=… (verified here)
 * - Supabase's default template: Supabase verifies the email first, then sends ?code=… (exchanged here).
 *   The exchange only works in the browser that asked for the email; a sign-up is confirmed either way.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))
  const resetting = next.startsWith('/reset-password')

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) redirect(next)
  } else if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) redirect(next)
    // Opened on another device: the email is already confirmed, so just log in. A reset must be redone here.
    redirect(resetting ? '/login?error=device' : '/login?confirmed=1')
  }
  redirect('/login?error=link')
}
