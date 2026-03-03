import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Space, Typography, message, Result } from 'antd';
import request from '../../utils/request';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

type SystemSettings = {
  llm_base_url?: string | null;
  llm_model: string;
  llm_api_key_set: boolean;
  llm_api_key_last4?: string | null;
};

const SystemSettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [meta, setMeta] = useState<SystemSettings | null>(null);
  const [editingKey, setEditingKey] = useState(false);
  const role = (user as any)?.role?.value ?? (user as any)?.role;

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = (await request.get('/settings/system')) as SystemSettings;
      setMeta(res);
      form.setFieldsValue({
        llm_base_url: res.llm_base_url || undefined,
        llm_model: res.llm_model || 'qwen3.5-plus',
        llm_api_key: '',
      });
      setEditingKey(false);
    } catch (e) {
      const status = (e as any)?.response?.status;
      if (status === 404) {
        message.error('系统设置接口不存在：请确认后端已更新并重启');
      } else if (status === 403) {
        message.error('无权限访问系统设置');
      } else {
        message.error('获取系统设置失败');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (role !== 'admin') return;
    fetchSettings();
  }, [role, form]);

  const save = async () => {
    try {
      const values = await form.validateFields();
      const payload: any = {
        llm_base_url: values.llm_base_url || null,
        llm_model: values.llm_model,
      };
      if (values.llm_api_key && values.llm_api_key.trim()) {
        payload.llm_api_key = values.llm_api_key.trim();
      }
      setSaving(true);
      await request.put('/settings/system', payload);
      form.setFieldsValue({ llm_api_key: '' });
      await fetchSettings();
      message.success('系统设置已保存');
    } catch (e) {
      const status = (e as any)?.response?.status;
      if (status === 404) {
        message.error('系统设置接口不存在：请确认后端已更新并重启');
      } else if (status === 403) {
        message.error('无权限保存系统设置');
      } else if (status === 400) {
        message.error((e as any)?.response?.data?.detail || '参数不合法');
      } else {
        message.error('保存失败');
      }
    } finally {
      setSaving(false);
    }
  };

  if (role !== 'admin') {
    return (
      <Result
        status="403"
        title="无权限访问"
        subTitle="系统设置仅管理员可配置"
      />
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: 0 }}>系统设置</Title>
        <Text type="secondary">配置 AI 模型相关参数（仅管理员）</Text>
      </div>

      <Card
        title="模型配置"
        loading={loading}
        extra={
          <Space>
            <Button onClick={fetchSettings}>刷新</Button>
            <Button type="primary" onClick={save} loading={saving}>保存</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" autoComplete="off">
          <input type="text" name="username" autoComplete="username" style={{ display: 'none' }} />
          <input type="password" name="password" autoComplete="current-password" style={{ display: 'none' }} />
          <Form.Item name="llm_base_url" label="Base URL">
            <Input placeholder="例如：https://dashscope.aliyuncs.com/compatible-mode/v1" autoComplete="off" />
          </Form.Item>

          <Form.Item
            name="llm_model"
            label="Model"
            rules={[{ required: true, message: '请输入 Model' }]}
          >
            <Input placeholder="例如：qwen-plus / qwen3.5-plus" autoComplete="off" name="llm_model_field" />
          </Form.Item>

          <Form.Item
            name="llm_api_key"
            label="API Key"
            extra={
              <Space direction="vertical" size={4}>
                <Text type="secondary">
                  {meta?.llm_api_key_set
                    ? `已设置${meta.llm_api_key_last4 ? `（末 4 位：${meta.llm_api_key_last4}）` : ''}，不会回显完整 Key`
                    : '未设置，请先配置 API Key'}
                </Text>
                {meta?.llm_api_key_set && !editingKey ? (
                  <Button type="link" onClick={() => setEditingKey(true)} style={{ padding: 0, height: 'auto' }}>
                    更换 API Key
                  </Button>
                ) : null}
              </Space>
            }
            rules={[
              {
                validator: async (_, value) => {
                  const trimmed = (value || '').trim();
                  if (!meta?.llm_api_key_set) {
                    if (!trimmed) throw new Error('请先配置 API Key');
                    return;
                  }
                  if (editingKey && !trimmed) throw new Error('请输入新的 API Key');
                },
              },
            ]}
          >
            <Input.Password
              placeholder={meta?.llm_api_key_set && !editingKey ? '已设置（不会回显）' : '输入后会覆盖当前 Key'}
              autoComplete="new-password"
              name="llm_api_key_field"
              disabled={!!(meta?.llm_api_key_set && !editingKey)}
            />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default SystemSettingsPage;
