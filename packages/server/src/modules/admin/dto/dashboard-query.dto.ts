import {
  dashboardSummaryQuerySchema,
  observabilityDetailQuerySchema,
} from '@goferbot/data/schemas'
import { createZodDto } from 'nestjs-zod'

export class DashboardSummaryQueryDto extends createZodDto(dashboardSummaryQuerySchema) {}

export class ObservabilityDetailQueryDto extends createZodDto(observabilityDetailQuerySchema) {}
