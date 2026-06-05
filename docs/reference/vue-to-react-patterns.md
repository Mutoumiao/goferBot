# Vue 3 到 React 代码模式对照

> 用于 GoferBot 前端迁移参考，覆盖常用 Vue 模式及其 React 等价写法。
> 整理日期：2026-06-05

---

## 1. 组件基础

### 1.1 单文件组件

**Vue（SFC）**
```vue
<script setup lang="ts">
import { ref } from 'vue'
const count = ref(0)
</script>

<template>
  <button @click="count++">{{ count }}</button>
</template>

<style scoped>
button { color: blue; }
</style>
```

**React（TSX）**
```tsx
import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button
      onClick={() => setCount(c => c + 1)}
      className="text-blue-600"
    >
      {count}
    </button>
  )
}
```

---

### 1.2 Props 定义

**Vue**
```vue
<script setup lang="ts">
interface Props {
  title: string
  disabled?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})
</script>
```

**React**
```tsx
interface ButtonProps {
  title: string
  disabled?: boolean
}

export function Button({ title, disabled = false }: ButtonProps) {
  return <button disabled={disabled}>{title}</button>
}
```

---

### 1.3 Emits / 回调

**Vue**
```vue
<script setup lang="ts">
const emit = defineEmits<{
  click: [id: string]
  update: [value: string]
}>()

function handleClick() {
  emit('click', 'item-1')
}
</script>
```

**React**
```tsx
interface ItemProps {
  onClick: (id: string) => void
  onUpdate: (value: string) => void
}

export function Item({ onClick, onUpdate }: ItemProps) {
  function handleClick() {
    onClick('item-1')
  }
  return <button onClick={handleClick}>Click</button>
}
```

---

## 2. 响应式系统

### 2.1 ref → useState

**Vue**
```ts
const count = ref(0)
const user = ref<User | null>(null)

// 读取
console.log(count.value)

// 修改
count.value++
user.value = { name: 'Alice' }
```

**React**
```ts
const [count, setCount] = useState(0)
const [user, setUser] = useState<User | null>(null)

// 读取
console.log(count)

// 修改
setCount(c => c + 1)
setUser({ name: 'Alice' })
```

**关键差异**：
- Vue 的 `ref` 是容器对象，读取需 `.value`
- React 的 `useState` 直接返回值，修改需通过 `setXxx`
- React 的 `setState` 不会自动合并对象（需手动展开）

---

### 2.2 reactive → useState

**Vue**
```ts
const state = reactive({
  name: 'Alice',
  age: 25,
})

state.age++  // 直接修改
```

**React**
```ts
const [state, setState] = useState({
  name: 'Alice',
  age: 25,
})

// 必须整体替换
setState(prev => ({ ...prev, age: prev.age + 1 }))
```

**替代方案（Zustand）**
```ts
const useStore = create<State>(set => ({
  name: 'Alice',
  age: 25,
  incrementAge: () => set(state => ({ age: state.age + 1 })),
}))
```

---

### 2.3 computed → useMemo

**Vue**
```ts
const firstName = ref('Alice')
const lastName = ref('Smith')

const fullName = computed(() => {
  return `${firstName.value} ${lastName.value}`
})
```

**React**
```ts
const [firstName, setFirstName] = useState('Alice')
const [lastName, setLastName] = useState('Smith')

const fullName = useMemo(() => {
  return `${firstName} ${lastName}`
}, [firstName, lastName])
```

---

## 3. 生命周期

### 3.1 onMounted / onUnmounted

**Vue**
```ts
import { onMounted, onUnmounted } from 'vue'

onMounted(() => {
  console.log('mounted')
  const timer = setInterval(() => {}, 1000)
  
  onUnmounted(() => {
    clearInterval(timer)
  })
})
```

**React**
```ts
import { useEffect } from 'react'

useEffect(() => {
  console.log('mounted')
  const timer = setInterval(() => {}, 1000)
  
  return () => {
    clearInterval(timer)  // cleanup
  }
}, [])  // 空依赖 = 只执行一次
```

---

### 3.2 watch → useEffect

**Vue**
```ts
import { watch, ref } from 'vue'

const search = ref('')

watch(search, (newVal, oldVal) => {
  console.log('changed:', oldVal, '->', newVal)
  fetchResults(newVal)
})

// 多值监听
watch([search, page], ([newSearch, newPage]) => {
  fetchResults(newSearch, newPage)
})
```

**React**
```ts
import { useEffect, useState } from 'react'

const [search, setSearch] = useState('')

useEffect(() => {
  console.log('changed:', search)
  fetchResults(search)
}, [search])  // 依赖数组

// 多值监听
const [page, setPage] = useState(1)

useEffect(() => {
  fetchResults(search, page)
}, [search, page])
```

