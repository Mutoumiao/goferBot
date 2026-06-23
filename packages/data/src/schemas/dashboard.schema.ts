import { z } from 'zod'

export const dashboardStatsSchema = z.object({
  userCount: z.number(),
  sessionCount: z.number(),
  documentCount: z.number(),
  ragTaskCount: z.number(),
  userGrowth: z.number(),
  sessionGrowth: z.number(),
  documentGrowth: z.number(),
  ragTaskGrowth: z.number(),
})

export const recentActivitySchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  time: z.string(),
  icon: z.enum(['login', 'create', 'delete', 'rag']),
})

export const systemHealthSchema = z.object({
  cpu: z.number(),
  memory: z.number(),
  disk: z.number(),
  queueStatus: z.enum(['running', 'idle', 'stopped']),
})

export const ragStatsSchema = z.object({
  total: z.number(),
  running: z.number(),
  succeeded: z.number(),
  failed: z.number(),
  pending: z.number(),
})

export const dashboardDataSchema = z.object({
  stats: dashboardStatsSchema,
  activities: z.array(recentActivitySchema),
  health: systemHealthSchema,
  ragStats: ragStatsSchema,
})
