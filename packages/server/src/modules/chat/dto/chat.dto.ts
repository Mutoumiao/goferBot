import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const ALLOWED_HOSTNAMES = [
  'api.openai.com',
  'api.deepseek.com',
  'api.anthropic.com',
]

const BLOCKED_HOSTNAMES = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '[::]']
const BLOCKED_IP_PREFIXES = ['10.', '172.', '192.168.', '169.254.', '127.', '0.', 'fc', 'fd', 'fe80:']

function isAllowedHostname(url: string): boolean {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase()

    // 强制 https 协议（生产环境）
    if (parsed.protocol !== 'https:') {
      return false
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

export const chatSchema = z.object({
  message: z
    .string()
    .min(1, '消息不能为空')
    .max(4000, '消息过长，最多 4000 字符'),
  sessionId: z.string().uuid('sessionId 格式不正确'),
  knowledgeBaseIds: z.array(z.string().uuid()).optional(),
  config: z.object({
    provider: z.string().min(1, 'provider 不能为空'),
    model: z.string().min(1, 'model 不能为空'),
    baseUrl: z
      .string()
      .url('baseUrl 必须是合法 URL')
      .refine(isAllowedHostname, {
        message: `baseUrl 不在白名单中，仅允许: ${ALLOWED_HOSTNAMES.join(', ')}`,
      }),
    apiKey: z.string().min(1, 'apiKey 不能为空'),
  }),
})

export class ChatDto extends createZodDto(chatSchema) {}
