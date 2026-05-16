import { createRouter, createWebHistory } from 'vue-router'
import ChatPage from '@/components/ChatPage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'chat', component: ChatPage },
    { path: '/knowledge-base', name: 'knowledgeBase', component: () => import('@/components/KnowledgeBasePage.vue') },
    { path: '/history', name: 'history', component: () => import('@/components/HistoryPage.vue') },
    { path: '/settings', name: 'settings', component: () => import('@/components/SettingsPage.vue') },
    { path: '/recycle-bin', name: 'recycleBin', component: () => import('@/components/RecycleBinPage.vue') },
  ],
})

export default router
