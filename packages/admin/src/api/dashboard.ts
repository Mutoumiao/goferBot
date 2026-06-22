import { alovaInstance } from '@/utils/server'
import type { DashboardData } from '@/features/dashboard/services'

/**
 * 从后端拉取 Dashboard 聚合数据。
 * 后端尚未就绪时会抛出异常，由 dashboard/services 的上层回退至 mock。
 */
export function fetchDashboardData(): Promise<DashboardData> {
  return alovaInstance.Get<DashboardData>('/admin/dashboard').send()
}
