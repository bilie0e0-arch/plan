import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function Field({
  id, label, hint, ...props
}: React.ComponentProps<typeof Input> & { id: string; label: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} className="h-10" {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function FormMessage({ error, notice }: { error?: string | null; notice?: string | null }) {
  if (error) return <p role="alert" className="rounded-lg bg-warning-muted px-3 py-2 text-sm text-warning-foreground">{error}</p>
  if (notice) return <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">{notice}</p>
  return null
}
