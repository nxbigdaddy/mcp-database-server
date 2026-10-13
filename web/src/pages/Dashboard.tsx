import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Spin } from 'antd';
import { connectionsApi, auditApi } from '@/services/api';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [connectionsData, statsData] = await Promise.all([
        connectionsApi.list(),
        auditApi.getStats(),
      ]);
      setConnections(connectionsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <Spin size="large" className="flex justify-center items-center h-64" />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">仪表盘</h1>

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic title="数据库连接数" value={connections.length} suffix="个" />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总查询次数"
              value={stats?.totalQueries || 0}
              suffix="次"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功查询"
              value={stats?.successQueries || 0}
              valueStyle={{ color: '#3f8600' }}
              suffix="次"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均执行时间"
              value={stats?.avgExecutionTime || 0}
              suffix="ms"
            />
          </Card>
        </Col>
      </Row>

      <Card title="数据库连接状态">
        <Table
          dataSource={connections}
          rowKey="id"
          columns={[
            {
              title: '连接名称',
              dataIndex: 'name',
              key: 'name',
            },
            {
              title: '类型',
              dataIndex: 'type',
              key: 'type',
              render: (type: string) => (
                <span className="uppercase">{type}</span>
              ),
            },
            {
              title: '主机',
              dataIndex: 'host',
              key: 'host',
              render: (host: string, record: any) => `${host}:${record.port}`,
            },
            {
              title: '数据库',
              dataIndex: 'database',
              key: 'database',
            },
            {
              title: '状态',
              key: 'enabled',
              render: (enabled: boolean) => (
                <span className={enabled ? 'text-green-600' : 'text-gray-400'}>
                  {enabled ? '● 启用' : '○ 禁用'}
                </span>
              ),
            },
          ]}
        />
      </Card>

      {stats?.topSlowQueries && stats.topSlowQueries.length > 0 && (
        <Card title="慢查询 TOP 5">
          <Table
            dataSource={stats.topSlowQueries.slice(0, 5)}
            rowKey={(_, index) => String(index ?? 0)}
            columns={[
              {
                title: 'SQL',
                dataIndex: 'sql',
                key: 'sql',
                ellipsis: true,
              },
              {
                title: '平均耗时',
                dataIndex: 'avgTime',
                key: 'avgTime',
                render: (time: number) => `${time}ms`,
                sorter: (a: any, b: any) => a.avgTime - b.avgTime,
              },
              {
                title: '执行次数',
                dataIndex: 'count',
                key: 'count',
                sorter: (a: any, b: any) => a.count - b.count,
              },
            ]}
          />
        </Card>
      )}
    </div>
  );
}
