import { getViewer } from '@/lib/data/viewer'
import { loadProjectOptions } from '@/lib/data/lists'
import { GoalWizard } from '@/components/goals/goal-wizard'

export default async function NewGoalPage() {
  const [projects, v] = await Promise.all([loadProjectOptions(), getViewer()])
  return <GoalWizard projects={projects} kind={v.settings.work_kind} />
}
