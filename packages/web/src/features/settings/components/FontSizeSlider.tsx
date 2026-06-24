import { Slider } from '@/components/ui/slider'

const LABELS = ['极小', '小', '标准', '大', '极大']

// ponytail: 有效字体大小级别
const VALID_LEVELS = [1, 2, 3, 4, 5] as const
type FontSizeLevel = (typeof VALID_LEVELS)[number]

interface FontSizeSliderProps {
  value: FontSizeLevel
  onChange: (value: FontSizeLevel) => void
}

export function FontSizeSlider({ value, onChange }: FontSizeSliderProps) {
  return (
    <div className="flex items-center gap-4 w-[240px]">
      <Slider
        min={1}
        max={5}
        step={1}
        value={[value]}
        onValueChange={([v]) => {
          // ponytail: 运行时检查确保值在有效范围内
          if (VALID_LEVELS.includes(v as FontSizeLevel)) {
            onChange(v as FontSizeLevel)
          }
        }}
      />
      <span className="text-sm text-muted-foreground w-12 text-right">{LABELS[value - 1]}</span>
    </div>
  )
}
