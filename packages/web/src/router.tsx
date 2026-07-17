import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import type { RouteMeta } from './router-register'
import { routeTree } from './routeTree.gen'

export const router = createTanStackRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreload: false,
  defaultPreloadStaleTime: 0,
})

export function getRouter() {
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }

  interface StaticDataRouteOption {
    /** 路由元数据（Rail / 标题等） */
    meta?: RouteMeta
    /** 一级页 Keep-Alive（D4 自研 route-keepalive） */
    keepAlive?: boolean
  }
}
