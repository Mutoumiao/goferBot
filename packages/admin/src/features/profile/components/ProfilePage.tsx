import { Tabs } from 'antd'
import { PageHeader } from '@/components/common/PageHeader'
import { BasicInfoCard } from './BasicInfoCard'
import { PasswordChangeForm } from './PasswordChangeForm'
import { LoginHistoryList } from './LoginHistoryList'

export function ProfilePage() {
  return (
    <div className="space-y-4">
      <PageHeader title="个人中心" description="查看个人信息、修改密码、查看登录历史" />

      <Tabs
        items={[
          {
            key: 'info',
            label: '基本信息',
            children: <BasicInfoCard />,
          },
          {
            key: 'password',
            label: '修改密码',
            children: <PasswordChangeForm />,
          },
          {
            key: 'history',
            label: '登录历史',
            children: <LoginHistoryList />,
          },
        ]}
      />
    </div>
  )
}
