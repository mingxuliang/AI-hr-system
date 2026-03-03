import React, { useEffect, useState } from 'react';
import { Table, Button, Space, message, Tag, Modal, Form, Input, Select, Card, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import request from '../../utils/request';

const { Title, Text } = Typography;

const UsersList: React.FC = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await request.get('/auth/users');
      setData(res);
    } catch (error) {
      message.error('获取用户列表失败（权限不足？）');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAdd = () => {
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      await request.post('/auth/users', values);
      message.success('创建用户成功');
      setIsModalVisible(false);
      fetchUsers();
    } catch (error) {
      message.error('创建用户失败');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: '姓名', dataIndex: 'full_name', key: 'full_name' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { 
      title: '角色', 
      dataIndex: 'role', 
      key: 'role',
      render: (role: string) => {
        let color = 'default';
        if (role === 'admin') color = 'red';
        if (role === 'hr') color = 'blue';
        if (role === 'interviewer') color = 'green';
        return <Tag color={color}>{role.toUpperCase()}</Tag>;
      }
    },
    { 
      title: '状态', 
      dataIndex: 'is_active', 
      key: 'is_active',
      render: (active: boolean) => <Tag color={active ? 'success' : 'error'}>{active ? 'Active' : 'Inactive'}</Tag>
    }
  ];

  return (
    <div>
      <div style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>用户管理</Title>
          <Text type="secondary">管理系统用户及权限分配</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchUsers}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增用户</Button>
        </Space>
      </div>

      <Table 
        columns={columns} 
        dataSource={data} 
        loading={loading} 
        rowKey="id" 
      />

      <Modal
        title="新增用户"
        open={isModalVisible}
        onOk={handleOk}
        onCancel={() => setIsModalVisible(false)}
        confirmLoading={submitting}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="full_name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="interviewer" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="admin">管理员 (Admin)</Select.Option>
              <Select.Option value="hr">HR</Select.Option>
              <Select.Option value="interviewer">面试官 (Interviewer)</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersList;
