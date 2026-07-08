import { createFileRoute, redirect, useNavigate, useSearch } from '@tanstack/react-router'
import { ConfigProvider, theme } from 'antd'
import { Activity, ArrowRight, Server, Shield, ShieldCheck, Zap } from 'lucide-react'
import { useMemo } from 'react'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { ROUTES_REGISTER } from '@/router-register'
import { getAuthSnapshot, waitForAuthInit } from '@/utils/auth-guard'

export const Route = createFileRoute('/login')({
  beforeLoad: async () => {
    await waitForAuthInit()
    const snapshot = getAuthSnapshot()
    if (snapshot.isAuthenticated) {
      throw redirect({ to: ROUTES_REGISTER.dashboard.path })
    }
  },
  component: LoginPage,
  staticData: {
    meta: ROUTES_REGISTER.login,
  },
})

// 背景点阵图案（CSS 变量控制，避免硬编码）
const dotGridStyle = {
  backgroundImage: `radial-gradient(circle, rgba(212,168,83,0.08) 1px, transparent 1px)`,
  backgroundSize: '24px 24px',
} as const

function SecurityVisual() {
  // 使用纯 CSS 实现的脉冲环动画
  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
      {/* 外圈脉冲 */}
      <div className="animate-pulse absolute inset-0 rounded-full border border-amber-500/10" />
      <div
        className="absolute rounded-full border border-amber-500/10"
        style={{
          width: '85%',
          height: '85%',
          animation: 'pulse-ring 3s ease-out infinite',
          animationDelay: '0.5s',
        }}
      />
      <div
        className="absolute rounded-full border border-amber-500/10"
        style={{
          width: '70%',
          height: '70%',
          animation: 'pulse-ring 3s ease-out infinite',
          animationDelay: '1s',
        }}
      />
      {/* 中心图标 */}
      <div
        className="relative z-10 flex items-center justify-center rounded-full"
        style={{
          width: 80,
          height: 80,
          background: 'linear-gradient(135deg, rgba(200,141,47,0.2) 0%, rgba(212,168,83,0.1) 100%)',
          border: '1px solid rgba(212,168,83,0.3)',
          boxShadow: '0 0 40px rgba(212,168,83,0.15), inset 0 0 20px rgba(212,168,83,0.05)',
        }}
      >
        <ShieldCheck size={36} className="text-amber-400" />
      </div>
    </div>
  )
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div
      className="flex items-start gap-4 rounded-xl p-4 transition-colors hover:bg-white/3"
      style={{ animation: 'fadeInUp 0.6s ease-out both' }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: 'rgba(212,168,83,0.08)',
          border: '1px solid rgba(212,168,83,0.12)',
        }}
      >
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
    </div>
  )
}

// 装饰性几何线条
function DecorativeLines() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* 左上角斜线 */}
      <div
        className="absolute left-0 top-0 opacity-[0.03]"
        style={{
          width: 400,
          height: 400,
          background: `
            linear-gradient(135deg, transparent 49.5%, rgba(212,168,83,1) 49.5%, rgba(212,168,83,1) 50.5%, transparent 50.5%),
            linear-gradient(135deg, transparent 48.5%, rgba(212,168,83,0.5) 48.5%, rgba(212,168,83,0.5) 51.5%, transparent 51.5%)
          `,
        }}
      />
      {/* 右下角斜线 */}
      <div
        className="absolute bottom-0 right-0 opacity-[0.03]"
        style={{
          width: 300,
          height: 300,
          background: `
            linear-gradient(315deg, transparent 49.5%, rgba(212,168,83,1) 49.5%, rgba(212,168,83,1) 50.5%, transparent 50.5%)
          `,
        }}
      />
    </div>
  )
}

