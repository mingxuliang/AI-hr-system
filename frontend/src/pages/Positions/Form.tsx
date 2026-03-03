import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Card, message, Select } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import request from '../../utils/request';

const PositionForm: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPosition(id);
    }
  }, [id]);

  const fetchPosition = async (positionId: string) => {
    try {
      const res = await request.get(`/positions/${positionId}`);
      form.setFieldsValue(res);
    } catch (error) {
      message.error('获取岗位详情失败');
    }
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      if (id) {
        await request.put(`/positions/${id}`, values);
        message.success('更新成功');
      } else {
        await request.post('/positions', values);
        message.success('创建成功');
      }
      navigate('/positions');
    } catch (error) {
      message.error('提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title={id ? '编辑岗位' : '新增岗位'}>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        initialValues={{ status: 'open' }}
      >
        <Form.Item
          name="title"
          label="岗位名称"
          rules={[{ required: true, message: '请输入岗位名称' }]}
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="department"
          label="所属部门"
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="location"
          label="工作地点"
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="salary_range"
          label="薪资范围"
        >
          <Input />
        </Form.Item>

        <Form.Item
          name="description"
          label="岗位职责"
          rules={[{ required: true, message: '请输入岗位职责' }]}
        >
          <Input.TextArea rows={4} />
        </Form.Item>

        <Form.Item
          name="requirements"
          label="任职要求"
        >
          <Input.TextArea rows={4} />
        </Form.Item>

        <Form.Item
          name="status"
          label="状态"
        >
          <Select>
            <Select.Option value="open">招聘中</Select.Option>
            <Select.Option value="closed">已关闭</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            提交
          </Button>
          <Button style={{ marginLeft: 8 }} onClick={() => navigate('/positions')}>
            取消
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default PositionForm;
