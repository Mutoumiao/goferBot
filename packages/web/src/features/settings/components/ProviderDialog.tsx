import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ProviderConfig } from '@/utils/llm-config'

interface ProviderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: ProviderConfig
  onSubmit: (data: ProviderConfig) => void
}

const EMPTY_FORM: ProviderConfig = { name: '', apiKey: '', model: '', baseUrl: '' }

// ponytail: 简单的 URL 格式验证，不引入新依赖
function isValidUrl(url: string): boolean {
  if (!url) return true // 空值允许（使用默认 baseUrl）
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

interface FormErrors {
  name?: string
  baseUrl?: string
  model?: string
}

export function ProviderDialog({ open, onOpenChange, initialData, onSubmit }: ProviderDialogProps) {
  const [form, setForm] = useState<ProviderConfig>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})

  useEffect(() => {
    setForm(initialData ?? EMPTY_FORM)
    setErrors({})
  }, [initialData])

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!form.name.trim()) {
      newErrors.name = '名称不能为空'
    }

    if (!form.model.trim()) {
      newErrors.model = '模型名称不能为空'
    }

    if (form.baseUrl && !isValidUrl(form.baseUrl)) {
      newErrors.baseUrl = '接口地址格式不正确'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    onSubmit(form)
    onOpenChange(false)
  }

  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors({ ...errors, [field]: undefined })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{initialData ? '编辑模型' : '添加自定义模型'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>自定义名称</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value })
                  clearError('name')
                }}
                placeholder="例如：我的 DeepSeek"
              />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-2">
              <Label>接口地址</Label>
              <Input
                value={form.baseUrl}
                onChange={(e) => {
                  setForm({ ...form, baseUrl: e.target.value })
                  clearError('baseUrl')
                }}
                placeholder="https://api.example.com"
              />
              {errors.baseUrl && <p className="text-xs text-destructive">{errors.baseUrl}</p>}
            </div>
            <div className="space-y-2">
              <Label>API 密钥</Label>
              <Input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="sk-..."
              />
            </div>
            <div className="space-y-2">
              <Label>模型名称</Label>
              <Input
                value={form.model}
                onChange={(e) => {
                  setForm({ ...form, model: e.target.value })
                  clearError('model')
                }}
                placeholder="例如：deepseek-chat"
              />
              {errors.model && <p className="text-xs text-destructive">{errors.model}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit">保存</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
