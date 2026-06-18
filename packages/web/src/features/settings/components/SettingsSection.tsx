import { cn } from '@/lib/utils'

interface SettingsSectionProps {
  title: string
  children: React.ReactNode
  className?: string
}

export function SettingsSection({ title, children, className }: SettingsSectionProps) {
  return (
    <section className={cn('space-y-2', className)}>
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="rounded-xl border border-border bg-card">{children}</div>
    </section>
  )
}
