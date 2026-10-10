import { loadReview } from '@/lib/data/review'
import { ReviewFlow } from '@/components/training/review-flow'

export default async function ReviewPage() {
  const d = await loadReview()
  return <ReviewFlow key={d.planWeek} d={d} />
}
