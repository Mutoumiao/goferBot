import { ChevronRight, LogOut } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { SettingsSurface } from '@/components/layout/SettingsSurface'
import { Avatar } from '@/features/auth/components/Avatar'
import { logoutUser, updateProfile } from '@/features/auth/services'
import { openDialog } from '@/overlays/services/overlay-service'
import { useAuthStore } from '@/stores/auth'

export function ProfilePage() {
  const user = useAuthStore((s) => s.user)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleOpenAvatarDialog = useCallback(async () => {
    if (!user) return
    const EditAvatarDialog = (await import('@/overlays/dialogs/EditAvatarDialog')).default
    const file = await openDialog<File | undefined>(EditAvatarDialog, {
      currentAvatar: user.avatar ?? undefined,
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
    <SettingsSurface testId="profile-page">
      <h1 className="mb-8 text-[28px] font-semibold text-text-primary">基础信息</h1>

      <div className="space-y-8">
        <section>
          <div className="rounded-xl border border-border-panel bg-surface-1">
            <button
              type="button"
              className="flex h-20 w-full cursor-pointer items-center justify-between px-4 transition-colors hover:bg-surface-2"
              onClick={handleOpenAvatarDialog}
              disabled={isSubmitting}
            >
              <span className="text-[15px] text-text-primary">头像</span>
              <div className="flex items-center gap-3">
                <Avatar
                  src={user.avatar ?? undefined}
                  fallback={user.name ?? undefined}
                  size={52}
                  className="rounded-[10px]"
                />
                <ChevronRight className="h-[18px] w-[18px] text-text-tertiary" />
              </div>
            </button>

            <div className="h-px bg-border-panel" />

            <button
              type="button"
              className="flex h-[66px] w-full cursor-pointer items-center justify-between px-4 transition-colors hover:bg-surface-2"
              onClick={handleOpenNameDialog}
              disabled={isSubmitting}
            >
              <span className="text-[15px] text-text-primary">用户名</span>
              <div className="flex items-center gap-3">
                <span className="text-[14px] text-text-secondary">{user.name ?? '—'}</span>
                <ChevronRight className="h-[18px] w-[18px] text-text-tertiary" />
              </div>
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-[13px] font-medium text-text-tertiary">账号安全</h2>
          <div className="rounded-xl border border-border-panel bg-surface-1">
            <button
              type="button"
              className="flex h-14 w-full cursor-pointer items-center justify-center rounded-xl text-[15px] font-medium text-error transition-colors hover:bg-error/5"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </button>
          </div>
        </section>
      </div>
    </SettingsSurface>
  )
}
