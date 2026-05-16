import { ref, computed } from 'vue'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface FieldState {
  value: string
  error: string | null
  touched: boolean
}

function createField(initial = ''): FieldState {
  return { value: initial, error: null, touched: false }
}

export function useAuthForm(options: { confirmPassword?: boolean } = {}) {
  const email = ref(createField())
  const password = ref(createField())
  const confirmPassword = ref(createField())
  const generalError = ref<string | null>(null)

  function validateEmail(): boolean {
    if (!email.value.value.trim()) {
      email.value.error = '请输入邮箱地址'
      return false
    }
    if (!EMAIL_REGEX.test(email.value.value)) {
      email.value.error = '请输入有效的邮箱地址'
      return false
    }
    email.value.error = null
    return true
  }

  function validatePassword(): boolean {
    if (!password.value.value) {
      password.value.error = '请输入密码'
      return false
    }
    if (password.value.value.length < 6) {
      password.value.error = '密码长度不能少于 6 位'
      return false
    }
    password.value.error = null
    return true
  }

  function validateConfirmPassword(): boolean {
    if (!options.confirmPassword) return true
    if (!confirmPassword.value.value) {
      confirmPassword.value.error = '请再次输入密码'
      return false
    }
    if (confirmPassword.value.value !== password.value.value) {
      confirmPassword.value.error = '两次输入的密码不一致'
      return false
    }
    confirmPassword.value.error = null
    return true
  }

  function validateAll(): boolean {
    const results = [validateEmail(), validatePassword()]
    if (options.confirmPassword) {
      results.push(validateConfirmPassword())
    }
    return results.every(Boolean)
  }

  function clearFieldError(field: typeof email) {
    if (field.value.error && field.value.value) {
      field.value.error = null
    }
  }

  function clearErrors() {
    email.value.error = null
    password.value.error = null
    confirmPassword.value.error = null
    generalError.value = null
  }

  function setGeneralError(error: string | null) {
    generalError.value = error
  }

  return {
    email: computed({
      get: () => email.value.value,
      set: (v: string) => {
        email.value.value = v
        clearFieldError(email)
      },
    }),
    password: computed({
      get: () => password.value.value,
      set: (v: string) => {
        password.value.value = v
        clearFieldError(password)
      },
    }),
    confirmPassword: computed({
      get: () => confirmPassword.value.value,
      set: (v: string) => {
        confirmPassword.value.value = v
        clearFieldError(confirmPassword)
      },
    }),
    emailError: computed(() => email.value.error),
    passwordError: computed(() => password.value.error),
    confirmPasswordError: computed(() => confirmPassword.value.error),
    generalError: computed(() => generalError.value),
    validateAll,
    clearErrors,
    setGeneralError,
  }
}