**关键差异**：
- Vue 的 `watch` 自动追踪依赖
- React 的 `useEffect` 需手动声明依赖数组
- 忘记添加依赖是 React 常见 bug

---

### 3.3 watchEffect → useEffect

**Vue**
```ts
watchEffect(() => {
  console.log(search.value)
  console.log(page.value)
})
```

**React**
```ts
useEffect(() => {
  console.log(search)
  console.log(page)
})
// 无依赖数组 = 每次渲染都执行
```

---

## 4. 模板语法

### 4.1 条件渲染

**Vue**
```vue
<template>
  <div v-if="isAdmin">Admin Panel</div>
  <div v-else-if="isUser">User Panel</div>
  <div v-else>Guest</div>
  
  <div v-show="isVisible">Hidden but in DOM</div>
</template>
```

**React**
```tsx
export function Panel({ isAdmin, isUser, isVisible }: Props) {
  return (
    <>
      {isAdmin ? (
        <div>Admin Panel</div>
      ) : isUser ? (
        <div>User Panel</div>
      ) : (
        <div>Guest</div>
      )}
      
      <div style={{ display: isVisible ? 'block' : 'none' }}>
        Hidden but in DOM
      </div>
    </>
  )
}
```

---

### 4.2 列表渲染

**Vue**
```vue
<template>
  <ul>
    <li v-for="item in items" :key="item.id">
      {{ item.name }}
    </li>
  </ul>
</template>
```

**React**
```tsx
export function ItemList({ items }: { items: Item[] }) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  )
}
```

---

### 4.3 事件处理

**Vue**
```vue
<template>
  <button @click="handleClick">Click</button>
  <input @input="handleInput" @keydown.enter="handleSubmit">
</template>
```

**React**
```tsx
export function Form() {
  function handleClick() {}
  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    console.log(e.target.value)
  }
  function handleSubmit(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {}
  }
  
  return (
    <>
      <button onClick={handleClick}>Click</button>
      <input onChange={handleInput} onKeyDown={handleSubmit} />
    </>
  )
}
```

---

### 4.4 双向绑定

**Vue**
```vue
<template>
  <input v-model="search" />
  <input v-model.trim.number="age" />
  <CustomInput v-model="value" />
</template>
```

**React**
```tsx
export function SearchForm() {
  const [search, setSearch] = useState('')
  const [age, setAge] = useState(0)
  const [value, setValue] = useState('')
  
  return (
    <>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <input
        type="number"
        value={age}
        onChange={e => setAge(Number(e.target.value.trim()))}
      />
      <CustomInput value={value} onChange={setValue} />
    </>
  )
}

// CustomInput.tsx
interface CustomInputProps {
  value: string
  onChange: (value: string) => void
}

function CustomInput({ value, onChange }: CustomInputProps) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )
}
```

---

### 4.5 Class 绑定

**Vue**
```vue
<template>
  <div :class="{ active: isActive, 'text-danger': hasError }">
  <div :class="[classA, classB]">
  <div :class="[isActive ? activeClass : '', errorClass]">
</template>
```

**React**
```tsx
import { cn } from '@/lib/utils'

export function Box({ isActive, hasError }: Props) {
  return (
    <>
      <div className={cn(isActive && 'active', hasError && 'text-danger')}>
      <div className={cn(classA, classB)}>
      <div className={cn(isActive ? activeClass : '', errorClass)}>
    </>
  )
}
```

---

## 5. 插槽（Slots）

### 5.1 默认插槽

**Vue**
```vue
<!-- Card.vue -->
<template>
  <div class="card">
    <slot>默认内容</slot>
  </div>
</template>

<!-- 使用 -->
<Card>自定义内容</Card>
```

**React**
```tsx
// Card.tsx
interface CardProps {
  children?: React.ReactNode
}

export function Card({ children = '默认内容' }: CardProps) {
  return <div className="card">{children}</div>
}

// 使用
<Card>自定义内容</Card>
```

---

### 5.2 具名插槽

**Vue**
```vue
<!-- Layout.vue -->
<template>
  <header><slot name="header" /></header>
  <main><slot /></main>
  <footer><slot name="footer" /></footer>
</template>

<!-- 使用 -->
<Layout>
  <template #header>标题</template>
  <template #footer>页脚</template>
  主体内容
</Layout>
```

**React**
```tsx
// Layout.tsx
interface LayoutProps {
  header?: React.ReactNode
  footer?: React.ReactNode
  children?: React.ReactNode
}

export function Layout({ header, footer, children }: LayoutProps) {
  return (
    <>
      <header>{header}</header>
      <main>{children}</main>
      <footer>{footer}</footer>
    </>
  )
}

// 使用
<Layout
  header={<h1>标题</h1>}
  footer={<p>页脚</p>}
>
  主体内容
</Layout>
```

