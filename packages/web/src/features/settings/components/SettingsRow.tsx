import { Separator } from '@/components/ui/separator'

interface SettingsRowProps {
  label: string
  children: React.ReactNode
  showDivider?: boolean
}

export function SettingsRow({ label, children, showDivider = true }: SettingsRowProps) {
  return (
    <>
      <div className="flex items-center justify-between px-4 py-4">
        <span className="text-sm text-foreground">{label}</span>
        {children}
      </div>
      {showDivider && <Separator />}
    </>
  )
}
