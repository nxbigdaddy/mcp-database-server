import { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  message,
  Popconfirm,
  Space,
  Tag,
} from 'antd';
import { connectionsApi } from '@/services/api';
import type { Connection } from '@/services/api';

const { Option } = Select;

export default function Connections() {
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadConnections();
  }, []);

  async function loadConnections() {
    setLoading(true);
    try {
      const data = await connectionsApi.list();
      setConnections(data);
    } catch (error) {
      message.error('加载连接列表失败');
    } finally {
      setLoading(false);
    }
  }

  function handleCreate() {
    setEditingConnection(null);
    form.resetFields();
    setModalVisible(true);
  }

  function handleEdit(record: Connection) {
    setEditingConnection(record);
    form.setFieldsValue({
      ...record,
      ssl_enabled: record.ssl_enabled || false,
      read_only: record.read_only || false,
      enabled: record.enabled !== false,
    });
    setModalVisible(true);
  }

  async function handleDelete(id: string) {
    try {
      await connectionsApi.delete(id);
      message.success('删除成功');
      loadConnections();
    } catch (error) {
      message.error('删除失败');
    }
  }

  async function handleTest(id: string) {
    try {
      const result = await connectionsApi.test(id);
      if (result?.connected) {
        message.success('连接测试成功');
      } else {
        message.error('连接测试失败');
      }
    } catch (error) {
      message.error('连接测试失败');
    }
  }

  async function handleSubmit(values: any) {
    try {
      if (editingConnection) {
        await connectionsApi.update(editingConnection.id, values);
        message.success('更新成功');
      } else {
        await connectionsApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      loadConnections();
    } catch (error) {
      message.error(editingConnection ? '更新失败' : '创建失败');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">连接管理</h1>
        <Button type="primary" onClick={handleCreate}>
          新建连接
        </Button>
      </div>

      <Table
        loading={loading}
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
              <Tag color="blue" className="uppercase">
                {type}
              </Tag>
            ),
          },
          {
            title: '主机',
            dataIndex: 'host',
            key: 'host',
            render: (host: string, record: any) => host ? `${host}:${record.port}` : '-',
          },
          {
            title: '数据库',
            dataIndex: 'database',
            key: 'database',
          },
          {
            title: '只读',
            dataIndex: 'read_only',
            key: 'read_only',
            render: (readOnly: boolean) => readOnly ? '是' : '否',
          },
          {
            title: '状态',
            key: 'enabled',
            render: (record: Connection) => (
              <Tag color={record.enabled !== false ? 'green' : 'default'}>
                {record.enabled !== false ? '启用' : '禁用'}
              </Tag>
            ),
          },
          {
            title: '操作',
            key: 'action',
            render: (record: Connection) => (
              <Space>
                <Button size="small" onClick={() => handleTest(record.id)}>
                  测试
                </Button>
                <Button size="small" onClick={() => handleEdit(record)}>
                  编辑
                </Button>
                <Popconfirm
                  title="确定删除此连接吗？"
                  onConfirm={() => handleDelete(record.id)}
                >
                  <Button size="small" danger>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editingConnection ? '编辑连接' : '新建连接'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="name"
            label="连接名称"
            rules={[{ required: true, message: '请输入连接名称' }]}
          >
            <Input placeholder="例如：prod_mysql" />
          </Form.Item>

          <Form.Item
            name="type"
            label="数据库类型"
            rules={[{ required: true, message: '请选择数据库类型' }]}
          >
            <Select>
              <Option value="mysql">MySQL</Option>
              <Option value="postgresql">PostgreSQL</Option>
              <Option value="sqlserver">SQL Server</Option>
              <Option value="oracle">Oracle</Option>
              <Option value="sqlite">SQLite</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="host"
            label="主机地址"
            rules={[{ required: true, message: '请输入主机地址' }]}
          >
            <Input placeholder="例如：203.0.113.10" disabled={form.getFieldValue('type') === 'sqlite'} />
          </Form.Item>

          <Form.Item
            name="port"
            label="端口"
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="例如：3306"
              disabled={form.getFieldValue('type') === 'sqlite'}
            />
          </Form.Item>

          <Form.Item
            name="database"
            label="数据库名"
            rules={[{ required: true, message: '请输入数据库名' }]}
          >
            <Input placeholder="例如：production" />
          </Form.Item>

          <Form.Item
            name="username"
            label="用户名"
          >
            <Input placeholder="例如：root" disabled={form.getFieldValue('type') === 'sqlite'} />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
          >
            <Input.Password placeholder="YOUR_PASSWORD" disabled={form.getFieldValue('type') === 'sqlite'} />
          </Form.Item>

          <Form.Item
            name="pool_min"
            label="最小连接数"
            initialValue={2}
          >
            <InputNumber style={{ width: '100%' }} min={1} max={10} />
          </Form.Item>

          <Form.Item
            name="pool_max"
            label="最大连接数"
            initialValue={10}
          >
            <InputNumber style={{ width: '100%' }} min={1} max={50} />
          </Form.Item>

          <Form.Item
            name="read_only"
            label="只读模式"
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="enabled"
            label="启用"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>

          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setModalVisible(false)}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                确定
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
