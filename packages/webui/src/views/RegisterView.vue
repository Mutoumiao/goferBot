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
const form = useAuthForm({ confirmPassword: true })

const isLoading = computed(() => authStore.isLoading)

async function handleSubmit() {
  form.clearErrors()

  if (!form.validateAll()) {
    return
  }

  try {
    await authStore.register({
      email: form.email.value,
      password: form.password.value,
    })
    router.push('/')
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e)
    if (err.includes('409') || err.includes('已注册') || err.includes('USER_EXISTS')) {
      form.setGeneralError('该邮箱已被注册')
    } else if (err.includes('400')) {
      form.setGeneralError('请求参数错误，请检查输入')
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
        <CardTitle class="text-2xl font-bold">注册</CardTitle>
        <CardDescription>创建一个新账号</CardDescription>
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
        <div class="space-y-2">
          <Label for="confirmPassword">确认密码</Label>
          <Input
            id="confirmPassword"
            v-model="form.confirmPassword.value"
            type="password"
            placeholder="请再次输入密码"
            :class="form.confirmPasswordError.value ? 'border-destructive' : ''"
            :disabled="isLoading"
            @keydown.enter="handleSubmit"
          />
          <p v-if="form.confirmPasswordError.value" class="text-sm text-destructive">
            {{ form.confirmPasswordError.value }}
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
          {{ isLoading ? '注册中...' : '注册' }}
        </Button>
        <p class="text-sm text-muted-foreground">
          已有账号？
          <RouterLink to="/login" class="text-primary hover:underline">
            去登录
          </RouterLink>
        </p>
      </CardFooter>
    </Card>
  </div>
</template>
