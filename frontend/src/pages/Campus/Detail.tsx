import React, { useEffect, useState } from 'react';
import { Button, Space, message, Tag, Table, Typography, Popconfirm, Card } from 'antd';
import { ArrowLeftOutlined, CopyOutlined, DownloadOutlined, StopOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { toDataURL } from 'qrcode';
import request from '../../utils/request';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface ApplicationRow {
  id: string;
  candidate_name?: string;
  contact?: string;
  school?: string;
  major?: string;
  position_title?: string;
  match_score?: number | null;
  parse_status?: string;
  created_at?: string;
}

interface CampusDetailData {
  id: string;
  school: string;
  company?: string;
  title: string;
  status: string;
  positions: { id: string; title: string }[];
  applications: ApplicationRow[];
}

const CampusDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<CampusDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [applyLink, setApplyLink] = useState('');

  const fetchDetail = async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const res = await request.get(`/campus/${id}`);
      setData(res);
    } catch {
      if (!silent) message.error('加载校招详情失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setApplyLink(`https://hr.aiwork-os.com/api/public/campus/${id}/page`);
  }, [id]);

  useEffect(() => {
    if (!applyLink) return;
    toDataURL(applyLink, { width: 480, margin: 2, errorCorrectionLevel: 'H' }).then(setQrUrl).catch(() => {
      message.error('二维码生成失败');
    });
  }, [applyLink]);

  useEffect(() => {
    if (!data?.applications?.some((item) => item.parse_status === 'processing')) return;
    const timer = window.setInterval(() => fetchDetail(true), 4000);
    return () => window.clearInterval(timer);
  }, [data, id]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(applyLink);
      message.success('链接已复制');
    } catch {
      message.error('复制失败，请手动复制');
    }
  };

  const downloadQr = () => {
    if (!qrUrl || !data) return;
    const a = document.createElement('a');
    a.href = qrUrl;
    a.download = `${data.school}-${data.title}-校招.png`;
    a.click();
  };

  const closeProject = async () => {
    if (!id) return;
    try {
      await request.post(`/campus/${id}/close`);
      message.success('已关闭，学生不能再投递');
      fetchDetail();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '关闭失败');
    }
  };

  const columns = [
    {
      title: '姓名',
      dataIndex: 'candidate_name',
      key: 'candidate_name',
      render: (text: string) => text || '解析中',
    },
    { title: '学校', dataIndex: 'school', key: 'school', render: (text: string) => text || '-' },
    { title: '专业', dataIndex: 'major', key: 'major', render: (text: string) => text || '-' },
    { title: '岗位', dataIndex: 'position_title', key: 'position_title', render: (text: string) => text || '-' },
    {
      title: '匹配分',
      dataIndex: 'match_score',
      key: 'match_score',
      width: 120,
      render: (score: number | null, record: ApplicationRow) => {
        if (record.parse_status === 'failed') {
          return <Tag color="error">解析失败</Tag>;
        }
        if (record.parse_status !== 'success' || score == null) {
          return <Tag color="processing">解析中</Tag>;
        }
        return <span style={{ color: '#2563EB', fontWeight: 600 }}>{score}分</span>;
      },
    },
    {
      title: '投递时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
  ];

  return (
    <div>
      <div className="filter-bar">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/campus')}>返回列表</Button>
        <div style={{ marginLeft: 'auto' }}>
          {data?.status === 'active' && (
            <Popconfirm title="关闭后学生扫码将不能继续投递。确认关闭？" onConfirm={closeProject}>
              <Button icon={<StopOutlined />}>关闭项目</Button>
            </Popconfirm>
          )}
        </div>
      </div>

      <Card loading={loading && !data} style={{ marginBottom: 16 }}>
        <Space align="start" size={24} wrap>
          {qrUrl ? (
            <img src={qrUrl} alt="校招投递二维码" width={240} height={240} style={{ border: '1px solid #E2E8F0', borderRadius: 8 }} />
          ) : (
            <div style={{ width: 240, height: 240, background: '#F8FAFC' }} />
          )}
          <div>
            <Space align="center">
              <Title level={4} style={{ margin: 0 }}>{data?.company ? `${data.company} · ` : ''}{data?.school} · {data?.title}</Title>
              {data?.status === 'active' ? <Tag color="processing">进行中</Tag> : <Tag>已关闭</Tag>}
            </Space>
            <div style={{ marginTop: 8, color: '#64748B' }}>
              岗位：{(data?.positions || []).map((p) => p.title).join('、') || '暂无'}
            </div>
            <div style={{ marginTop: 8 }}>
              <Text copyable={{ text: applyLink }}>{applyLink || '正在生成可扫描链接...'}</Text>
            </div>
            <div style={{ marginTop: 8, color: '#64748B', maxWidth: 520 }}>
              这是国内公网地址，手机用任何网络都能直接打开。请重新下载二维码后再扫描。
            </div>
            <Space style={{ marginTop: 16 }}>
              <Button type="primary" icon={<DownloadOutlined />} onClick={downloadQr} disabled={!qrUrl}>下载二维码</Button>
              <Button icon={<CopyOutlined />} onClick={copyLink}>复制链接</Button>
            </Space>
          </div>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={data?.applications || []}
        loading={loading && !data}
        rowKey="id"
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        onRow={(record) => ({
          onClick: () => navigate(`/resumes/${record.id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
  );
};

export default CampusDetail;
