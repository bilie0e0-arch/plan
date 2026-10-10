import { createClient } from '@/lib/supabase/server'
import { JoinInvite } from '@/components/partner/join-invite'

/** Invite link landing. Works signed out: the token is remembered through sign-up / log-in, then finished in the app. */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const valid = /^[0-9a-f]{32}$/.test(token)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let inviter: { username: string; display_name: string | null } | null = null
  if (user && valid) {
    const { data } = await supabase.rpc('peek_invite_link', { p_token: token })
    inviter = data?.[0] ?? null
  }
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 px-6">
      <JoinInvite token={valid ? token : null} signedIn={!!user} inviter={inviter ? inviter.display_name || `@${inviter.username}` : null} />
    </main>
  )
}
