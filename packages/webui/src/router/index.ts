import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { TabType } from '@/types'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    singleton?: boolean
    tabType?: TabType
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: { name: 'chat' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
    },
    {
      path: '/app',
      component: () => import('@/layouts/AuthenticatedLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: { name: 'chat' },
        },
        {
          path: 'chat',
          name: 'chat',
          component: () => import('@/views/ChatView.vue'),
          meta: { singleton: false, tabType: 'chat' },
        },
        {
          path: 'knowledge-base',
          name: 'knowledgeBase',
          component: () => import('@/components/KnowledgeBasePage.vue'),
          meta: { singleton: true, tabType: 'knowledgeBase' },
        },
        {
          path: 'history',
          name: 'history',
          component: () => import('@/components/HistoryPage.vue'),
          meta: { singleton: true, tabType: 'history' },
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/components/SettingsPage.vue'),
          meta: { singleton: true, tabType: 'settings' },
        },
        {
          path: 'recycle-bin',
          name: 'recycleBin',
          component: () => import('@/components/RecycleBinPage.vue'),
          meta: { singleton: true, tabType: 'recycleBin' },
        },
      ],
    },
  ],
})

router.beforeEach((to, _from) => {
  const authStore = useAuthStore()

  // 已认证用户访问登录/注册 → 重定向到功能页
  if ((to.path === '/login' || to.path === '/register') && authStore.isAuthenticated) {
    return { name: 'chat' }
  }

  // 未认证用户访问需认证路由 → 重定向到登录页
  if (to.matched.some((r) => r.meta.requiresAuth) && !authStore.isAuthenticated) {
    return { name: 'login' }
  }
})

export default router
