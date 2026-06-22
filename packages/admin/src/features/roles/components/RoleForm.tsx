import { Form, Modal, Input } from 'antd'
import { createRoleService, editRoleService, fetchRole } from '../services'

interface FormValues {
  name: string
  description?: string
}

export function RoleFormModal(props: { roleId?: string } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    const [form] = Form.useForm<FormValues>()
    const isEdit = !!props.roleId

    const modal = Modal.confirm({
      title: isEdit ? '编辑角色' : '新建角色',
      width: 420,
      content: (
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          className="pt-2"
        >
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
          if (isEdit && props.roleId) {
            const current = await fetchRole(props.roleId)
            const res = await editRoleService(props.roleId, {
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
              name: values.name,
              description: values.description,
              permissions: [],
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

    if (isEdit && props.roleId) {
      void fetchRole(props.roleId).then((r) => {
        if (r) {
          form.setFieldsValue({ name: r.name, description: r.description })
        }
      })
    }
  })
}
