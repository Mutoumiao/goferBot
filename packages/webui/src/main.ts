import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { useAuthStore } from './stores/auth'
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// 初始化 auth store（恢复 localStorage token），在路由守卫前执行
const authStore = useAuthStore()
authStore.init()

app.use(router)
app.mount('#app')
