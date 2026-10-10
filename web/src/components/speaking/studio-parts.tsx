'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Star, Trash2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Choice, Chips } from '@/components/ui/choice'
import { addPrompt, deleteRecording, setMilestone } from '@/app/actions/speaking'
import { useTaskMutation } from '@/components/tasks/task-actions'
import { DRILLS, type DrillType } from '@/domain/speaking/metrics'

export function AudioPlayer({ url }: { url: string | null }) {
  if (!url) return <span className="text-xs text-muted-foreground">Audio not kept</span>
  return <audio controls preload="none" src={url} className="h-8 max-w-full" />
}

export function RecordingActions({ id, milestone, retakeHref }: { id: string; milestone: boolean; retakeHref: string | null }) {
  const { pending, run } = useTaskMutation()
  return (
    <div className={`ml-auto flex items-center gap-1 ${pending ? 'opacity-50' : ''}`}>
      {retakeHref && <Link href={retakeHref} title="Retake" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><RotateCcw className="size-4" /></Link>}
      <button title={milestone ? 'Unpin milestone' : 'Keep as milestone'} onClick={() => run(() => setMilestone(id, !milestone))}
        className={`rounded-md p-1.5 hover:bg-muted ${milestone ? 'text-primary' : 'text-muted-foreground'}`}><Star className="size-4" /></button>
      <button title="Delete" onClick={() => confirm('Delete this recording and its audio?') && run(() => deleteRecording(id), 'Deleted.')}
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Trash2 className="size-4" /></button>
    </div>
  )
}

export function AddPromptForm({ projects }: { projects: { id: string; name: string }[] }) {
  const [text, setText] = useState('')
  const [drill, setDrill] = useState<DrillType>('structured')
  const [framework, setFramework] = useState('')
  const [projectId, setProjectId] = useState('')
  const { pending, run } = useTaskMutation()
  return (
    <details className="rounded-2xl bg-card shadow-soft">
      <summary className="cursor-pointer px-5 py-3 text-sm font-medium">Add your own prompt</summary>
      <div className="space-y-2 px-5 pb-5">
        <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Explain the main idea of what you studied today." />
        <Chips label="Drill" size="sm" value={drill} onChange={setDrill} options={(Object.keys(DRILLS) as DrillType[]).map((d) => ({ value: d, label: DRILLS[d].label }))} />
        <Chips label="Framework" size="sm" value={framework} onChange={setFramework}
          options={[{ value: '', label: 'No framework' }, { value: 'prep', label: 'PREP', hint: 'Point → Reason → Example → Point' }, { value: 'star', label: 'STAR', hint: 'Situation → Task → Action → Result' }]} />
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-48 flex-1"><Choice label="Project" size="sm" value={projectId} onChange={setProjectId}
            options={[{ value: '', label: 'No project' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} /></div>
          <Button variant="outline" disabled={pending || text.trim().length < 3} onClick={() => run(async () => {
            const r = await addPrompt({ drillType: drill, text, framework: framework || null, projectId: projectId || null })
            if (r.ok) setText('')
            return r
          }, 'Prompt added.')}>Add</Button>
        </div>
      </div>
    </details>
  )
}
