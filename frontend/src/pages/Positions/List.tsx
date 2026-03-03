import React, { useEffect, useState } from 'react';
import { Table, Button, Space, message, Modal, Form, Input, Select, Tag, Tooltip, Typography, Drawer, Descriptions, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, GlobalOutlined, StopOutlined, CopyOutlined } from '@ant-design/icons';
import request from '../../utils/request';

const { Title, Text } = Typography;

const PositionsList: React.FC = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<any>(null);
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const [searchTitle, setSearchTitle] = useState<string>('');
  const [searchStatus, setSearchStatus] = useState<string | undefined>(undefined);

  const fetchPositions = async () => {
    setLoading(true);
    try {
      const res = await request.get('/positions', {
          params: {
              title: searchTitle,
              status: searchStatus
          }
      });
      setData(res);
    } catch (error) {
      message.error('获取岗位列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
  }, [searchTitle, searchStatus]);

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ status: 'open' });
    setIsModalVisible(true);
  };

  const handleEdit = async (record: any) => {
    setEditingId(record.id);
    try {
      const res = await request.get(`/positions/${record.id}`);
      form.setFieldsValue(res);
      setIsModalVisible(true);
    } catch (error) {
      message.error('获取岗位详情失败');
    }
  };

  const handleView = async (record: any) => {
    try {
      const res = await request.get(`/positions/${record.id}`);
      setViewingRecord(res);
      setIsDrawerVisible(true);
    } catch (error) {
      message.error('获取岗位详情失败');
    }
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个岗位吗？',
      okText: '确认',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await request.delete(`/positions/${id}`);
          message.success('删除成功');
          fetchPositions();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handlePublish = async (id: string, publish: boolean) => {
    try {
      await request.put(`/positions/${id}`, { status: publish ? 'published' : 'closed' });
      message.success(publish ? '岗位已发布' : '岗位已下架');
      fetchPositions();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleCopyLink = (id: string) => {
    const url = `${window.location.origin}/public/jobs/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      message.success('岗位链接已复制');
    });
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingId) {
        await request.put(`/positions/${editingId}`, values);
        message.success('更新成功');
      } else {
        await request.post('/positions', values);
        message.success('创建成功');
      }
      setIsModalVisible(false);
      fetchPositions();
    } catch (error) {
      // Validation error
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { 
      title: '岗位名称', 
      dataIndex: 'title', 
      key: 'title',
      render: (text: string) => <span style={{ fontWeight: 500, color: '#0F172A' }}>{text}</span>
    },
    { title: '部门', dataIndex: 'department', key: 'department' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        let text = '已关闭';
        if (status === 'open') {
            color = 'warning';
            text = '待发布';
        } else if (status === 'published') {
            color = 'processing';
            text = '招聘中';
        }
        return <Tag color={color} style={{ border: 'none' }}>{text}</Tag>;
      }
    },
    { 
      title: '创建时间', 
      dataIndex: 'created_at', 
      key: 'created_at',
      render: (date: string) => <span style={{ color: '#64748B' }}>{new Date(date).toLocaleDateString()}</span>
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record: any) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="text" icon={<EyeOutlined style={{ color: '#3B82F6' }} />} onClick={() => handleView(record)} />
          </Tooltip>
          {record.status === 'published' ? (
             <Tooltip title="下架岗位">
                <Button type="text" icon={<StopOutlined style={{ color: '#EF4444' }} />} onClick={() => handlePublish(record.id, false)} />
             </Tooltip>
          ) : (
             <Tooltip title="发布岗位">
                <Button type="text" icon={<GlobalOutlined style={{ color: '#10B981' }} />} onClick={() => handlePublish(record.id, true)} />
             </Tooltip>
          )}
          {record.status === 'published' && (
             <Tooltip title="复制链接">
                <Button type="text" icon={<CopyOutlined />} onClick={() => handleCopyLink(record.id)} />
             </Tooltip>
          )}
          <Tooltip title="编辑">
            <Button type="text" icon={<EditOutlined style={{ color: '#64748B' }} />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title="删除">
            <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>岗位管理</Title>
          <Text type="secondary">管理企业的招聘岗位信息</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} size="large" style={{ borderRadius: '8px' }}>新增岗位</Button>
      </div>
      
      <div style={{ marginBottom: 24, padding: '24px', background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <Input 
              placeholder="搜索岗位名称" 
              prefix={<EyeOutlined style={{ color: '#94A3B8' }} />} 
              style={{ width: 300 }} 
              allowClear
              onChange={(e) => setSearchTitle(e.target.value)}
          />
          <Select
              placeholder="岗位状态"
              style={{ width: 150 }}
              allowClear
              onChange={(value) => setSearchStatus(value)}
          >
              <Select.Option value="open">待发布</Select.Option>
              <Select.Option value="published">招聘中</Select.Option>
              <Select.Option value="closed">已关闭</Select.Option>
          </Select>
      </div>
      
      <Table 
        columns={columns} 
        dataSource={data} 
        loading={loading} 
        rowKey="id" 
        pagination={{ pageSize: 10, showSizeChanger: true }}
      />

      <Modal
        title={editingId ? '编辑岗位' : '新增岗位'}
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        confirmLoading={submitting}
        width={700}
        centered
        destroyOnClose
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="title"
            label="岗位名称"
            rules={[{ required: true, message: '请输入岗位名称' }]}
          >
            <Input placeholder="例如：高级前端工程师" size="large" />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <Form.Item
              name="department"
              label="所属部门"
            >
              <Input placeholder="例如：研发部" size="large" />
            </Form.Item>

            <Form.Item
              name="location"
              label="工作地点"
            >
              <Input placeholder="例如：北京" size="large" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <Form.Item
              name="salary_range"
              label="薪资范围"
            >
              <Input placeholder="例如：20k-30k" size="large" />
            </Form.Item>

            <Form.Item
              name="status"
              label="状态"
            >
              <Select size="large">
                <Select.Option value="open">待发布</Select.Option>
                <Select.Option value="published">招聘中</Select.Option>
                <Select.Option value="closed">已关闭</Select.Option>
              </Select>
            </Form.Item>
          </div>

          <Form.Item
            name="description"
            label="岗位职责"
            rules={[{ required: true, message: '请输入岗位职责' }]}
          >
            <Input.TextArea rows={4} placeholder="请输入详细的岗位职责描述" showCount maxLength={1000} style={{ padding: '8px 12px' }} />
          </Form.Item>

          <Form.Item
            name="requirements"
            label="任职要求"
          >
            <Input.TextArea rows={4} placeholder="请输入任职资格要求" showCount maxLength={1000} style={{ padding: '8px 12px' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title="岗位详情"
        width={800}
        onClose={() => setIsDrawerVisible(false)}
        open={isDrawerVisible}
        extra={
          <Space>
            <Button onClick={() => {
              setIsDrawerVisible(false);
              handleEdit(viewingRecord);
            }}>编辑</Button>
            <Button type="primary" onClick={() => setIsDrawerVisible(false)}>关闭</Button>
          </Space>
        }
      >
        {viewingRecord && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <Title level={3} style={{ margin: 0 }}>{viewingRecord.title}</Title>
              <div style={{ marginTop: 8 }}>
                <Tag color={viewingRecord.status === 'open' ? 'success' : 'default'} style={{ border: 'none' }}>
                  {viewingRecord.status === 'open' ? '招聘中' : '已关闭'}
                </Tag>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  创建于 {new Date(viewingRecord.created_at).toLocaleDateString()}
                </Text>
              </div>
            </div>

            <Descriptions column={2} size="middle" labelStyle={{ color: '#64748B' }} contentStyle={{ fontWeight: 500, color: '#0F172A' }}>
              <Descriptions.Item label="所属部门">{viewingRecord.department || '-'}</Descriptions.Item>
              <Descriptions.Item label="工作地点">{viewingRecord.location || '-'}</Descriptions.Item>
              <Descriptions.Item label="薪资范围">{viewingRecord.salary_range || '-'}</Descriptions.Item>
            </Descriptions>

            <Divider style={{ margin: '24px 0' }} />

            <div style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 12 }}>岗位职责</Title>
              <div style={{ 
                background: '#F8FAFC', 
                padding: '16px', 
                borderRadius: '8px', 
                color: '#334155',
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap'
              }}>
                {viewingRecord.description}
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 12 }}>任职要求</Title>
              <div style={{ 
                background: '#F8FAFC', 
                padding: '16px', 
                borderRadius: '8px', 
                color: '#334155',
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap'
              }}>
                {viewingRecord.requirements || '暂无要求'}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default PositionsList;
