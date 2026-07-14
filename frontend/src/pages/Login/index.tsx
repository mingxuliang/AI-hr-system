import React from 'react';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined, ThunderboltOutlined, BarChartOutlined, NodeIndexOutlined } from '@ant-design/icons';
import request from '../../utils/request';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const features = [
  {
    icon: <ThunderboltOutlined />,
    title: 'AI 智能筛选',
    desc: '自动解析简历，精准匹配岗位要求，大幅提升筛选效率',
  },
  {
    icon: <NodeIndexOutlined />,
    title: '全流程管理',
    desc: '简历 → 面试 → 笔试 → Offer，招聘全链路一站式覆盖',
  },
  {
    icon: <BarChartOutlined />,
    title: '数据驱动决策',
    desc: '实时招聘漏斗与趋势分析，让每一个招聘决策有据可依',
  },
];

const Login: React.FC = () => {
  const { login, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const formData = new URLSearchParams();
      formData.append('username', values.email);
      formData.append('password', values.password);
      const res = await request.post('/auth/token', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      await login((res as any).access_token);
      message.success('登录成功');
      navigate('/dashboard', { replace: true });
    } catch {
      message.error('账号或密码错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      {/* ── Left panel ── */}
      <div className="login-left">
        {/* Decorative blobs */}
        <div className="login-blob login-blob-1" />
        <div className="login-blob login-blob-2" />

        {/* Brand */}
        <div className="login-brand">
          <span className="brand-mark brand-mark--login" aria-hidden="true">HR</span>
          <span className="login-brand-name">AI-HR智能招聘系统</span>
        </div>

        {/* Feature list — middle */}
        <div className="login-features">
          {features.map((f) => (
            <div key={f.title} className="login-feature-item">
              <div className="login-feature-icon">{f.icon}</div>
              <div>
                <div className="login-feature-title">{f.title}</div>
                <div className="login-feature-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="login-right">
        <div className="login-form-wrap">
          {/* Title */}
          <div className="login-form-header">
            <h2 className="login-form-title">账号登录</h2>
          </div>

          <Form name="login" onFinish={onFinish} layout="vertical" size="large">
            <Form.Item
              name="email"
              label={<span className="login-label">邮箱账号</span>}
              rules={[{ required: true, message: '请输入邮箱' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#94A3B8' }} />}
                placeholder="请输入邮箱地址"
                className="login-input"
              />
            </Form.Item>

            <Form.Item
              name="password"
              label={<span className="login-label">登录密码</span>}
              rules={[{ required: true, message: '请输入密码' }]}
              style={{ marginBottom: 32 }}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#94A3B8' }} />}
                placeholder="请输入密码"
                className="login-input"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                className="login-submit-btn"
                block
              >
                {loading ? '登录中...' : '登 录'}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>
    </div>
  );
};

export default Login;
