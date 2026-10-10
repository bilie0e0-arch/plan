import { Guide } from '@/components/guide/guide'

export const metadata = { title: 'How Plan works' }

export default async function GuidePage({ searchParams }: { searchParams: Promise<{ ch?: string; from?: string }> }) {
  const { ch, from } = await searchParams
  // Only go back to a page inside the app.
  const back = from && from.startsWith('/') && !from.startsWith('//') ? from : '/'
  return <Guide start={ch ?? 'start'} back={back} />
}
