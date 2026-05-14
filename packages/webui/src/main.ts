import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import './assets/main.css'

// 独立 Vue Devtools 仅在 Tauri 模式下通过 dev:tauri 启动时连接
// 浏览器模式使用 vite-plugin-vue-devtools（按 Alt+Shift+D toggle）
if (process.env.NODE_ENV === 'development' && '__TAURI_INTERNALS__' in window) {
  import('@vue/devtools').then(({ devtools }) => {
    devtools.connect('http://localhost', 8098)
  })
}
const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