function LoginPage() {
  const search = useSearch({ strict: false }) as { redirect?: string }
  void search
  useNavigate

  // 底部版权年份
  const year = useMemo(() => new Date().getFullYear(), [])

  return (
    <>
      {/* 入场动画样式 */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div
        className="relative flex min-h-screen overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #090d15 0%, #121827 40%, #0f141f 100%)',
        }}
      >
        <DecorativeLines />

        {/* 点阵背景 */}
        <div className="absolute inset-0 pointer-events-none" style={dotGridStyle} />

        {/* ====== 左侧品牌区域 ====== */}
        <div className="relative z-10 hidden flex-1 flex-col justify-between p-12 lg:flex xl:p-16">
          {/* 顶部 Logo */}
          <div style={{ animation: 'fadeIn 0.8s ease-out both' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{
                  background: 'linear-gradient(135deg, #c88d2f 0%, #d4a853 100%)',
                  boxShadow: '0 4px 20px rgba(212,168,83,0.3)',
                }}
              >
                <Shield size={20} className="text-white" />
              </div>
              <div>
                <div className="text-xl font-bold text-white tracking-tight">GoferBot</div>
                <div className="text-xs text-amber-400/70 tracking-wider">ADMIN CONSOLE</div>
              </div>
            </div>
          </div>

          {/* 中间视觉元素 + 功能介绍 */}
          <div className="flex flex-col items-start gap-12">
            {/* 安全视觉 */}
            <div style={{ animation: 'fadeInUp 0.8s ease-out 0.2s both' }}>
              <SecurityVisual />
            </div>

            {/* 功能介绍 */}
            <div className="space-y-2">
              <FeatureItem
                icon={<Server size={18} className="text-amber-400/80" />}
                title="系统监控"
                description="实时掌握服务器状态、性能指标与资源使用情况"
              />
              <FeatureItem
                icon={<Activity size={18} className="text-amber-400/80" />}
                title="用户管理"
                description="统一管理后台用户、权限分配与访问控制策略"
              />
              <FeatureItem
                icon={<Zap size={18} className="text-amber-400/80" />}
                title="安全审计"
                description="完整的操作日志追踪，确保每一次操作可溯源"
              />
            </div>
          </div>

          {/* 底部版权 */}
          <div
            className="text-xs text-slate-600"
            style={{ animation: 'fadeIn 1s ease-out 0.6s both' }}
          >
            &copy; {year} GoferBot. All rights reserved.
          </div>
        </div>

        {/* ====== 右侧登录卡片 ====== */}
        <div
          className="relative z-10 flex w-full flex-col items-center justify-center px-6 lg:w-[540px] lg:px-0"
          style={{ animation: 'slideInRight 0.6s ease-out 0.1s both' }}
        >
          {/* 移动端 Logo */}
          <div className="mb-8 flex flex-col items-center gap-2 lg:hidden">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{
                background: 'linear-gradient(135deg, #c88d2f 0%, #d4a853 100%)',
                boxShadow: '0 4px 24px rgba(212,168,83,0.4)',
              }}
            >
              <Shield size={24} className="text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-white">GoferBot</div>
              <div className="text-[10px] text-amber-400/60 tracking-wider">ADMIN CONSOLE</div>
            </div>
          </div>

          {/* 玻璃拟态卡片 */}
          <div
            className="w-full max-w-[420px] rounded-2xl p-8 lg:p-10"
            style={{
              background: 'rgba(255,255,255,0.03)',
              backdropFilter: 'blur(40px)',
              WebkitBackdropFilter: 'blur(40px)',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            {/* 卡片头部 */}
            <div className="mb-8 text-center">
              <div
                className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
                style={{
                  background: 'rgba(212,168,83,0.08)',
                  border: '1px solid rgba(212,168,83,0.15)',
                }}
              >
                <ShieldCheck size={26} className="text-amber-400" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">管理员登录</h1>
              <p className="mt-2 text-sm text-slate-500">请使用管理员账号登录后台系统</p>
            </div>

            {/* 登录表单 - 暗色主题 ConfigProvider 让 antd 组件适配深色背景 */}
            <ConfigProvider
              theme={{
                algorithm: theme.darkAlgorithm,
                token: {
                  colorPrimary: '#d4a853',
                  borderRadius: 8,
                  colorBgContainer: 'rgba(255,255,255,0.06)',
                  colorBorder: 'rgba(255,255,255,0.1)',
                  colorText: '#e2e8f0',
                  colorTextPlaceholder: '#64748b',
                  colorBgElevated: '#1e293b',
                },
              }}
            >
              <LoginForm />
            </ConfigProvider>

            {/* 底部提示 */}
            <p className="mt-6 text-center text-xs text-slate-600">
              安全连接 &middot; 数据加密传输
            </p>
          </div>

          {/* 移动端底部版权 */}
          <div className="mt-8 text-xs text-slate-600 lg:hidden">&copy; {year} GoferBot</div>
        </div>

        {/* 右下角装饰 - 箭头暗示 */}
        <div
          className="absolute bottom-8 right-8 hidden opacity-20 lg:flex items-center gap-2 text-xs text-slate-500"
          aria-hidden="true"
        >
          <ArrowRight size={14} />
          <span>安全登录入口</span>
        </div>
      </div>
    </>
  )
}
