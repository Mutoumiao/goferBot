import { Avatar, Button, Dropdown, Space, theme } from 'antd'
import { LogOut, User as UserIcon } from 'lucide-react'
import { logoutService } from '@/features/auth/services'
import { useAuthStore } from '@/stores/auth'

export function PasswordChangeLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user)
  const { token } = theme.useToken()

  return (
    <div className="min-h-screen flex flex-col bg-[#f0f2f5]">
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold">
            G
          </div>
          <span className="text-lg font-semibold text-gray-800">GoferBot Admin</span>
        </div>

        <Dropdown
          menu={{
            items: [
              {
                key: 'logout',
                icon: <LogOut size={14} />,
                label: '退出登录',
                danger: true,
                onClick: () => logoutService(),
              },
            ],
          }}
          placement="bottomRight"
        >
          <Space className="cursor-pointer px-2 py-1 rounded-md hover:bg-gray-100 transition-colors">
            <Avatar size="small" style={{ backgroundColor: token.colorPrimary }}>
              {user?.name?.[0]?.toUpperCase() ?? 'A'}
            </Avatar>
            <span className="text-sm text-gray-700">{user?.name ?? user?.email ?? 'Admin'}</span>
          </Space>
        </Dropdown>
      </header>

      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
