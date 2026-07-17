import { App, Button, Card, Checkbox, Collapse, Form, Input, Tag } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/common/PageHeader'
import type { Permission, Role } from '../services'
import { fetchPermissions, fetchRole, updateRoleService } from '../services'

const SUPER_ADMIN_ROLE_CODE = 'super_admin'

export function PermissionMatrix({ roleCode, onBack }: { roleCode: string; onBack: () => void }) {
  const { message } = App.useApp()
  const [role, setRole] = useState<Role | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const isSuperAdmin = role?.code === SUPER_ADMIN_ROLE_CODE

  const load = useCallback(async () => {
    try {
      const [r, perms] = await Promise.all([fetchRole(roleCode), fetchPermissions()])
      setRole(r)
      setPermissions(perms)
      setSelected(r?.permissions ?? [])
    } catch {
      message.error('加载角色或权限列表失败，请刷新重试')
    }
  }, [roleCode])

  useEffect(() => {
    void load()
  }, [load])

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
    const res = await updateRoleService(role.code, {
      name: role.name,
      description: role.description ?? undefined,
      permissions: selected,
    })
    setSaving(false)
    if (res.success) {
      message.success('保存成功')
      void load()
    }
  }

  const toggle = (key: string, checked: boolean) => {
    setSelected((prev) => (checked ? [...prev, key] : prev.filter((k) => k !== key)))
  }

  const toggleGroup = (groupPerms: Permission[], checked: boolean) => {
    const keys = groupPerms.map((p) => p.key)
    setSelected((prev) => {
      const others = prev.filter((k) => !keys.includes(k))
      return checked ? [...others, ...keys] : others
    })
  }

  const isDirty = role ? selected.join(',') !== role.permissions.join(',') : false

  return (
    <div className="space-y-4">
      <PageHeader
        title={role ? `编辑角色：${role.name}` : '编辑角色'}
        onBack={onBack}
        extra={
          isSuperAdmin ? null : (
            <Button type="primary" disabled={saving || !isDirty} onClick={() => void handleSave()}>
              {saving ? '保存中...' : isDirty ? '保存修改' : '已保存'}
            </Button>
          )
        }
      />

      <Card title="基本信息">
        <Form layout="vertical" className="max-w-md">
          <Form.Item label="角色名称">
            <Input disabled value={role?.name} />
          </Form.Item>
          <Form.Item label="角色编码">
            <Input disabled value={role?.code} />
          </Form.Item>
          <Form.Item label="描述">
            <Input.TextArea rows={2} disabled value={role?.description ?? ''} />
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="权限点配置"
        extra={
          isSuperAdmin ? (
            <Tag color="gold">全部权限（不可编辑）</Tag>
          ) : (
            <Tag color="blue">已选择 {selected.length} 项</Tag>
          )
        }
      >
        {isSuperAdmin ? (
          <div className="py-8 text-center text-slate-500">
            <Tag color="gold" className="mb-2">
              超级管理员
            </Tag>
            <p className="text-sm">
              超级管理员角色拥有所有权限的通配符（*），无需单独配置权限点，且不可编辑。
            </p>
          </div>
        ) : (
          <Collapse
            items={grouped.map(([group, list]) => {
              const allChecked = list.every((p) => selected.includes(p.key))
              const someChecked = list.some((p) => selected.includes(p.key))
              return {
                key: group,
                label: (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allChecked}
                      indeterminate={!allChecked && someChecked}
                      onChange={(e) => toggleGroup(list, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="font-medium">{group}</span>
                    </Checkbox>
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
              }
            })}
          />
        )}
      </Card>
    </div>
  )
}
