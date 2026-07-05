import { Form, Input, Modal } from 'antd'
import { createRoleService, editRoleService, fetchRole } from '../services'

interface FormValues {
  code?: string
  name: string
  description?: string
}

export function RoleFormModal(props: { roleCode?: string } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const [form] = Form.useForm<FormValues>()
    const isEdit = !!props.roleCode

    const modal = Modal.confirm({
      title: isEdit ? '编辑角色' : '新建角色',
      width: 480,
      content: (
        <Form form={form} layout="vertical" preserve={false} className="pt-2">
          {!isEdit && (
            <Form.Item
              name="code"
              label="角色编码"
              rules={[
                { required: true, message: '请输入角色编码' },
                {
                  pattern: /^[a-z][a-z0-9_-]*$/,
                  message: '角色编码需以小写字母开头，仅含小写字母、数字、下划线、连字符',
                },
              ]}
              tooltip="kebab-case 格式，例如：auditor"
            >
              <Input placeholder="例如：auditor" />
            </Form.Item>
          )}
          <Form.Item
            name="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          >
            <Input placeholder="例如：审计员" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="选填" />
          </Form.Item>
        </Form>
      ),
      okText: isEdit ? '保存修改' : '创建',
      cancelText: '取消',
      onOk: async () => {
        try {
          const values = await form.validateFields()
          if (isEdit && props.roleCode) {
            const current = await fetchRole(props.roleCode)
            const res = await editRoleService(props.roleCode, {
              name: values.name,
              description: values.description,
              permissions: current?.permissions ?? [],
            })
            if (res.success) {
              resolve(true)
              modal.destroy()
            } else {
              return Promise.reject(new Error(res.error))
            }
          } else {
            const res = await createRoleService({
              code: values.code ?? '',
              name: values.name,
              description: values.description,
            })
            if (res.success) {
              resolve(true)
              modal.destroy()
            } else {
              return Promise.reject(new Error(res.error))
            }
          }
        } catch {
          return Promise.reject(new Error('validation failed'))
        }
      },
      onCancel: () => {
        resolve(false)
        modal.destroy()
      },
    })

    if (isEdit && props.roleCode) {
      void fetchRole(props.roleCode).then((r) => {
        if (r) {
          form.setFieldsValue({ name: r.name, description: r.description ?? undefined })
        }
      })
    }
  })
}
