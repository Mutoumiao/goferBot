import { Avatar, Form, Input, Modal } from 'antd'
import type { ModalStaticFunctions } from 'antd/es/modal/confirm'
import type { AdminRoleCode } from '@/stores/auth'
import { useAuthStore } from '@/stores/auth'
import type { AdminUserResponse } from '../services'
import { createUserService, updateUserService } from '../services'
import { RoleSelect } from './RoleSelect'

export interface UserFormModalResult {
  success: boolean
}

export function showCreateUserModal(
  modalApi?: Omit<ModalStaticFunctions, 'warn'>,
): Promise<boolean> {
  const modal = modalApi ?? Modal
  return new Promise((resolve) => {
    const currentUserRoles = (useAuthStore.getState().user?.roles ?? []) as AdminRoleCode[]

    let formEmail = ''
    let formName = ''
    let formPassword = ''
    let formRole: AdminRoleCode = 'user'
    let fieldErrors: Record<string, string> = {}

    const renderContent = () => (
      <Form layout="vertical" preserve={false} className="pt-2">
        <Form.Item
          label="邮箱"
          validateStatus={fieldErrors.email ? 'error' : undefined}
          help={fieldErrors.email}
        >
          <Input
            placeholder="user@example.com"
            onChange={(e) => {
              formEmail = e.target.value
              delete fieldErrors.email
              createModalRef.update({ content: renderContent() })
            }}
          />
        </Form.Item>

        <Form.Item label="昵称">
          <Input
            placeholder="选填"
            onChange={(e) => {
              formName = e.target.value
              createModalRef.update({ content: renderContent() })
            }}
          />
        </Form.Item>

        <Form.Item
          label="初始密码"
          validateStatus={fieldErrors.password ? 'error' : undefined}
          help={fieldErrors.password}
        >
          <Input.Password
            placeholder="至少 8 位"
            onChange={(e) => {
              formPassword = e.target.value
              delete fieldErrors.password
              createModalRef.update({ content: renderContent() })
            }}
          />
        </Form.Item>

        <Form.Item label="角色">
          <RoleSelect
            currentUserRoles={currentUserRoles}
            defaultValue="user"
            onChange={(v) => {
              formRole = v
              createModalRef.update({ content: renderContent() })
            }}
          />
        </Form.Item>
      </Form>
    )

    const createModalRef = modal.confirm({
      title: '新建用户',
      icon: null,
      width: 480,
      content: renderContent(),
      okText: '创建',
      cancelText: '取消',
      onOk: async () => {
        fieldErrors = {}

        if (!formEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail)) {
          fieldErrors.email = !formEmail ? '请输入邮箱' : '邮箱格式不正确'
        }
        if (!formPassword) {
          fieldErrors.password = '请输入初始密码'
        } else if (formPassword.length < 8) {
          fieldErrors.password = '密码至少 8 位'
        }

        if (Object.keys(fieldErrors).length > 0) {
          createModalRef.update({ content: renderContent() })
          return Promise.reject(new Error('validation'))
        }

        const res = await createUserService({
          email: formEmail,
          name: formName || undefined,
          password: formPassword,
          roles: [formRole],
        })
        if (res.success) {
          resolve(true)
          createModalRef.destroy()
        } else {
          return Promise.reject(new Error(res.error))
        }
      },
      onCancel: () => {
        resolve(false)
        createModalRef.destroy()
      },
    })
  })
}

export function showEditUserModal(
  user: AdminUserResponse,
  modalApi?: Omit<ModalStaticFunctions, 'warn'>,
): Promise<boolean> {
  const modal = modalApi ?? Modal
  return new Promise((resolve) => {
    let formName = user.name ?? ''

    const avatarLetter = (user.name ?? user.email)[0].toUpperCase()
    const avatarSrc = user.avatar

    const renderContent = () => (
      <div className="pt-2">
        {/* 头像居中 */}
        <div className="mb-6 flex flex-col items-center">
          <Avatar
            size={72}
            src={avatarSrc}
            style={{
              backgroundColor: avatarSrc ? undefined : '#4f46e5',
              fontSize: 28,
              fontWeight: 600,
            }}
          >
            {!avatarSrc ? avatarLetter : undefined}
          </Avatar>
          <div className="mt-3 text-center">
            <div className="text-base font-semibold text-slate-800">{user.name ?? '未命名'}</div>
            <div className="text-sm text-slate-500">{user.email}</div>
          </div>
        </div>

        <Form layout="vertical" preserve={false}>
          <Form.Item label="邮箱">
            <Input disabled value={user.email} />
          </Form.Item>
          <Form.Item label="昵称">
            <Input
              placeholder="选填"
              defaultValue={formName}
              onChange={(e) => {
                formName = e.target.value
                editModalRef.update({ content: renderContent() })
              }}
            />
          </Form.Item>
        </Form>
      </div>
    )

    const editModalRef = modal.confirm({
      title: '编辑用户',
      icon: null,
      width: 440,
      content: renderContent(),
      okText: '保存',
      cancelText: '取消',
      onOk: async () => {
        const res = await updateUserService(user.id, {
          name: formName || undefined,
          updatedAt: user.updatedAt,
        })
        if (res.success) {
          resolve(true)
          editModalRef.destroy()
        } else if (res.conflict) {
          resolve(false)
          editModalRef.destroy()
        } else {
          return Promise.reject(new Error(res.error))
        }
      },
      onCancel: () => {
        resolve(false)
        editModalRef.destroy()
      },
    })
  })
}
