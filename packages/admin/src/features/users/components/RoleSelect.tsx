import type { SelectProps } from 'antd'
import { Select, Tooltip } from 'antd'
import { useEffect, useState } from 'react'
import type { Role } from '@/features/roles/services'
import { fetchRoles } from '@/features/roles/services'
import type { AdminRoleCode } from '@/stores/auth'

export interface RoleSelectProps extends Omit<SelectProps<AdminRoleCode>, 'options' | 'mode'> {
  /** 当前用户拥有的角色，用于禁用同级角色 */
  currentUserRoles?: AdminRoleCode[]
  /** 单选或多选，默认单选 */
  multiple?: boolean
}

export function RoleSelect({ currentUserRoles = [], multiple = false, ...rest }: RoleSelectProps) {
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    void fetchRoles()
      .then(setRoles)
      .finally(() => setLoading(false))
  }, [])

  const options = roles
    .filter((r) => r.code !== 'super_admin')
    .map((r) => {
      const isDisabled = currentUserRoles.includes(r.code as AdminRoleCode)
      return {
        value: r.code as AdminRoleCode,
        label: (
          <Tooltip title={isDisabled ? '无法分配与您相同的角色' : undefined} placement="top">
            <span>{r.name}</span>
          </Tooltip>
        ),
        disabled: isDisabled,
      }
    })

  return (
    <Select<AdminRoleCode>
      mode={multiple ? 'multiple' : undefined}
      style={{ width: '100%' }}
      options={options}
      placeholder="请选择角色"
      loading={loading}
      {...rest}
    />
  )
}
