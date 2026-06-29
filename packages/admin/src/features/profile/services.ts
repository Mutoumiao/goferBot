export interface LoginHistoryItem {
  id: string
  ip: string
  device: string
  time: string
}

export async function fetchLoginHistory(): Promise<LoginHistoryItem[]> {
  try {
    const res = await import('@/utils/server').then((m) =>
      m.alovaInstance.Get<LoginHistoryItem[]>('/auth/login-history').send(),
    )
    return res
  } catch {
    return getMockHistory()
  }
}

function getMockHistory(): LoginHistoryItem[] {
  const now = Date.now()
  return [
    {
      id: '1',
      ip: '192.168.1.100',
      device: 'Chrome / Windows',
      time: new Date(now - 3600000).toISOString(),
    },
    {
      id: '2',
      ip: '192.168.1.100',
      device: 'Chrome / Windows',
      time: new Date(now - 86400000).toISOString(),
    },
    {
      id: '3',
      ip: '10.0.0.5',
      device: 'Safari / macOS',
      time: new Date(now - 172800000).toISOString(),
    },
  ]
}
