import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, Space, Spin, Tag, Typography, message, Table } from 'antd';
import { useParams } from 'react-router-dom';
import { PlayCircleOutlined, SendOutlined } from '@ant-design/icons';
import request from '../../utils/request';
import CodeEditor from '../../components/CodeEditor';

const { Title, Paragraph, Text } = Typography;

const PublicCodingTest: React.FC = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [test, setTest] = useState<any>(null);
  const [code, setCode] = useState('');
  const [runResult, setRunResult] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [form] = Form.useForm();

  const storageKey = useMemo(() => (token ? `codingtest:${token}:code` : ''), [token]);

  const fetchTest = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await request.get(`/public/coding-tests/${token}`);
      setTest(res);
      const saved = storageKey ? localStorage.getItem(storageKey) : null;
      setCode(saved || res.starter_code || '');
    } catch (e) {
      message.error('笔试链接无效或已关闭');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTest();
  }, [token]);

  useEffect(() => {
    if (!storageKey) return;
    localStorage.setItem(storageKey, code || '');
  }, [storageKey, code]);

  const handleRun = async () => {
    if (!token) return;
    if (!code.trim()) {
      message.error('请先填写代码');
      return;
    }
    setRunning(true);
    try {
      const res = await request.post(`/public/coding-tests/${token}/run`, {
        code,
        language: test?.language || 'javascript',
      });
      setRunResult(res);
      message.success(res.passed ? '全部用例通过' : '部分用例未通过');
    } catch (e) {
      message.error('运行失败');
    } finally {
      setRunning(false);
    }
  };

  const fetchSubmission = async (submissionId: string) => {
    if (!token) return;
    const res = await request.get(`/public/coding-tests/${token}/submissions/${submissionId}`);
    setSubmission(res);
    return res;
  };

  const handleSubmit = async () => {
    if (!token) return;
    if (!code.trim()) {
      message.error('请先填写代码');
      return;
    }
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const res = await request.post(`/public/coding-tests/${token}/submit`, {
        candidate_name: values.candidate_name,
        candidate_email: values.candidate_email,
        code,
        language: test?.language || 'javascript',
      });
      setSubmission(res);
      message.success('提交成功');
    } catch (e) {
      if ((e as any)?.errorFields) return;
      message.error('提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const resultRows = useMemo(() => {
    const results = runResult?.results || submission?.run_result?.results || [];
    return results.map((r: any) => ({ ...r, key: r.index }));
  }, [runResult, submission]);

  if (loading && !test) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!test) return null;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px' }}>
      <Card style={{ borderRadius: 16 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={3} style={{ marginBottom: 4 }}>{test.title}</Title>
            <Space>
              <Tag color="blue" style={{ border: 'none' }}>算法笔试</Tag>
              <Tag style={{ border: 'none' }}>{test.difficulty || 'intermediate'}</Tag>
              <Tag style={{ border: 'none' }}>{(test.language || 'javascript').toUpperCase()}</Tag>
            </Space>
          </div>

          <Card size="small" style={{ background: '#F8FAFC', borderRadius: 12 }}>
            <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{test.description}</Paragraph>
          </Card>

          <Form form={form} layout="inline">
            <Form.Item name="candidate_name" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input placeholder="姓名" style={{ width: 200 }} />
            </Form.Item>
            <Form.Item name="candidate_email" rules={[{ required: true, message: '请输入邮箱' }]}>
              <Input placeholder="邮箱" style={{ width: 260 }} />
            </Form.Item>
          </Form>

          <div>
            <Space style={{ marginBottom: 12 }}>
              <Button icon={<PlayCircleOutlined />} onClick={handleRun} loading={running}>运行用例</Button>
              <Button type="primary" icon={<SendOutlined />} onClick={handleSubmit} loading={submitting}>提交作答</Button>
              {(runResult || submission?.run_result) && (
                <Space>
                  <Tag color={(runResult?.passed ?? submission?.run_result?.passed) ? 'green' : 'red'} style={{ border: 'none' }}>
                    {(runResult?.passed ?? submission?.run_result?.passed) ? '通过' : '未通过'}
                  </Tag>
                  <Text type="secondary">得分 {(runResult?.score ?? submission?.run_result?.score) ?? 0}</Text>
                </Space>
              )}
            </Space>

            <CodeEditor
              value={code}
              onChange={setCode}
              language={test?.language || 'javascript'}
              height={420}
            />
          </div>

          {(runResult?.error || submission?.run_result?.error) && (
            <Card size="small" style={{ borderRadius: 12 }} title="运行错误">
              <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{runResult?.error || submission?.run_result?.error}</Paragraph>
            </Card>
          )}

          {resultRows.length > 0 && (
            <Card size="small" style={{ borderRadius: 12 }} title="测试用例结果">
              <Table
                dataSource={resultRows}
                pagination={false}
                columns={[
                  { title: '#', dataIndex: 'index', width: 60 },
                  {
                    title: '状态',
                    dataIndex: 'ok',
                    width: 90,
                    render: (ok: boolean) => ok ? <Tag color="green" style={{ border: 'none' }}>通过</Tag> : <Tag color="red" style={{ border: 'none' }}>失败</Tag>,
                  },
                  { title: '输入', dataIndex: 'input', render: (v: any) => <Text code>{JSON.stringify(v)}</Text> },
                  { title: '期望', dataIndex: 'expected', render: (v: any) => <Text code>{JSON.stringify(v)}</Text> },
                  { title: '实际', dataIndex: 'actual', render: (v: any) => <Text code>{JSON.stringify(v)}</Text> },
                ]}
              />
            </Card>
          )}
        </Space>
      </Card>
    </div>
  );
};

export default PublicCodingTest;
