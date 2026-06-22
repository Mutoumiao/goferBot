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

/**
 * 获取 Dashboard 数据。
 * 首版支持 mock 数据；后端就绪后切换为真实 API。
 */
export async function getDashboardData(): Promise<DashboardData> {
  // 尝试真实接口，失败时回退到 mock
  try {
    const { alovaInstance } = await import('@/utils/server')
    const data = await alovaInstance.Get<DashboardData>('/admin/dashboard').send()
    return data
  } catch {
    return getMockData()
  }
}

function getMockData(): DashboardData {
  return {
    stats: {
      userCount: 1286,
      sessionCount: 4521,
      documentCount: 328,
      ragTaskCount: 892,
      userGrowth: 12.5,
      sessionGrowth: 28.3,
      documentGrowth: 5.2,
      ragTaskGrowth: 18.7,
    },
    activities: [
      {
        id: '1',
        title: '用户 admin@example.com 登录',
        description: '来自 192.168.1.100',
        time: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        icon: 'login',
      },
      {
        id: '2',
        title: '创建了知识库文档',
        description: '《产品使用手册v2.0》',
        time: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
        icon: 'create',
      },
      {
        id: '3',
        title: 'RAG 索引任务完成',
        description: '处理了 23 个文档',
        time: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        icon: 'rag',
      },
      {
        id: '4',
        title: '禁用了用户 test@test.com',
        description: '由 admin 操作',
        time: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
        icon: 'delete',
      },
    ],
    health: {
      cpu: 45,
      memory: 62,
      disk: 38,
      queueStatus: 'running',
    },
    ragStats: {
      total: 892,
      running: 12,
      succeeded: 815,
      failed: 23,
      pending: 42,
    },
  }
}
