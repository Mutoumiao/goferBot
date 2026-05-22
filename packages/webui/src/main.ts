import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import { useOverlayHost } from './overlays/host/useOverlayHost'
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// 初始化 auth store（恢复 token + 验证有效性），必须在路由注册前完成
// await 确保 isAuthenticated 反映的是真实鉴权状态，消除刷新时侧栏闪烁
const authStore = useAuthStore()
await authStore.init()

app.use(router)

// 路由切换时清理所有 overlay
router.beforeEach(() => {
  const { clearOverlays } = useOverlayHost()
  clearOverlays()
})

// 页面刷新/关闭时清理所有 overlay
window.addEventListener('beforeunload', () => {
  const { clearOverlays } = useOverlayHost()
  clearOverlays()
})

app.mount('#app')
