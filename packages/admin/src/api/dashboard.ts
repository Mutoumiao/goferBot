import { alovaInstance } from '@/utils/server'

export interface DashboardStats {
  userCount: number
  sessionCount: number
  documentCount: number
  ragTaskCount: number
  userGrowth: number
  sessionGrowth: number
  documentGrowth: number
  ragTaskGrowth: number
}

export interface RecentActivity {
  id: string
  title: string
  description: string
  time: string
  icon: 'login' | 'create' | 'delete' | 'rag'
}

export interface SystemHealth {
  cpu: number
  memory: number
  disk: number
  queueStatus: 'running' | 'idle' | 'stopped'
}

export interface RagStats {
  total: number
  running: number
  succeeded: number
  failed: number
  pending: number
}

export interface DashboardData {
  stats: DashboardStats
  activities: RecentActivity[]
  health: SystemHealth
  ragStats: RagStats
}

export const fetchDashboardData = () => alovaInstance.Get<DashboardData>('/admin/dashboard')
