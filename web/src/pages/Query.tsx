import { useState, useEffect } from 'react';
import { Card, Button, Space, message, Select } from 'antd';
import Editor from '@monaco-editor/react';
import { queryApi, connectionsApi } from '@/services/api';
import type { Connection } from '@/services/api';

const { Option } = Select;

export default function Query() {
  const [sql, setSql] = useState('SELECT * FROM users LIMIT 10;');
  const [selectedConnection, setSelectedConnection] = useState<string>('');
  const [connections, setConnections] = useState<Connection[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    connectionsApi.list().then(data => setConnections(data));
  }, []);

  async function executeQuery() {
    if (!selectedConnection) {
      message.error('请选择数据库连接');
      return;
    }

    setLoading(true);
    try {
      const data = await queryApi.execute({
        connection: selectedConnection,
        sql,
      });
      setResult(data);
      message.success('查询执行成功');
    } catch (error: any) {
      message.error(`查询失败：${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">SQL 工作台</h1>
        <Space>
          <Select
            style={{ width: 300 }}
            placeholder="选择数据库连接"
            value={selectedConnection}
            onChange={setSelectedConnection}
          >
            {connections.map((conn) => (
              <Option key={conn.id} value={conn.id}>
                {conn.name} ({conn.type})
              </Option>
            ))}
          </Select>
          <Button type="primary" loading={loading} onClick={executeQuery}>
            执行
          </Button>
        </Space>
      </div>

      <Card className="h-96">
        <Editor
          height="100%"
          defaultLanguage="sql"
          value={sql}
          onChange={(value) => setSql(value || '')}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            automaticLayout: true,
          }}
        />
      </Card>

      {result && (
        <Card title={`查询结果 (${result.rowCount} 行，${result.executionTime}ms)`}>
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  {result.columns.map((col: any, index: number) => (
                    <th key={index} className="border p-2 text-left">
                      {col.name} ({col.type})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row: any[], rowIndex: number) => (
                  <tr key={rowIndex} className="hover:bg-gray-50">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="border p-2">
                        {cell === null ? 'NULL' : String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
