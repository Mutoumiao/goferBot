import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

@Injectable()
export class SpiderGuard implements CanActivate {
  private readonly spiderPattern =
    /(scrapy|httpclient|axios|python-requests|bot|spider|crawler|curl|wget|java)/i

  private readonly allowList = /(google|baidu|bing)/i

  canActivate(context: ExecutionContext): boolean {
    const isDev = process.env.NODE_ENV !== 'production'
    if (isDev) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const ua: string = request.headers['user-agent'] || ''

    const isSpider = this.spiderPattern.test(ua) && !this.allowList.test(ua)

    if (isSpider) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: `爬虫访问被禁止，UA: ${ua}`,
      })
    }

    return true
  }
}
