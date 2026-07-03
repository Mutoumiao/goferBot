import { useCallback, useMemo, useState } from 'react'
import { ProLayout } from '@ant-design/pro-components'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { Avatar, theme as antdTheme, Dropdown, Space, Button } from 'antd'
import type { MenuItemType } from 'antd/es/menu/interface'
import { Bell, LogOut, Settings as SettingsIcon, User as UserIcon, ChevronDown } from 'lucide-react'
import { ROUTES_REGISTER } from '@/router-register'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'
import { logoutService } from '@/features/auth/services'
import { useMenuConfig } from './MenuConfig'

const SIDEBAR_HIDDEN_ROUTES = ['/change-password']

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const setAppearance = useSettingsStore((s) => s.setAppearance)
  const { token } = antdTheme.useToken()
  const [collapsed, setCollapsed] = useState(false)

  const navItems = useMenuConfig()

  const currentPath = router.state.location.pathname as string
  const hideSidebar = SIDEBAR_HIDDEN_ROUTES.includes(currentPath)

  const menuItems = useMemo<MenuItemType[]>(
    () =>
      navItems.map((item) => ({
        key: item.path,
        icon: item.icon
          ? (() => {
              const Icon = item.icon
              return <Icon size={16} />
            })()
          : undefined,
        label: item.title,
      })),
    [navItems],
  )

  const proLayoutToken = useMemo(
    () => ({
      colorPrimary: token.colorPrimary,
      colorBgContainer: '#ffffff',
      colorBgLayout: '#f0f2f5',
      colorBgHeader: '#ffffff',
      colorText: '#1a1a2e',
      colorTextSecondary: '#6c757d',
      colorBorder: '#e5e7eb',
      borderRadius: 8,
    }),
    [token.colorPrimary],
  )

  const location = useMemo(
    () => ({ pathname: currentPath }),
    [currentPath],
  )

  const menuItemRender = useCallback(
    (item: { key?: string }, defaultDom: React.ReactNode) => {
      if (!item.key) return defaultDom
      return (
        <a
          onClick={(e) => {
            e.preventDefault()
            navigate({ to: item.key })
          }}
        >
          {defaultDom}
        </a>
      )
    },
    [navigate],
  )

  const menuDataRender = useCallback(() => menuItems as any, [menuItems])

  const menuHeaderRender = useCallback(() => {
    return null
  }, [])

  const rightContentRender = useCallback(() => {
    if (hideSidebar) {
      return (
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
          <Space className="cursor-pointer flex items-center gap-1 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors">
            <Avatar size="small" style={{ backgroundColor: token.colorPrimary }}>
              {user?.name?.[0]?.toUpperCase() ?? 'A'}
            </Avatar>
            <span className="text-sm text-gray-700 font-medium">
              {user?.name ?? user?.email ?? 'Admin'}
            </span>
            <ChevronDown size={14} className="text-gray-400" />
          </Space>
        </Dropdown>
      )
    }

    return (
      <div className="flex items-center gap-2 px-4">
        <Button
          type="text"
          icon={<Bell size={16} />}
          className="rounded-md hover:bg-gray-100 text-gray-600"
        />

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
                onClick: () => logoutService(),
              },
            ],
          }}
          placement="bottomRight"
        >
          <Space className="cursor-pointer flex items-center gap-1 px-3 py-2 rounded-md hover:bg-gray-100 transition-colors">
            <Avatar size="small" style={{ backgroundColor: token.colorPrimary }}>
              {user?.name?.[0]?.toUpperCase() ?? 'A'}
            </Avatar>
            <span className="text-sm text-gray-700 font-medium">
              {user?.name ?? user?.email ?? 'Admin'}
            </span>
            <ChevronDown size={14} className="text-gray-400" />
          </Space>
        </Dropdown>
      </div>
    )
  }, [navigate, setAppearance, token.colorPrimary, user, hideSidebar])

  const breadcrumbRender = useCallback(
    (routers: { path?: string; breadcrumbName?: string }[] = []) => {
      return [{ path: '/', breadcrumbName: '首页' }, ...routers] as any
    },
    [],
  )

  return (
    <ProLayout
      className="admin-layout"
      title="GoferBot Admin"
      token={proLayoutToken}
      menuItemRender={menuItemRender}
      menuDataRender={hideSidebar ? () => [] : menuDataRender}
      location={location}
      collapsed={hideSidebar || collapsed}
      onCollapse={setCollapsed}
      menuHeaderRender={hideSidebar ? () => null : menuHeaderRender}
      actionsRender={rightContentRender}
      breadcrumbRender={breadcrumbRender}
      layout="mix"
      fixedHeader
      headerTitleRender={() => (
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold">
            G
          </div>
          <span className="text-base font-semibold text-gray-800">GoferBot Admin</span>
        </div>
      )}
      menuRender={hideSidebar ? false : undefined}
      {...(hideSidebar ? { siderWidth: 0 } : {})}
    >
      {children}
    </ProLayout>
  )
}