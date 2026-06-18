import { z } from 'zod'

/**
 * 分页请求参数 Schema — 前后端共享的通用分页参数
 * @description 用于所有需要分页的列表查询接口
 */
export const pagerRequestSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).describe('页码，最小 1'),
  size: z.coerce.number().int().min(1).max(50).default(10).describe('每页条数，最小 1，最大 50'),
})

/**
 * 分页响应 Schema — 前后端共享的通用分页结果
 * @description 用于所有分页列表接口的返回结构
 */
export const paginationSchema = z.object({
  total: z.number().describe('总记录数'),
  size: z.number().describe('每页条数'),
  currentPage: z.number().describe('当前页码'),
  totalPage: z.number().describe('总页数'),
  hasNextPage: z.boolean().describe('是否有下一页'),
  hasPrevPage: z.boolean().describe('是否有上一页'),
})

/**
 * 通用分页列表响应 Schema
 * @description 包装分页数据的通用结构
 */
export function createPagedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    pagination: paginationSchema,
  })
}
