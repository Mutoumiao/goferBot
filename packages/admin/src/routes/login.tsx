import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { Lock, Shield } from 'lucide-react'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { ROUTES_REGISTER } from '@/router-register'

export const Route = createFileRoute('/login')({
  component: LoginPage,
  staticData: {
    meta: ROUTES_REGISTER.login,
  },
})

function LoginPage() {
  const search = useSearch({ strict: false }) as { redirect?: string }
  void search
  useNavigate

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
      }}
    >
      <div className="absolute left-10 top-10 flex items-center gap-3 text-white">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
          <Shield size={28} />
        </div>
        <div>
          <div className="text-xl font-bold">GoferBot</div>
          <div className="text-sm text-white/70">Admin Console</div>
        </div>
      </div>

      <div className="w-[440px] rounded-2xl bg-white p-10 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
            <Lock size={28} />
          </div>
          <h1 className="m-0 text-2xl font-bold text-slate-900">管理员登录</h1>
          <p className="mt-2 text-sm text-slate-500">请使用管理员账号登录</p>
        </div>

        <LoginForm />
      </div>

      <div className="absolute bottom-6 w-full text-center text-sm text-white/60">
        © {new Date().getFullYear()} GoferBot. All rights reserved.
      </div>
    </div>
  )
}
