import { useState, useCallback } from 'react'
import { useAuthStore } from '@/stores/auth'
import { Avatar } from '@/features/auth/components/Avatar'
import { updateProfile, logoutUser } from '@/features/auth/services'
import { ChevronRight, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { openDialog } from '@/overlays/services/overlay-service'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpenAvatarDialog = useCallback(async () => {
    if (!user) return
    const EditAvatarDialog = (await import('@/overlays/dialogs/EditAvatarDialog')).default
    const file = await openDialog<File | undefined>(EditAvatarDialog, {
      currentAvatar: user.avatarUrl,
    })
    if (file) {
      setIsSubmitting(true)
      const result = await updateProfile({ avatarFile: file })
      setIsSubmitting(false)
      if (!result.success) {
        toast.error(result.error ?? '头像更新失败')
      }
    }
  }, [user])

  const handleOpenNameDialog = useCallback(async () => {
    if (!user) return
    const EditNameDialog = (await import('@/overlays/dialogs/EditNameDialog')).default
    const newName = await openDialog<string | undefined>(EditNameDialog, {
      currentName: user.name ?? '',
    })
    if (newName && newName !== user.name) {
      setIsSubmitting(true)
      const result = await updateProfile({ name: newName })
      setIsSubmitting(false)
      if (!result.success) {
        toast.error(result.error ?? '用户名更新失败')
      }
    }
  }, [user])

  const handleLogout = () => {
    logoutUser()
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[#5E6673]">加载中...</p>
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-[#F7F8FA]">
      <div className="mx-auto max-w-[920px] px-10 py-10">
        {/* 页面标题 */}
        <h1 className="mb-8 text-[28px] font-semibold text-[#1F2328]">基础信息</h1>

        <div className="space-y-8">
          {/* ====== 基础信息卡片 ====== */}
          <section>
            <div className="rounded-xl border border-[#E7EAF0] bg-white">
              {/* 头像行 */}
              <button
                type="button"
                className="flex h-20 w-full cursor-pointer items-center justify-between px-4 transition-colors hover:bg-[#F7F8FA]"
                onClick={handleOpenAvatarDialog}
                disabled={isSubmitting}
              >
                <span className="text-[15px] text-[#1F2328]">头像</span>
                <div className="flex items-center gap-3">
                  <Avatar src={user.avatarUrl} fallback={user.name} size={52} className="rounded-[10px]" />
                  <ChevronRight className="h-[18px] w-[18px] text-[#9AA3AF]" />
                </div>
              </button>

              {/* 分割线 */}
              <div className="h-px bg-[#E7EAF0]" />

              {/* 用户名行 */}
              <button
                type="button"
                className="flex h-[66px] w-full cursor-pointer items-center justify-between px-4 transition-colors hover:bg-[#F7F8FA]"
                onClick={handleOpenNameDialog}
                disabled={isSubmitting}
              >
                <span className="text-[15px] text-[#1F2328]">用户名</span>
                <div className="flex items-center gap-3">
                  <span className="text-[14px] text-[#5E6673]">{user.name ?? '—'}</span>
                  <ChevronRight className="h-[18px] w-[18px] text-[#9AA3AF]" />
                </div>
              </button>
            </div>
          </section>

          {/* ====== 账号安全 ====== */}
          <section>
            <h2 className="mb-2 text-[13px] font-medium text-[#9AA3AF]">账号安全</h2>
            <div className="rounded-xl border border-[#E7EAF0] bg-white">
              <button
                type="button"
                className="flex h-14 w-full cursor-pointer items-center justify-center rounded-xl text-[15px] font-medium text-[#DC3545] transition-colors hover:bg-[#FBEFEE]"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
