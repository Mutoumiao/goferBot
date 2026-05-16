export class SSRFError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SSRFError'
  }
}

/** 允许的域名白名单 */
export const ALLOWED_HOSTS = [
  'api.openai.com',
  'api.deepseek.com',
  'api.anthropic.com',
  'localhost:11434',
]

/** 拒绝的内网 IP 段（CIDR 简化表示） */
const BLOCKED_PREFIXES = [
  '0.',
  '10.',
  '127.',
  '169.254.',
  '172.16.',
  '172.17.',
  '172.18.',
  '172.19.',
  '172.20.',
  '172.21.',
  '172.22.',
  '172.23.',
  '172.24.',
  '172.25.',
  '172.26.',
  '172.27.',
  '172.28.',
  '172.29.',
  '172.30.',
  '172.31.',
  '192.168.',
]

function isBlockedIp(hostname: string): boolean {
  // IPv6 localhost
  if (hostname === '::1' || hostname === '[::1]') return true
  // 纯 IPv4 检查
  for (const prefix of BLOCKED_PREFIXES) {
    if (hostname.startsWith(prefix)) return true
  }
  return false
}

function isAllowedHost(hostname: string): boolean {
  // 去除可能的端口，单独比较 host
  const hostWithoutPort = hostname.split(':')[0]
  return ALLOWED_HOSTS.some(allowed => {
    const allowedHost = allowed.split(':')[0]
    return hostWithoutPort === allowedHost
  })
}

/**
 * 校验 baseUrl 是否合法。
 * @param baseUrl — 用户配置的 API Base URL
 * @throws SSRFError — 当地址不在白名单或为内网地址时抛出
 */
export function validateBaseUrl(baseUrl: string): void {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new SSRFError('不合法的 API 地址')
  }

  const hostname = url.hostname
  const hostWithPort = url.port ? `${hostname}:${url.port}` : hostname

  // 1. 严格白名单匹配（含端口）
  if (ALLOWED_HOSTS.includes(hostWithPort)) {
    return
  }

  // 2. 域名白名单匹配（不含端口）
  if (isAllowedHost(hostname)) {
    return
  }

  // 3. 拒绝内网地址（localhost:11434 已在白名单放行）
  if (isBlockedIp(hostname)) {
    throw new SSRFError('不合法的 API 地址')
  }

  // 4. 拒绝非 HTTPS 的外部地址（生产环境）
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new SSRFError('不合法的 API 地址')
  }

  // 5. 其余情况放行（外部域名）
}
