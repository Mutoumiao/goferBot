import { Slider } from '@/components/ui/slider'

const LABELS = ['极小', '小', '标准', '大', '极大']

interface FontSizeSliderProps {
  value: 1 | 2 | 3 | 4 | 5
  onChange: (value: 1 | 2 | 3 | 4 | 5) => void
}

export function FontSizeSlider({ value, onChange }: FontSizeSliderProps) {
  return (
    <div className="flex items-center gap-4 w-[240px]">
      <Slider
        min={1}
        max={5}
        step={1}
        value={[value]}
        onValueChange={([v]) => onChange(v as 1 | 2 | 3 | 4 | 5)}
      />
      <span className="text-sm text-muted-foreground w-12 text-right">{LABELS[value - 1]}</span>
    </div>
  )
}
