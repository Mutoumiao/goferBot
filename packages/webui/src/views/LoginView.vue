<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAuthForm } from '@/composables/useAuthForm'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const form = useAuthForm()

const isLoading = computed(() => authStore.isLoading)

async function handleSubmit() {
  form.clearErrors()

  if (!form.validateAll()) {
    return
  }

  try {
    await authStore.login({
      email: form.email.value,
      password: form.password.value,
    })
    router.push('/')
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    if (err.includes('401') || err.includes('邮箱或密码错误')) {
      form.setGeneralError('邮箱或密码错误')
    } else if (err.includes('NetworkError') || err.includes('fetch')) {
      form.setGeneralError('网络异常，请稍后重试')
    } else {
      form.setGeneralError('服务器繁忙，请稍后重试')
    }
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-surface-1 px-4">
    <Card class="w-full max-w-md">
      <CardHeader class="space-y-1">
        <CardTitle class="text-2xl font-bold">登录</CardTitle>
        <CardDescription>请输入您的邮箱和密码</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="space-y-2">
          <Label for="email">邮箱</Label>
          <Input
            id="email"
            v-model="form.email.value"
            type="email"
            placeholder="请输入邮箱"
            :class="form.emailError.value ? 'border-destructive' : ''"
            :disabled="isLoading"
            @keydown.enter="handleSubmit"
          />
          <p v-if="form.emailError.value" class="text-sm text-destructive">
            {{ form.emailError.value }}
          </p>
        </div>
        <div class="space-y-2">
          <Label for="password">密码</Label>
          <Input
            id="password"
            v-model="form.password.value"
            type="password"
            placeholder="请输入密码"
            :class="form.passwordError.value ? 'border-destructive' : ''"
            :disabled="isLoading"
            @keydown.enter="handleSubmit"
          />
          <p v-if="form.passwordError.value" class="text-sm text-destructive">
            {{ form.passwordError.value }}
          </p>
        </div>
        <div
          v-if="form.generalError.value"
          class="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {{ form.generalError.value }}
        </div>
      </CardContent>
      <CardFooter class="flex flex-col space-y-4">
        <Button
          class="w-full"
          :disabled="isLoading"
          aria-busy="isLoading"
          @click="handleSubmit"
        >
          <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
          {{ isLoading ? '登录中...' : '登录' }}
        </Button>
        <p class="text-sm text-muted-foreground">
          还没有账号？
          <RouterLink to="/register" class="text-primary hover:underline">
            去注册
          </RouterLink>
        </p>
      </CardFooter>
    </Card>
  </div>
</template>
