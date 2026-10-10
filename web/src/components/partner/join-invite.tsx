'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { acceptInviteLink } from '@/app/actions/partner'

export function JoinInvite({ token, signedIn, inviter }: { token: string | null; signedIn: boolean; inviter: string | null }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  useEffect(() => {
    if (token && !signedIn) { try { localStorage.setItem('plan.join', token) } catch { /* storage unavailable */ } }
  }, [token, signedIn])

  if (!token || (signedIn && !inviter)) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-xl font-semibold">This invite link isn’t valid anymore</h1>
        <p className="text-sm text-muted-foreground">It may have been used or expired. Ask for a new one — or add them with their friend code.</p>
        <Link href="/partner" className="text-sm text-primary hover:underline">Go to Friends</Link>
      </div>
    )
  }
  if (!signedIn) {
    return (
      <div className="space-y-4 text-center">
        <Users className="mx-auto size-8 text-primary" />
        <h1 className="text-xl font-semibold">You’ve been invited to focus together</h1>
        <p className="text-sm text-muted-foreground">Create an account (or log in) and you’ll be asked to become study friends. Nothing is shared until you both agree.</p>
        <Link href="/signup" className="block"><Button className="h-10 w-full">Create account</Button></Link>
        <Link href="/login" className="block text-sm text-muted-foreground hover:text-foreground">I already have an account</Link>
      </div>
    )
  }
  return (
    <div className="space-y-4 text-center">
      <Users className="mx-auto size-8 text-primary" />
      <h1 className="text-xl font-semibold">Be study friends with {inviter}?</h1>
      <p className="text-sm text-muted-foreground">You’ll see each other’s progress as counts (not details) to start. You can change that or leave anytime.</p>
      <Button className="h-10 w-full" disabled={pending} onClick={() => start(async () => {
        const r = await acceptInviteLink(token)
        if (!r.ok) return void toast(r.error)
        toast.success(`You and ${inviter} are now study friends.`)
        router.push('/partner')
      })}>Accept</Button>
      <Link href="/" className="block text-sm text-muted-foreground hover:text-foreground">Not now</Link>
    </div>
  )
}
