<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAuthForm } from '@/composables/useAuthForm'
import { Button } from '@/components/ui/button'
import { Loader2, Sparkles, Mail, Lock, ArrowRight } from 'lucide-vue-next'

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
    const status = (e as { status?: number }).status
    const code = (e as { code?: string }).code
    if (status === 401 || code === 'AUTH_FAIL') {
      form.setGeneralError('邮箱或密码错误')
    } else if ((e as Error).name === 'NetworkError' || !(e as { status?: number }).status) {
      form.setGeneralError('网络异常，请稍后重试')
    } else {
      form.setGeneralError('服务器繁忙，请稍后重试')
    }
  }
}
</script>

<template>
  <div class="auth-split">
    <!-- 左侧插画区 -->
    <div class="auth-illustration" aria-hidden="true">
      <div class="illo-container">
        <div class="illo-ring ring-1" />
        <div class="illo-ring ring-2" />
        <div class="illo-ring ring-3" />
        <div class="illo-center">
          <Sparkles :size="38" />
        </div>
        <div class="illo-dot dot-1" />
        <div class="illo-dot dot-2" />
        <div class="illo-dot dot-3" />
        <div class="illo-dash dash-1" />
        <div class="illo-rect rect-1" />
        <div class="illo-dot dot-4" />
      </div>
      <h2 class="illo-brand">GoferBot</h2>
      <p class="illo-desc">智能知识管理，让每一份文档都触手可及</p>
    </div>

    <!-- 右侧表单区 -->
    <div class="auth-form-side">
      <div class="auth-card">
        <div class="auth-header">
          <h1 class="auth-title">欢迎回来</h1>
          <p class="auth-subtitle">登录您的 GoferBot 账号</p>
        </div>

        <form class="auth-form" @submit.prevent="handleSubmit">
          <div class="auth-field">
            <label class="auth-label" for="email">邮箱</label>
            <div class="auth-input-wrap" :class="{ 'has-error': form.emailError.value }">
              <Mail class="auth-input-icon" :size="16" />
              <input
                id="email"
                v-model="form.email.value"
                type="email"
                class="auth-input"
                placeholder="请输入邮箱地址"
                :disabled="isLoading"
                autocomplete="email"
              />
            </div>
            <p v-if="form.emailError.value" class="auth-error">{{ form.emailError.value }}</p>
          </div>

          <div class="auth-field">
            <label class="auth-label" for="password">密码</label>
            <div class="auth-input-wrap" :class="{ 'has-error': form.passwordError.value }">
              <Lock class="auth-input-icon" :size="16" />
              <input
                id="password"
                v-model="form.password.value"
                type="password"
                class="auth-input"
                placeholder="请输入密码"
                :disabled="isLoading"
                autocomplete="current-password"
              />
            </div>
            <p v-if="form.passwordError.value" class="auth-error">{{ form.passwordError.value }}</p>
          </div>

          <div
            v-if="form.generalError.value"
            class="auth-alert"
            role="alert"
          >
            {{ form.generalError.value }}
          </div>

          <Button
            class="auth-submit-btn"
            :disabled="isLoading"
            :aria-busy="isLoading"
            type="submit"
          >
            <Loader2 v-if="isLoading" class="animate-spin" :size="18" />
            <template v-else>
              登录
              <ArrowRight :size="16" />
            </template>
          </Button>
        </form>

        <p class="auth-footer">
          还没有账号？
          <RouterLink to="/register" class="auth-footer-link">立即注册</RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Split layout ── */
.auth-split {
  display: flex;
  min-height: 100vh;
  background: var(--color-surface-1);
}

/* ── Left: Illustration panel ── */
.auth-illustration {
  display: none;
}

@media (min-width: 768px) {
  .auth-illustration {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 50%;
    padding: 3rem;
    background: var(--color-surface-1);
    gap: 2rem;
  }
}

.illo-container {
  position: relative;
  width: 440px;
  height: 440px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: illo-enter 0.8s ease-out;
}

@keyframes illo-enter {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}

.illo-ring {
  position: absolute;
  border-radius: 50%;
}

