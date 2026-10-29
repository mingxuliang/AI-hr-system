import React, { useEffect, useState } from 'react';
import { Table, Button, Space, message, Modal, Form, Input, Select, Tag, Popconfirm } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import request from '../../utils/request';
import dayjs from 'dayjs';

interface CampusProject {
  id: string;
  school: string;
  company?: string;
  title: string;
  status: string;
  position_count: number;
  application_count: number;
  created_at: string;
}

interface PositionOption {
  id: string;
  title: string;
  department?: string;
  status?: string;
}

const CampusList: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<CampusProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<CampusProject | null>(null);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [form] = Form.useForm();

  const fetchList = async () => {
    setLoading(true);
    try {
      const res = await request.get('/campus');
      setData(res || []);
    } catch {
      message.error('加载校招项目失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchPositions = async () => {
    try {
      const res = await request.get('/positions', { params: { status: 'published', limit: 200 } });
      setPositions(res || []);
    } catch {
      message.error('加载已发布岗位失败');
    }
  };

  useEffect(() => {
    fetchList();
    fetchPositions();
  }, []);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = async (record: CampusProject) => {
    setEditing(record);
    setOpen(true);
    try {
      const detail = await request.get(`/campus/${record.id}`);
      form.setFieldsValue({
        school: detail.school,
        company: detail.company,
        title: detail.title,
        position_ids: (detail.positions || []).map((p: PositionOption) => p.id),
      });
    } catch {
      message.error('加载项目详情失败');
    }
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) {
        await request.put(`/campus/${editing.id}`, values);
        message.success('已保存');
      } else {
        const created = await request.post('/campus', values);
        message.success('校招项目已创建');
        setOpen(false);
        navigate(`/campus/${created.id}`);
        return;
      }
      setOpen(false);
      fetchList();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (record: CampusProject) => {
    try {
      await request.delete(`/campus/${record.id}`);
      message.success('已删除');
      fetchList();
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '删除失败');
    }
  };

  const columns = [
    { title: '学校', dataIndex: 'school', key: 'school' },
    { title: '公司', dataIndex: 'company', key: 'company', render: (text: string) => text || '-' },
    { title: '场次', dataIndex: 'title', key: 'title' },
    { title: '岗位数', dataIndex: 'position_count', key: 'position_count', width: 90 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) =>
        status === 'active' ? <Tag color="processing">进行中</Tag> : <Tag>已关闭</Tag>,
    },
    { title: '投递数', dataIndex: 'application_count', key: 'application_count', width: 90 },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: unknown, record: CampusProject) => (
        <Space>
          <Button type="link" onClick={() => navigate(`/campus/${record.id}`)}>详情</Button>
          <Button type="link" disabled={record.status !== 'active'} onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="删除后二维码将失效，已投递简历仍保留。确认删除？" onConfirm={() => onDelete(record)}>
            <Button type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="filter-bar">
        <div style={{ marginLeft: 'auto' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建校招</Button>
        </div>
      </div>
      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
      />
      <Modal
        title={editing ? '编辑校招' : '新建校招'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        confirmLoading={saving}
        destroyOnClose
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="school" label="学校" rules={[{ required: true, message: '请填写学校' }]}>
            <Input placeholder="例如：清华大学" maxLength={200} />
          </Form.Item>
          <Form.Item name="company" label="公司" rules={[{ required: true, message: '请填写公司' }]}>
            <Input placeholder="例如：星河智能" maxLength={200} />
          </Form.Item>
          <Form.Item name="title" label="场次标题" rules={[{ required: true, message: '请填写场次标题' }]}>
            <Input placeholder="例如：2026 秋招宣讲" maxLength={200} />
          </Form.Item>
          <Form.Item name="position_ids" label="招聘岗位" rules={[{ required: true, message: '请选择已发布岗位' }]}>
            <Select
              mode="multiple"
              placeholder="选择已发布岗位"
              optionFilterProp="label"
              options={positions.map((p) => ({
                value: p.id,
                label: p.department ? `${p.title} · ${p.department}` : p.title,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CampusList;
