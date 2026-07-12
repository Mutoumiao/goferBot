import { Form, Input } from 'antd'
import type { AppModal } from '@/utils/antd-app'
import { getAppModal } from '@/utils/antd-app'
import { createRoleService, editRoleService, fetchRole } from '../services'

export function RoleFormModal(
  props: { roleCode?: string; modalApi?: AppModal } = {},
): Promise<boolean> {
  const isEdit = !!props.roleCode
  const Modal = props.modalApi ?? getAppModal()

  return new Promise((resolve) => {
    let formCode = ''
    let formName = ''
    let formDescription = ''
    let fieldErrors: Record<string, string> = {}

    const renderContent = () => (
      <Form layout="vertical" preserve={false} className="pt-2">
        {!isEdit && (
          <Form.Item
            label="角色编码"
            validateStatus={fieldErrors.code ? 'error' : undefined}
            help={fieldErrors.code}
            tooltip="kebab-case 格式，例如：auditor"
          >
            <Input
              placeholder="例如：auditor"
              defaultValue={formCode}
              onChange={(e) => {
                formCode = e.target.value
                delete fieldErrors.code
                roleModalRef.update({ content: renderContent() })
              }}
            />
          </Form.Item>
        )}
        <Form.Item
          label="角色名称"
          validateStatus={fieldErrors.name ? 'error' : undefined}
          help={fieldErrors.name}
        >
          <Input
            placeholder="例如：审计员"
            defaultValue={formName}
            onChange={(e) => {
              formName = e.target.value
              delete fieldErrors.name
              roleModalRef.update({ content: renderContent() })
            }}
          />
        </Form.Item>
        <Form.Item label="描述">
          <Input.TextArea
            rows={3}
            placeholder="选填"
            defaultValue={formDescription}
            onChange={(e) => {
              formDescription = e.target.value
              roleModalRef.update({ content: renderContent() })
            }}
          />
        </Form.Item>
      </Form>
    )

    const roleModalRef = Modal.confirm({
      title: isEdit ? '编辑角色' : '新建角色',
      width: 480,
      content: renderContent(),
      okText: isEdit ? '保存修改' : '创建',
      cancelText: '取消',
      onOk: async () => {
        fieldErrors = {}

        if (!isEdit) {
          if (!formCode) {
            fieldErrors.code = '请输入角色编码'
          } else if (!/^[a-z][a-z0-9_-]*$/.test(formCode)) {
            fieldErrors.code = '角色编码需以小写字母开头，仅含小写字母、数字、下划线、连字符'
          }
        }
        if (!formName) {
          fieldErrors.name = '请输入角色名称'
        }

        if (Object.keys(fieldErrors).length > 0) {
          roleModalRef.update({ content: renderContent() })
          return Promise.reject(new Error('validation failed'))
        }

        if (isEdit && props.roleCode) {
          const current = await fetchRole(props.roleCode)
          const res = await editRoleService(props.roleCode, {
            name: formName,
            description: formDescription || undefined,
            permissions: current?.permissions ?? [],
          })
          if (res.success) {
            resolve(true)
            roleModalRef.destroy()
          } else {
            return Promise.reject(new Error(res.error))
          }
        } else {
          const res = await createRoleService({
            code: formCode,
            name: formName,
            description: formDescription || undefined,
          })
          if (res.success) {
            resolve(true)
            roleModalRef.destroy()
          } else {
            return Promise.reject(new Error(res.error))
          }
        }
      },
      onCancel: () => {
        resolve(false)
        roleModalRef.destroy()
      },
    })

    if (isEdit && props.roleCode) {
      void fetchRole(props.roleCode).then((r) => {
        if (r) {
          formName = r.name
          formDescription = r.description ?? ''
          roleModalRef.update({ content: renderContent() })
        }
      })
    }
  })
}