.ring-1 {
  width: 380px;
  height: 380px;
  background: rgba(238, 242, 255, 0.5);
  --ring-mask: radial-gradient(circle at center, transparent 91%, #EEF2FF80 92%);
  -webkit-mask-image: var(--ring-mask);
  mask-image: var(--ring-mask);
}

.ring-2 {
  width: 280px;
  height: 280px;
  background: var(--color-accent-soft);
  --ring2-mask: radial-gradient(circle at center, transparent 87%, #EEF2FF 88%);
  -webkit-mask-image: var(--ring2-mask);
  mask-image: var(--ring2-mask);
}

.ring-3 {
  width: 180px;
  height: 180px;
  background: var(--color-surface-0);
  --ring3-mask: radial-gradient(circle at center, transparent 80%, #FFFFFF 81%);
  -webkit-mask-image: var(--ring3-mask);
  mask-image: var(--ring3-mask);
  border: 1px solid var(--color-border-default);
  border-radius: 50%;
}

.illo-center {
  position: absolute;
  width: 90px;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-500);
  border-radius: 28px;
  color: #FFFFFF;
  z-index: 1;
  box-shadow: 0 8px 32px var(--color-accent-glow);
}

/* Decorative dots */
.illo-dot {
  position: absolute;
  border-radius: 50%;
}

.dot-1 { width: 12px; height: 12px; background: var(--color-accent-500); top: 60px; left: 55px; }
.dot-2 { width: 8px; height: 8px; background: #7C6EE6; border-radius: 3px; top: 100px; right: 85px; }
.dot-3 { width: 16px; height: 16px; background: var(--color-text-tertiary); bottom: 110px; left: 60px; }
.dot-4 { width: 10px; height: 10px; background: #F6F1FF; top: 160px; right: 55px; }

.illo-dash {
  position: absolute;
  width: 40px;
  height: 4px;
  background: var(--color-accent-500);
  border-radius: 2px;
  top: 30px;
  left: 120px;
}

.illo-rect {
  position: absolute;
  width: 20px;
  height: 20px;
  background: #EEF8F3;
  border: 1.5px solid var(--color-accent-500);
  border-radius: 6px;
  bottom: 110px;
  right: 90px;
}

.illo-brand {
  font-size: 2rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.illo-desc {
  font-size: 0.9375rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0;
  max-width: 360px;
  text-align: center;
}

/* ── Right: Form panel ── */
.auth-form-side {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: var(--color-surface-1);
}

@media (min-width: 768px) {
  .auth-form-side {
    width: 50%;
    flex: none;
  }
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: var(--color-surface-0);
  border: 1px solid var(--color-border-default);
  border-radius: 24px;
  padding: 36px;
  box-shadow:
    0 6px 22px rgba(0, 0, 0, 0.04),
    0 1px 2px rgba(0, 0, 0, 0.03);
  animation: card-enter 0.5s ease-out 0.15s both;
}

@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.auth-header {
  text-align: center;
  margin-bottom: 22px;
}

.auth-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 6px;
  letter-spacing: -0.02em;
}

.auth-subtitle {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin: 0;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.auth-input-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 14px;
  background: var(--color-surface-1);
  border: 1px solid var(--color-border-default);
  border-radius: 12px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.auth-input-wrap:focus-within {
  border-color: var(--color-accent-500);
  box-shadow: 0 0 0 3px var(--color-accent-glow);
}

.auth-input-wrap.has-error {
  border-color: var(--color-danger-500);
}

.auth-input-wrap.has-error:focus-within {
  box-shadow: 0 0 0 3px var(--color-danger-glow);
}

.auth-input-icon {
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.auth-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-sans);
  font-size: 0.875rem;
  color: var(--color-text-primary);
  width: 100%;
}

.auth-input::placeholder {
  color: var(--color-text-tertiary);
}

.auth-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.auth-error {
  font-size: 0.75rem;
  color: var(--color-danger-500);
  margin: 0;
}

.auth-alert {
  padding: 10px 14px;
  background: var(--color-danger-soft);
  border-radius: 10px;
  font-size: 0.8125rem;
  color: var(--color-danger-500);
}

.auth-submit-btn {
  width: 100%;
  height: 46px;
  border-radius: 14px;
  font-size: 0.9375rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 2px;
  transition: transform 0.1s ease, box-shadow 0.15s ease;
}

.auth-submit-btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px var(--color-accent-glow);
}

.auth-submit-btn:not(:disabled):active {
  transform: translateY(0);
}

.auth-footer {
  text-align: center;
  margin: 22px 0 0;
  font-size: 0.8125rem;
  color: var(--color-text-tertiary);
}

.auth-footer-link {
  font-weight: 500;
  color: var(--color-accent-500);
  text-decoration: none;
  transition: opacity 0.15s ease;
}

.auth-footer-link:hover {
  opacity: 0.8;
}
</style>
