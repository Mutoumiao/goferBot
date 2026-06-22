import { ProLayout } from '@ant-design/pro-components'
import { Avatar, Dropdown, Space, theme as antdTheme } from 'antd'
import { LogOut, User as UserIcon, Settings as SettingsIcon, Bell } from 'lucide-react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { MenuItemType } from 'antd/es/menu/interface'
import { ROUTES_REGISTER } from '@/router-register'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { useMenuConfig } from './MenuConfig'

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const setAppearance = useSettingsStore((s) => s.setAppearance)
  const { token } = antdTheme.useToken()
  const [collapsed, setCollapsed] = useState(false)

  const navItems = useMenuConfig()

  const menuItems: MenuItemType[] = navItems.map((item) => ({
    key: item.path,
    icon: item.icon ? (() => {
      const Icon = item.icon
      return <Icon size={16} />
    })() : undefined,
    label: item.title,
  }))

  return (
    <ProLayout
      className="admin-layout"
      title="GoferBot Admin"
      token={{
        colorPrimary: token.colorPrimary,
      }}
      menuItemRender={(item, defaultDom) => {
        return (
          <a
            onClick={(e) => {
              e.preventDefault()
              navigate({ to: item.key as string })
            }}
          >
            {defaultDom}
          </a>
        )
      }}
      menuDataRender={() => menuItems as any}
      location={{ pathname: router.state.location.pathname as string }}
      collapsed={collapsed}
      onCollapse={setCollapsed}
      menuHeaderRender={() => (
        <div className="flex items-center gap-2 px-2 py-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold"
          >
            G
          </div>
          {!collapsed && (
            <span className="text-base font-semibold text-white">GoferBot Admin</span>
          )}
        </div>
      )}
      rightContentRender={() => (
        <div className="flex items-center gap-3 px-4">
          <span className="cursor-pointer rounded-md p-2 hover:bg-black/50 text-slate-200">
            <Bell size={16} />
          </span>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'profile',
                  icon: <UserIcon size={14} />,
                  label: '个人中心',
                  onClick: () => navigate({ to: ROUTES_REGISTER.profile.path }),
                },
                {
                  key: 'appearance',
                  icon: <SettingsIcon size={14} />,
                  label: '切换主题',
                  children: [
                    { key: 'light', label: '浅色模式', onClick: () => setAppearance('light') },
                    { key: 'dark', label: '深色模式', onClick: () => setAppearance('dark') },
                  ],
                },
                { type: 'divider' },
                {
                  key: 'logout',
                  icon: <LogOut size={14} />,
                  label: '退出登录',
                  danger: true,
                  onClick: () => clearAuth(),
                },
              ],
            }}
            placement="bottomRight"
          >
            <Space className="cursor-pointer rounded-md px-2 py-1 hover:bg-black/50">
              <Avatar
                size="small"
                style={{ backgroundColor: token.colorPrimary }}
              >
                {user?.name?.[0]?.toUpperCase() ?? 'A'}
              </Avatar>
              <span className="text-sm text-slate-200">
                {user?.name ?? user?.email ?? 'Admin'}
              </span>
            </Space>
          </Dropdown>
        </div>
      )}
      breadcrumbRender={(routers = []) =>
        [
          { path: '/', breadcrumbName: '首页' },
          ...routers,
        ] as any
      }
    >
      {children}
    </ProLayout>
  )
}
