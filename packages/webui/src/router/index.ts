import { createRouter, createWebHistory } from 'vue-router'
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

export default router
