'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Chips } from '@/components/ui/choice'
import { updateTrainingSettings } from '@/app/actions/settings'
import { useTaskMutation } from '@/components/tasks/task-actions'

export function TrainingSettings(props: { agingDays: number; personalBands: boolean; anchoredAt: string | null }) {
  const [agingDays, setAgingDays] = useState(props.agingDays)
  const [personalBands, setPersonalBands] = useState(props.personalBands)
  const { pending, run } = useTaskMutation()
  return (
    <section id="training" className="space-y-3 rounded-2xl bg-card shadow-soft p-5">
      <h2 className="font-bold">Training</h2>
      <div className="space-y-1">
        <Label>Ask me to decide on a task after it’s untouched for</Label>
        <Chips label="Days untouched" size="sm" value={agingDays} onChange={setAgingDays}
          options={[7, 14, 21, 30, 60].map((d) => ({ value: d, label: `${d} days` }))} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" checked={personalBands} onChange={(e) => setPersonalBands(e.target.checked)} />
        <span>
          Measure skill levels against my own baseline after 8 weeks
          <span className="block text-xs text-muted-foreground">
            {props.anchoredAt ? `Baseline captured ${new Date(props.anchoredAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.` : 'Your first 4 weeks become the baseline.'} Off = fixed starting thresholds.
          </span>
        </span>
      </label>
      <Button disabled={pending} onClick={() => run(() => updateTrainingSettings({ agingDays, personalBands }), 'Saved.')}>Save</Button>
    </section>
  )
}
