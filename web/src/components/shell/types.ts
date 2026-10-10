export interface OpenSessionView {
  id: string
  taskId: string
  taskTitle: string
  mode: string
  startedAt: string
  pausedAt: string | null
  pausedSeconds: number
  plannedMinutes: number | null
}

export interface WhatsLeftData {
  dayPlanned: boolean
  dayClosed: boolean
  remaining: { id: string; title: string; evening: boolean; plannedMinutes: number | null }[]
  doneCount: number
  focusMinutes: number
  fit: { adjustedMinutes: number; availableMinutes: number; state: 'ok' | 'tight' | 'over' }
  inboxCount: number
  hoursLeft: number
  budgets: { id: string; name: string; color: string; actualMinutes: number; budgetMinutes: number; underServed: boolean }[]
  goals: { id: string; title: string; spentMinutes: number; weeklyMinutes: number; plannedMinutes: number }[]
}
