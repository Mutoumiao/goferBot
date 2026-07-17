import { useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { matchKeepAliveKey } from '@/lib/route-keepalive'
import { cn } from '@/utils/cn'

/** 设置类：透明底 + 居中内容，不套业务白卡 */
const PLAIN_SURFACE_KEYS = new Set(['settings', 'profile', 'recycle'])

function isPlainSurface(pathname: string): boolean {
  const key = matchKeepAliveKey(pathname)
  if (key && PLAIN_SURFACE_KEYS.has(key)) return true
  // 非 keep-alive 子路径若落在设置域也走 plain（预留）
  return (
    pathname === '/settings' ||
    pathname.startsWith('/settings/') ||
    pathname === '/profile' ||
    pathname.startsWith('/profile/') ||
    pathname === '/recycle' ||
    pathname.startsWith('/recycle/')
  )
}

/**
 * 右侧舞台：#F0F2F7 + padding，业务路由再套一层圆角内阴影白卡。
 */
export function WorkspaceStage({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const plain = isPlainSurface(pathname)

  return (
    <div
      className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas pt-[10px] pr-[10px] pb-[10px] pl-[5px]"
      data-testid="workspace-stage"
    >
      <main
        className={cn(
          'min-h-0 flex-1 overflow-hidden',
          plain ? 'bg-transparent' : 'gofer-workspace-card',
        )}
        data-testid={plain ? 'workspace-plain' : 'workspace-card'}
        data-surface={plain ? 'plain' : 'card'}
      >
        {children}
      </main>
    </div>
  )
}
