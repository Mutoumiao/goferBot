import { Controller, Get, HttpStatus, NotFoundException, Param, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { FastifyReply } from 'fastify'
import { CaptchaService } from './captcha.service.js'

/**
 * 验证码相关端点。
 *
 * 设计：
 * - `GET /auth/captcha` 返回 JSON，携带 `captchaId` + `imageBase64`（data URL），
 *   客户端可直接用于 `<img src={...}>`，便于 React/Vue 组件快速渲染。
 * - `GET /auth/captcha/image/:captchaId` 返回 PNG 二进制流。
 *   基于 captchaId 从 Redis 反查对应的图片（与 JSON 端点共享同一份 Redis 存储）。
 *   若 captchaId 已失效或不存在，返回 404。
 */
@Controller('auth/captcha')
export class CaptchaController {
  constructor(private readonly captchaService: CaptchaService) {}

  @Get()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async getCaptcha() {
    return await this.captchaService.getImageData()
  }

  @Get('image/:captchaId')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  async getCaptchaImage(@Param('captchaId') captchaId: string, @Res() res: FastifyReply) {
    const png = await this.captchaService.getImageById(captchaId)
    if (!png) {
      throw new NotFoundException('验证码已失效，请刷新后重试')
    }
    res.header('Content-Type', 'image/png')
    res.header('Cache-Control', 'no-store, no-cache, must-revalidate')
    res.status(HttpStatus.OK).send(png)
  }
}
