import { loadFriends } from '@/lib/data/partner'
import { ConnectPartner } from '@/components/partner/connect-partner'
import { FriendsPanel } from '@/components/partner/partner-panel'

export default async function FriendsPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const [s, { f }] = await Promise.all([loadFriends(), searchParams])
  if (!s.friends.length) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-extrabold tracking-tight">Study friends 👥</h1>
          <p className="text-sm text-muted-foreground">Add friends to focus together and keep each other on track. You choose what each friend sees.</p>
        </header>
        <ConnectPartner code={s.code} incoming={s.incoming} outgoing={s.outgoing} />
      </div>
    )
  }
  return <FriendsPanel s={s} selected={f ?? null} />
}
