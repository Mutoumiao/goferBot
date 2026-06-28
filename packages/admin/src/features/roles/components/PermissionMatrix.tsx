import { App, Card, Checkbox, Collapse, Form, Input, Tag } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import type { Permission, Role } from '../services'
import { fetchPermissions, fetchRole, updateRoleService } from '../services'

export function PermissionMatrix({ roleId, onBack }: { roleId: string; onBack: () => void }) {
  const { message } = App.useApp()
  const [role, setRole] = useState<Role | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const [r, perms] = await Promise.all([fetchRole(roleId), fetchPermissions()])
      setRole(r)
      setPermissions(perms)
      setSelected(r?.permissions ?? [])
    } catch (e) {
      message.error('加载角色或权限列表失败，请刷新重试')
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId])

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>()
    for (const p of permissions) {
      const list = map.get(p.group) ?? []
      list.push(p)
      map.set(p.group, list)
    }
    return Array.from(map.entries())
  }, [permissions])

  const handleSave = async () => {
    if (!role) return
    setSaving(true)
    const res = await updateRoleService(role.id, {
      name: role.name,
      description: role.description,
      permissions: selected,
    })
    setSaving(false)
    if (res.success) {
      message.success('保存成功')
    }
  }

  const toggle = (key: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)))
  }

  const isDirty = role ? selected.join(',') !== role.permissions.join(',') : false

  return (
    <div className="space-y-4">
      <PageHeader
        title={role ? `编辑角色：${role.name}` : '编辑角色'}
        onBack={onBack}
        extra={
          <button disabled={saving || !isDirty} onClick={() => void handleSave()}>
            {saving ? '保存中...' : isDirty ? '保存修改' : '已保存'}
          </button>
        }
      />

      <Card title="基本信息">
        <Form layout="vertical" className="max-w-md">
          <Form.Item label="角色名称">
            <Input disabled value={role?.name} />
          </Form.Item>
          <Form.Item label="描述">
            <Input.TextArea rows={2} disabled value={role?.description} />
          </Form.Item>
        </Form>
      </Card>

      <Card title="权限点配置" extra={<Tag color="blue">已选择 {selected.length} 项</Tag>}>
        <Collapse
          items={grouped.map(([group, list]) => ({
            key: group,
            label: (
              <div className="flex items-center gap-2">
                <span className="font-medium">{group}</span>
                <Tag color="default">{list.length} 项</Tag>
              </div>
            ),
            children: (
              <div className="space-y-2">
                {list.map((p) => (
                  <Checkbox
                    key={p.key}
                    checked={selected.includes(p.key)}
                    onChange={(e) => toggle(p.key, e.target.checked)}
                  >
                    <span className="text-sm text-slate-700">{p.name}</span>
                    {p.description && (
                      <span className="ml-2 text-xs text-slate-400">— {p.description}</span>
                    )}
                  </Checkbox>
                ))}
              </div>
            ),
          }))}
        />
      </Card>
    </div>
  )
}
