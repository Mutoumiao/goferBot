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

export function ProviderDialog({ open, onOpenChange, initialData, onSubmit }: ProviderDialogProps) {
  const [form, setForm] = useState<ProviderConfig>(EMPTY_FORM)

  useEffect(() => {
    setForm(initialData ?? EMPTY_FORM)
  }, [initialData])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.model.trim()) return
    onSubmit(form)
    onOpenChange(false)
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
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="例如：我的 DeepSeek"
              />
            </div>
            <div className="space-y-2">
              <Label>接口地址</Label>
              <Input
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                placeholder="https://api.example.com"
              />
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
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="例如：deepseek-chat"
              />
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
