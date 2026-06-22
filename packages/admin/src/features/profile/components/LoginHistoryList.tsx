import { Card, Table } from 'antd'
import { useEffect, useState } from 'react'
import { fetchLoginHistory, type LoginHistoryItem } from '@/features/profile/services'

export function LoginHistoryList() {
  const [history, setHistory] = useState<LoginHistoryItem[]>([])

  useEffect(() => {
    void fetchLoginHistory().then((list) => setHistory(list))
  }, [])

  return (
    <Card>
      <Table
        rowKey="id"
        dataSource={history}
        pagination={false}
        columns={[
          { title: 'IP', dataIndex: 'ip', key: 'ip', width: 140 },
          { title: '设备', dataIndex: 'device', key: 'device' },
          { title: '时间', dataIndex: 'time', key: 'time', width: 200 },
        ]}
      />
    </Card>
  )
}
