import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ChatPage from '@/components/ChatPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'chat',
      component: ChatPage,
      meta: { requiresAuth: true },
    },
    {
      path: '/knowledge-base',
      name: 'knowledgeBase',
      component: () => import('@/components/KnowledgeBasePage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('@/components/HistoryPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/components/SettingsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/recycle-bin',
      name: 'recycleBin',
      component: () => import('@/components/RecycleBinPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { hideSidebar: true, requiresAuth: false },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { hideSidebar: true, requiresAuth: false },
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const authStore = useAuthStore()
  const isAuthenticated = authStore.isAuthenticated

  if ((to.path === '/login' || to.path === '/register') && isAuthenticated) {
    next('/')
    return
  }

  if (to.meta.requiresAuth && !isAuthenticated) {
    next('/login')
    return
  }

  next()
})

export default router