---

### 5.3 作用域插槽

**Vue**
```vue
<!-- List.vue -->
<template>
  <ul>
    <li v-for="item in items" :key="item.id">
      <slot :item="item" :index="index">
        {{ item.name }}
      </slot>
    </li>
  </ul>
</template>

<!-- 使用 -->
<List :items="items" v-slot="{ item, index }">
  {{ index }} - {{ item.name }}
</List>
```

**React**
```tsx
// List.tsx
interface ListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
}

export function List<T>({ items, renderItem }: ListProps<T>) {
  return (
    <ul>
      {items.map((item, index) => (
        <li key={(item as any).id}>
          {renderItem(item, index)}
        </li>
      ))}
    </ul>
  )
}

// 使用
<List
  items={items}
  renderItem={(item, index) => (
    <>{index} - {item.name}</>
  )}
/>
```

---

## 6. 依赖注入

### 6.1 Provide / Inject

**Vue**
```ts
// 父组件
import { provide, ref } from 'vue'
const theme = ref('dark')
provide('theme', theme)

// 子组件
import { inject } from 'vue'
const theme = inject('theme', ref('light'))
```

**React（Context）**
```tsx
// ThemeContext.tsx
const ThemeContext = createContext({ theme: 'dark', setTheme: (_: string) => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState('dark')
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

// 子组件
export function Child() {
  const { theme } = useTheme()
  return <div>{theme}</div>
}
```

---

## 7. 路由

### 7.1 路由守卫

**Vue**
```ts
// router/index.ts
router.beforeEach((to, from) => {
  const authStore = useAuthStore()
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    return { name: 'login' }
  }
})
```

**React（TanStack Router）**
```tsx
// routes/__root.tsx
export const Route = createRootRoute({
  beforeLoad: async () => {
    const user = await fetchUser()
    return { user }
  },
})

// routes/app/route.tsx
export const Route = createFileRoute('/app')({
  beforeLoad: async ({ context }) => {
    if (!context.user) {
      throw redirect({ to: '/login' })
    }
  },
})
```

---

### 7.2 路由参数

**Vue**
```vue
<script setup lang="ts">
import { useRoute } from 'vue-router'
const route = useRoute()
const id = route.params.id as string
const page = parseInt(route.query.page as string) || 1
</script>
```

**React（TanStack Router）**
```tsx
import { useParams, useSearch } from '@tanstack/react-router'

export function PostPage() {
  const { id } = useParams({ from: '/posts/$id' })
  const { page } = useSearch({ from: '/posts/$id' })
  return <div>{id} - {page || 1}</div>
}
```

---

### 7.3 编程式导航

**Vue**
```ts
import { useRouter } from 'vue-router'
const router = useRouter()

router.push('/home')
router.push({ name: 'user', params: { id: 1 } })
router.replace('/login')
router.back()
```

**React（TanStack Router）**
```tsx
import { useNavigate } from '@tanstack/react-router'

export function Component() {
  const navigate = useNavigate()
  
  navigate({ to: '/home' })
  navigate({ to: '/user/$id', params: { id: 1 } })
  navigate({ to: '/login', replace: true })
  navigate({ to: '..' })  // 返回
}
```

---

## 8. 状态管理（Pinia → Zustand）

### 8.1 Store 定义

**Vue（Pinia）**
```ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const isAuthenticated = computed(() => !!accessToken.value)
  
  function login(token: string) {
    accessToken.value = token
  }
  
  function logout() {
    accessToken.value = null
  }
  
  return { accessToken, isAuthenticated, login, logout }
})
```

**React（Zustand）**
```ts
import { create } from 'zustand'

interface AuthState {
  accessToken: string | null
  isAuthenticated: boolean
  login: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>(set => ({
  accessToken: null,
  isAuthenticated: false,
  login: (token) => set({ accessToken: token, isAuthenticated: true }),
  logout: () => set({ accessToken: null, isAuthenticated: false }),
}))
```

---

### 8.2 Store 使用

**Vue**
```vue
<script setup lang="ts">
const authStore = useAuthStore()

// 直接解构（需 storeToRefs 保持响应式）
import { storeToRefs } from 'pinia'
const { isAuthenticated } = storeToRefs(authStore)

// 调用 action
authStore.login('token')
</script>
```

**React**
```tsx
export function Component() {
  // 选择单个状态（自动优化重渲染）
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  
  // 或使用 selector（推荐）
  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)
  
  return (
    <button onClick={() => login('token')}>
      {isAuthenticated ? 'Logout' : 'Login'}
    </button>
  )
}
```

---

