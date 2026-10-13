import { useEffect, useState } from 'react';
import { Table, Card, DatePicker, Space, Button, Select } from 'antd';
import { auditApi } from '@/services/api';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

export default function Audit() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [dateRange, setDateRange] = useState<any[]>([]);
  const [sqlType, setSqlType] = useState<string>('');

  useEffect(() => {
    loadLogs();
  }, [dateRange, sqlType]);

  async function loadLogs() {
    setLoading(true);
    try {
      const params: any = { page: 1, pageSize: 100 };
      if (dateRange && dateRange.length === 2) {
        params.startDate = dateRange[0].format('YYYY-MM-DD');
        params.endDate = dateRange[1].format('YYYY-MM-DD');
      }
      if (sqlType) {
        params.sqlType = sqlType;
      }

      const data = await auditApi.getLogs(params);
      setLogs(data.logs);
      setTotal(data.pagination.total);
    } catch (error) {
      console.error('Failed to load audit logs:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">审计日志</h1>

      <Card>
        <Space className="mb-4">
          <RangePicker onChange={(dates) => setDateRange(dates as any)} />
          <Select
            style={{ width: 150 }}
            placeholder="SQL 类型"
            allowClear
            value={sqlType}
            onChange={setSqlType}
          >
            <Option value="SELECT">SELECT</Option>
            <Option value="INSERT">INSERT</Option>
            <Option value="UPDATE">UPDATE</Option>
            <Option value="DELETE">DELETE</Option>
            <Option value="DDL">DDL</Option>
          </Select>
          <Button onClick={loadLogs}>刷新</Button>
        </Space>

        <Table
          loading={loading}
          dataSource={logs}
          rowKey="id"
          pagination={{ total, showSizeChanger: true }}
          columns={[
            {
              title: '时间',
              dataIndex: 'created_at',
              key: 'created_at',
              render: (time: string) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
              width: 180,
            },
            {
              title: '连接',
              dataIndex: 'connection_name',
              key: 'connection_name',
              width: 150,
            },
            {
              title: 'SQL 类型',
              dataIndex: 'sql_type',
              key: 'sql_type',
              render: (type: string) => (
                <span className={`font-mono ${type === 'SELECT' ? 'text-blue-600' : 'text-orange-600'}`}>
                  {type}
                </span>
              ),
              width: 100,
            },
            {
              title: 'SQL 语句',
              dataIndex: 'sql_text',
              key: 'sql_text',
              ellipsis: true,
            },
            {
              title: '耗时',
              dataIndex: 'execution_time_ms',
              key: 'execution_time_ms',
              render: (ms: number) => `${ms}ms`,
              width: 80,
              sorter: (a: any, b: any) => a.execution_time_ms - b.execution_time_ms,
            },
            {
              title: '行数',
              dataIndex: 'row_count',
              key: 'row_count',
              width: 80,
            },
            {
              title: '状态',
              dataIndex: 'status',
              key: 'status',
              render: (status: string) => (
                <span className={status === 'success' ? 'text-green-600' : 'text-red-600'}>
                  {status === 'success' ? '✓ 成功' : '✗ 失败'}
                </span>
              ),
              width: 80,
            },
            {
              title: '错误信息',
              dataIndex: 'error_message',
              key: 'error_message',
              ellipsis: true,
            },
          ]}
        />
      </Card>
    </div>
  );
}
