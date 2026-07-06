import { randomBytes, randomUUID } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import sharp from 'sharp'
import { AuthRedisService } from './auth-redis.service.js'

const CAPTCHA_PREFIX = 'captcha:'
const CAPTCHA_IMAGE_PREFIX = 'captcha:img:'
const CAPTCHA_TTL_SECONDS = 120
const CAPTCHA_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CAPTCHA_CODE_LENGTH = 4
const CAPTCHA_WIDTH = 130
const CAPTCHA_HEIGHT = 52
const CAPTCHA_NOISE_LINES = 4
const CAPTCHA_NOISE_POINTS = 20

export interface CaptchaChallenge {
  captchaId: string
  imagePng: Buffer
  expiresInSeconds: number
}

export interface CaptchaImageData {
  captchaId: string
  imageBase64: string
  imageUrl: string
  expiresIn: number
}

/**
 * 图形验证码服务。
 *
 * 使用 SVG 文字 + 干扰线/噪点渲染，通过 sharp 转为 PNG。
 * 字符采用标准 sans-serif 字体，具备天然抗锯齿，清晰可辨。
 */
@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name)

  constructor(
    private readonly authRedis: AuthRedisService,
    private readonly configService: ConfigService,
  ) {}

  /** 生成一个新的验证码挑战，返回 captchaId + PNG 图片 Buffer。 */
  async generateChallenge(): Promise<CaptchaChallenge> {
    const captchaId = randomUUID()
    const code = this.generateCode()
    const imagePng = await this.renderImage(code)

    // Redis 存储：大写码，TTL 内一次性消费
    const pipeline = [
      this.authRedis.setex(`${CAPTCHA_PREFIX}${captchaId}`, CAPTCHA_TTL_SECONDS, code),
      this.authRedis.setex(
        `${CAPTCHA_IMAGE_PREFIX}${captchaId}`,
        CAPTCHA_TTL_SECONDS,
        imagePng.toString('base64'),
      ),
    ]
    await Promise.all(pipeline)

    return {
      captchaId,
      imagePng,
      expiresInSeconds: CAPTCHA_TTL_SECONDS,
    }
  }

  /** 对外的视图：携带 base64 以便客户端直接展示；同时保留二进制流路径。 */
  async getImageData(): Promise<CaptchaImageData> {
    const { captchaId, imagePng, expiresInSeconds } = await this.generateChallenge()
    return {
      captchaId,
      imageBase64: imagePng.toString('base64'),
      imageUrl: `/auth/captcha/image/${captchaId}`,
      expiresIn: expiresInSeconds,
    }
  }

  /** 基于 captchaId 反查 Redis 中存储的 PNG 图片 Buffer（供 <img src> 直链场景）。 */
  async getImageById(captchaId: string): Promise<Buffer | null> {
    if (!captchaId) return null
    const b64 = await this.authRedis.get(`${CAPTCHA_IMAGE_PREFIX}${captchaId}`)
    if (!b64) return null
    try {
      const buf = Buffer.from(b64, 'base64')
      return buf.length > 0 ? buf : null
    } catch {
      return null
    }
  }

  /** 校验并消费验证码。成功后立即删除，防止重放。 */
  async verify(captchaId: string, inputCode: string): Promise<boolean> {
    if (!captchaId || !inputCode) return false

    const key = `${CAPTCHA_PREFIX}${captchaId}`
    const stored = await this.authRedis.get(key)
    if (!stored) return false

    const expected = stored.trim().toUpperCase()
    const provided = inputCode.trim().toUpperCase()

    // 一次性：无论对错都立即删除，防止探测；同时清理图片缓存
    await Promise.all([
      this.authRedis.del(key),
      this.authRedis.del(`${CAPTCHA_IMAGE_PREFIX}${captchaId}`),
    ])

    if (expected !== provided) {
      this.logger.warn('验证码校验失败', { captchaId })
      return false
    }
    return true
  }

  /** 基于 Origin 白名单的验证码校验。如果验证码未启用或 Origin 在白名单中，直接跳过验证。 */
  async verifyWithOrigin(origin: string | undefined, captchaId: string, inputCode: string): Promise<boolean> {
    if (!this.isCaptchaEnabled()) {
      return true
    }

    const whitelistOrigins = this.getWhitelistOrigins()
    if (whitelistOrigins.has(origin ?? '')) {
      this.logger.debug('验证码跳过：Origin 在白名单中', { origin })
      return true
    }

    return this.verify(captchaId, inputCode)
  }

  private isCaptchaEnabled(): boolean {
    return this.configService.get<boolean>('CAPTCHA_ENABLED') ?? false
  }

  private isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production'
  }

  private getWhitelistOrigins(): Set<string> {
    if (this.isProduction()) {
      return new Set()
    }

    const config = this.configService.get<string>('CAPTCHA_WHITELIST_ORIGINS')
    if (!config) return new Set()

    return new Set(
      config
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean),
    )
  }

  /** 仅用于调试 / 测试：获取当前验证码明文（正常流程不暴露）。 */
  async peek(captchaId: string): Promise<string | null> {
    return await this.authRedis.get(`${CAPTCHA_PREFIX}${captchaId}`)
  }

  private generateCode(): string {
    const bytes = randomBytes(CAPTCHA_CODE_LENGTH)
    let code = ''
    for (let i = 0; i < CAPTCHA_CODE_LENGTH; i++) {
      code += CAPTCHA_CODE_CHARS[bytes[i] % CAPTCHA_CODE_CHARS.length]
    }
    return code
  }

  /** 生成 SVG 字符串 → sharp → PNG Buffer。 */
  private async renderImage(code: string): Promise<Buffer> {
    const svg = this.buildSvg(code)
    return await sharp(Buffer.from(svg, 'utf-8')).png().toBuffer()
  }

  /** 构造带干扰的 SVG。 */
  private buildSvg(code: string): string {
    const w = CAPTCHA_WIDTH
    const h = CAPTCHA_HEIGHT

    let noiseElements = ''

    // 干扰线：随机曲线（二次贝塞尔）
    for (let i = 0; i < CAPTCHA_NOISE_LINES; i++) {
      const x1 = this.randInt(5, w - 5)
      const y1 = this.randInt(5, h - 5)
      const xc = this.randInt(10, w - 10)
      const yc = this.randInt(5, h - 5)
      const x2 = this.randInt(5, w - 5)
      const y2 = this.randInt(5, h - 5)
      const color = this.randColor(120, 180)
      noiseElements += `<path d="M${x1},${y1} Q${xc},${yc} ${x2},${y2}" stroke="${color}" stroke-width="1.2" fill="none" opacity="0.4"/>`
    }

    // 噪点
    for (let i = 0; i < CAPTCHA_NOISE_POINTS; i++) {
      const cx = this.randInt(2, w - 2)
      const cy = this.randInt(2, h - 2)
      const r = 1 + Math.random() * 1.5
      const color = this.randColor(130, 200)
      noiseElements += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="0.35"/>`
    }

    // 字符
    const charWidth = (w - 16) / code.length
    let textElements = ''
    for (let i = 0; i < code.length; i++) {
      const cx = 12 + i * charWidth + charWidth / 2
      const cy = h / 2
      const rotation = this.randInt(-15, 15)
      const dy = this.randInt(-4, 4)
      const color = this.randColor(40, 100)
      textElements +=
        `<text x="${cx}" y="${cy + dy}" ` +
        `transform="rotate(${rotation}, ${cx}, ${cy + dy})" ` +
        `fill="${color}" font-family="Arial,Helvetica,sans-serif" ` +
        `font-size="28" font-weight="bold" text-anchor="middle" ` +
        `dominant-baseline="central">${code[i]}</text>`
    }

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
      `<rect width="${w}" height="${h}" fill="#EEF1FE"/>`,
      noiseElements,
      textElements,
      `</svg>`,
    ].join('')
  }

  private randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  private randColor(minBrightness: number, maxBrightness: number): string {
    const v = this.randInt(minBrightness, maxBrightness)
    const r = v + this.randInt(-20, 20)
    const g = v + this.randInt(-20, 20)
    const b = v + this.randInt(-20, 20)
    const clamp = (n: number) => Math.max(0, Math.min(255, n))
    return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`
  }
}
