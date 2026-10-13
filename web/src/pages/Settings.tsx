import { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Switch, Button, message } from 'antd';
import { settingsApi } from '@/services/api';

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const data = await settingsApi.get();
      form.setFieldsValue(data);
    } catch (error) {
      message.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: any) {
    try {
      await settingsApi.update(values);
      message.success('设置已保存');
    } catch (error) {
      message.error('保存设置失败');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">系统设置</h1>

      <Card title="查询设置">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            max_query_rows: 10000,
            default_query_limit: 100,
            query_timeout_ms: 30000,
          }}
        >
          <Form.Item
            name="max_query_rows"
            label="单次查询最大返回行数"
          >
            <InputNumber style={{ width: '100%' }} min={100} max={100000} step={100} />
          </Form.Item>

          <Form.Item
            name="default_query_limit"
            label="默认查询限制"
          >
            <InputNumber style={{ width: '100%' }} min={10} max={1000} step={10} />
          </Form.Item>

          <Form.Item
            name="query_timeout_ms"
            label="查询超时时间 (毫秒)"
          >
            <InputNumber style={{ width: '100%' }} min={1000} max={300000} step={1000} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card title="审计日志设置">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            audit_enabled: true,
            audit_retention_days: 30,
          }}
        >
          <Form.Item
            name="audit_enabled"
            label="启用审计日志"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>

          <Form.Item
            name="audit_retention_days"
            label="日志保留天数"
          >
            <InputNumber style={{ width: '100%' }} min={1} max={365} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存设置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
