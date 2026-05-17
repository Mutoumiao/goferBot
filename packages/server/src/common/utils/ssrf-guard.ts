const ALLOWED_HOSTNAMES = [
  'api.openai.com',
  'api.deepseek.com',
  'api.anthropic.com',
]

const BLOCKED_HOSTNAMES = ['127.0.0.1', '0.0.0.0', '[::1]', '[::]']
const BLOCKED_IP_PREFIXES = ['10.', '172.', '192.168.', '169.254.', '127.', '0.', 'fc', 'fd', 'fe80:']

export interface SsrfGuardOptions {
  /** 是否允许 localhost（Ollama 本地部署需要） */
  allowLocalhost?: boolean
  /** 是否强制 HTTPS（生产环境建议开启） */
  requireHttps?: boolean
}

/**
 * 校验 URL 是否合法，防止 SSRF 攻击。
 * 默认拒绝内网地址、非白名单域名、非 HTTPS 协议。
 */
export function validateBaseUrl(url: string, options: SsrfGuardOptions = {}): boolean {
  const { allowLocalhost = false, requireHttps = true } = options

  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    // 协议校验
    if (requireHttps && parsed.protocol !== 'https:') {
      return false
    }

    // localhost 处理
    if (hostname === 'localhost') {
      return allowLocalhost
    }

    // 拒绝本地地址
    if (BLOCKED_HOSTNAMES.includes(hostname)) {
      return false
    }

    // 拒绝内网 IP 前缀
    for (const prefix of BLOCKED_IP_PREFIXES) {
      if (hostname.startsWith(prefix)) {
        return false
      }
    }

    // 白名单校验
    return ALLOWED_HOSTNAMES.includes(hostname)
  } catch {
    return false
  }
}

/** 获取人类可读的白名单域名列表 */
export function getAllowedHostnames(): readonly string[] {
  return ALLOWED_HOSTNAMES
}
