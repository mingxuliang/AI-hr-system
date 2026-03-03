import React, { useEffect, useState } from 'react';
import { Card, Row, Col, List, Avatar, Typography, Spin, message } from 'antd';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  UserOutlined, 
  FileTextOutlined, 
  TeamOutlined, 
  BankOutlined,
  ArrowUpOutlined,
  ClockCircleOutlined,
  ArrowDownOutlined
} from '@ant-design/icons';
import request from '../../utils/request';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text } = Typography;

interface TrendData {
  date: string;
  count: number;
}

interface DashboardStats {
  active_positions: number;
  pending_resumes: number;
  today_interviews: number;
  total_questions: number;
  trends: {
    active_positions: number;
    pending_resumes: number;
    today_interviews: number;
    total_questions: number;
  };
  interview_trends?: TrendData[];
}

interface Activity {
  id: string;
  title: string;
  time: string;
  status: string;
  avatar_color: string;
  type: string;
}

const Dashboard: React.FC = () => {
  const [statsData, setStatsData] = useState<DashboardStats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await request.get('/dashboard/stats');
        setStatsData(res.stats);
        setActivities(res.recent_activities);
      } catch (error) {
        console.error(error);
        message.error('获取仪表盘数据失败');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const stats = [
    {
      title: "招聘中岗位",
      value: statsData?.active_positions || 0,
      icon: <UserOutlined style={{ fontSize: '20px', color: '#3B82F6' }} />,
      color: '#EFF6FF',
      trend: statsData?.trends.active_positions || 0
    },
    {
      title: "待筛选简历",
      value: statsData?.pending_resumes || 0,
      icon: <FileTextOutlined style={{ fontSize: '20px', color: '#EF4444' }} />,
      color: '#FEF2F2',
      trend: statsData?.trends.pending_resumes || 0
    },
    {
      title: "今日面试",
      value: statsData?.today_interviews || 0,
      icon: <TeamOutlined style={{ fontSize: '20px', color: '#10B981' }} />,
      color: '#ECFDF5',
      trend: statsData?.trends.today_interviews || 0
    },
    {
      title: "面试题库",
      value: statsData?.total_questions || 0,
      icon: <BankOutlined style={{ fontSize: '20px', color: '#8B5CF6' }} />,
      color: '#F5F3FF',
      trend: statsData?.trends.total_questions || 0
    }
  ];

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '400px' }}>
        <Spin size="large" tip="正在加载数据..." />
      </div>
    );
  }

    // 默认数据，避免图表空白
    const defaultTrends = Array.from({ length: 7 }, (_, i) => {
      return {
        date: dayjs().subtract(6 - i, 'day').format('YYYY-MM-DD'),
        count: 0
      };
    });

    return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <Title level={2} style={{ margin: 0, fontWeight: 700 }}>仪表盘</Title>
        <Text type="secondary">欢迎回来，查看今日招聘概况</Text>
      </div>

      <Row gutter={[24, 24]}>
        {stats.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card bordered={false} hoverable style={{ height: '100%', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <Text type="secondary" style={{ fontSize: '13px', fontWeight: 500 }}>{stat.title}</Text>
                  <div style={{ fontSize: '32px', fontWeight: 700, margin: '8px 0', lineHeight: 1, color: '#0F172A' }}>
                    {stat.value}
                  </div>
                  <div style={{ 
                    fontSize: '13px', 
                    fontWeight: 500,
                    display: 'flex', 
                    alignItems: 'center',
                    color: stat.trend > 0 ? '#10B981' : (stat.trend < 0 ? '#EF4444' : '#64748B')
                  }}>
                    {stat.trend > 0 ? <ArrowUpOutlined style={{ marginRight: 4 }} /> : (stat.trend < 0 ? <ArrowDownOutlined style={{ marginRight: 4 }} /> : null)}
                    {stat.trend !== 0 ? `${Math.abs(stat.trend)}% 较上周` : '无变化'}
                  </div>
                </div>
                <div style={{ 
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px', 
                  background: stat.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {stat.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={16}>
          <Card 
            title={<span style={{ fontSize: 16, fontWeight: 600 }}>近期面试趋势</span>} 
            bordered={false} 
            style={{ height: 450, borderRadius: '12px', border: '1px solid #E2E8F0' }}
          >
            <div style={{ height: 350, width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={statsData?.interview_trends && statsData.interview_trends.length > 0 ? statsData.interview_trends : defaultTrends}
                  margin={{
                    top: 10,
                    right: 30,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#64748B', fontSize: 12 }} 
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => dayjs(value).format('MM-DD')}
                  />
                  <YAxis 
                    tick={{ fill: '#64748B', fontSize: 12 }} 
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}
                    itemStyle={{ color: '#3B82F6', fontWeight: 600 }}
                    labelStyle={{ color: '#64748B', marginBottom: 4 }}
                    formatter={(value: number) => [`${value} 次面试`, '面试数量']}
                    labelFormatter={(label) => dayjs(label).format('YYYY年MM月DD日')}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#3B82F6" 
                    strokeWidth={2}
                    fillOpacity={1} 
                    fill="url(#colorCount)" 
                    activeDot={{ r: 6, strokeWidth: 0, fill: '#2563EB' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card 
            title={<span style={{ fontSize: 16, fontWeight: 600 }}>最新动态</span>} 
            bordered={false} 
            style={{ height: 450, overflow: 'hidden' }}
            bodyStyle={{ padding: '0 24px', overflowY: 'auto', height: 'calc(100% - 57px)' }}
          >
            <List
              itemLayout="horizontal"
              dataSource={activities}
              locale={{ emptyText: '暂无动态' }}
              renderItem={item => (
                <List.Item style={{ padding: '20px 0', borderBottom: '1px solid #F1F5F9' }}>
                  <List.Item.Meta
                    avatar={
                      <Avatar 
                        icon={<UserOutlined />} 
                        style={{ 
                          backgroundColor: item.avatar_color, 
                          color: '#fff',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
                        }} 
                      />
                    }
                    title={<span style={{ fontWeight: 500, color: '#0F172A' }}>{item.title}</span>}
                    description={
                      <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                        <ClockCircleOutlined style={{ color: '#94A3B8' }} /> 
                        <span style={{ color: '#64748B' }}>{dayjs(item.time).fromNow()}</span>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
