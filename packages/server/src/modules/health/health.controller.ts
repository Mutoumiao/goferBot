import { Controller, Get } from '@nestjs/common'
import { HealthService, type HealthSnapshot } from './health.service.js'

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
    }
  }

  @Get('ready')
  async ready(): Promise<HealthSnapshot> {
    return this.healthService.check()
  }
}