### 8.3 持久化（Pinia Plugin → Zustand Middleware）

**Vue**
```ts
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

const pinia = createPinia()
pinia.use(piniaPluginPersistedstate)
```

**React**
```ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      accessToken: null,
      login: (token) => set({ accessToken: token }),
      logout: () => set({ accessToken: null }),
    }),
    { name: 'auth-storage' }
  )
)
```

---

## 9. 样式

### 9.1 Scoped CSS

**Vue**
```vue
<style scoped>
.button { color: blue; }
/* 编译后：.button[data-v-f3f3eg9] { color: blue; } */
</style>
```

**React**
```tsx
// 方案 1：CSS Modules
import styles from './Button.module.css'
export function Button() {
  return <button className={styles.button}>Click</button>
}

// 方案 2：Tailwind（推荐）
export function Button() {
  return <button className="text-blue-600">Click</button>
}

// 方案 3：CSS-in-JS（如 styled-components）
const StyledButton = styled.button`
  color: blue;
`
```

---

### 9.2 深度选择器

**Vue**
```vue
<style scoped>
:deep(.child-class) { color: red; }
:global(.global-class) { color: green; }
</style>
```

**React**
```tsx
// Tailwind 方案：直接写全局样式或覆盖
// globals.css
.child-class { color: red; }

// 或使用 Tailwind @layer 在全局样式中定义
// globals.css
@layer components {
  .custom-parent .child-class { color: red; }
}

// 组件中使用
<div className="custom-parent">
  <ChildComponent />
</div>
```

---

## 10. 其他常用模式

### 10.1 Teleport → Portal

**Vue**
```vue
<template>
  <Teleport to="body">
    <div class="modal">Modal Content</div>
  </Teleport>
</template>
```

**React**
```tsx
import { createPortal } from 'react-dom'

export function Modal({ children }: { children: React.ReactNode }) {
  return createPortal(
    <div className="modal">{children}</div>,
    document.body
  )
}
```

---

### 10.2 Suspense

**Vue**
```vue
<template>
  <Suspense>
    <template #default>
      <AsyncComponent />
    </template>
    <template #fallback>
      <Loading />
    </template>
  </Suspense>
</template>
```

**React**
```tsx
import { Suspense, lazy } from 'react'

const AsyncComponent = lazy(() => import('./AsyncComponent'))

export function Page() {
  return (
    <Suspense fallback={<Loading />}>
      <AsyncComponent />
    </Suspense>
  )
}
```

---

### 10.3 KeepAlive

**Vue**
```vue
<template>
  <KeepAlive>
    <component :is="currentTab" />
  </KeepAlive>
</template>
```

**React**
```tsx
import { useState } from 'react'

// React 没有内置 KeepAlive，需手动实现或使用库
export function Tabs() {
  const [activeTab, setActiveTab] = useState('a')
  
  return (
    <>
      <button onClick={() => setActiveTab('a')}>Tab A</button>
      <button onClick={() => setActiveTab('b')}>Tab B</button>
      
      {activeTab === 'a' && <TabA />}
      {activeTab === 'b' && <TabB />}
      
      {/* 或使用 display 保持状态 */}
      <div style={{ display: activeTab === 'a' ? 'block' : 'none' }}>
        <TabA />
      </div>
      <div style={{ display: activeTab === 'b' ? 'block' : 'none' }}>
        <TabB />
      </div>
    </>
  )
}
```

---

## 11. 快速对照表

| Vue | React |
|-----|-------|
| `ref` | `useState` |
| `reactive` | `useState`（对象）或 Zustand |
| `computed` | `useMemo` |
| `watch` | `useEffect` |
| `onMounted` | `useEffect(() => {}, [])` |
| `onUnmounted` | `useEffect` 返回 cleanup 函数 |
| `v-if` | `condition ? <A /> : <B />` |
| `v-for` | `.map()` |
| `v-model` | `value` + `onChange` |
| `@click` | `onClick` |
| `:class` | `className` + `cn()` |
| `slot` | `children` prop |
| `provide/inject` | `createContext` + `useContext` |
| `<Teleport>` | `createPortal` |
| `<Suspense>` | `<Suspense>` |
| `<KeepAlive>` | 手动实现或第三方库 |
| `defineProps` | 接口/类型 + 解构参数 |
| `defineEmits` | 回调函数 props |
| `Pinia` | `Zustand` / `Jotai` |
| `Vue Router` | `TanStack Router` / `React Router` |

---

## 参考

- [Vue 3 官方文档](https://vuejs.org/guide/introduction.html)
- [React 官方文档](https://react.dev/learn)
- [Zustand 文档](https://docs.pmnd.rs/zustand)
- [TanStack Router 文档](https://tanstack.com/router/latest)
