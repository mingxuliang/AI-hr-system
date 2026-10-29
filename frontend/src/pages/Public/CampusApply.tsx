import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Typography, Tag, Button, Form, Input, Upload, message, Result, Spin, Radio } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import request from '../../utils/request';
import { RESUME_ACCEPT, RESUME_FORMAT_HINT, resumeFileError } from '../../utils/resumeFile';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { Title, Paragraph } = Typography;

interface PublicPosition {
  id: string;
  title: string;
  department?: string;
  location?: string;
  salary_range?: string;
  description?: string;
  requirements?: string;
}

interface PublicCampus {
  id: string;
  school: string;
  company?: string;
  title: string;
  status: string;
  accepting: boolean;
  positions: PublicPosition[];
}

const CampusApply: React.FC = () => {
  const { id } = useParams();
  const [project, setProject] = useState<PublicCampus | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form] = Form.useForm();
  const positionId = Form.useWatch('position_id', form);
  const selected = project?.positions?.find((item) => item.id === positionId);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    request.get(`/public/campus/${id}`)
      .then((res: PublicCampus) => setProject(res))
      .catch((error: any) => {
        if (error?.response?.status === 404) setMissing(true);
        else setLoadError(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const onFinish = async (values: any) => {
    const raw = values.file?.file?.originFileObj || values.file?.file;
    if (!raw) {
      message.error('请上传简历');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('candidate_name', values.candidate_name);
      formData.append('major', values.major);
      formData.append('contact', values.contact);
      formData.append('position_id', values.position_id);
      formData.append('file', raw);
      await request.post(`/public/campus/${id}/apply`, formData, {
        timeout: 60000,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSubmitted(true);
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      message.error(typeof detail === 'string' ? detail : '投递失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#F8FAFC' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: 24 }}>
        <Result status="warning" title="暂时无法打开投递页" subTitle="请检查网络后重试" />
      </div>
    );
  }

  if (missing || !project) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: 24 }}>
        <Result status="404" title="校招不存在" subTitle="请确认二维码是否正确" />
      </div>
    );
  }

  if (!project.accepting) {
    return (
      <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: 24 }}>
        <Result status="info" title="本次校招已结束" subTitle={`${project.school} · ${project.title} 暂不接受投递`} />
      </div>
    );
  }

  if (submitted) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#F8FAFC', padding: 24 }}>
        <Card style={{ width: '100%', maxWidth: 480, borderRadius: 16 }}>
          <Result status="success" title="投递成功" subTitle="简历已提交，我们会尽快完成评估。" />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', padding: '24px 16px 40px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <Card bordered={false} style={{ borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
          {project.company && (
            <Paragraph style={{ color: '#2563EB', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>
              {project.company}
            </Paragraph>
          )}
          <Title level={3} style={{ marginTop: 0 }}>{project.school}</Title>
          <Paragraph style={{ color: '#64748B', marginBottom: 8 }}>{project.title}</Paragraph>
          <Tag color="blue">校招投递</Tag>

          <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 24 }} size="large">
            <Form.Item name="candidate_name" label="姓名" rules={[{ required: true, message: '请填写姓名' }]}>
              <Input placeholder="请输入真实姓名" />
            </Form.Item>
            <Form.Item name="major" label="专业" rules={[{ required: true, message: '请填写专业' }]}>
              <Input placeholder="例如：计算机科学与技术" />
            </Form.Item>
            <Form.Item
              name="contact"
              label="手机号"
              rules={[
                { required: true, message: '请填写手机号' },
                { pattern: /^[0-9+\-\s]{6,20}$/, message: '请填写有效手机号' },
              ]}
            >
              <Input placeholder="用于查重和联系" inputMode="tel" />
            </Form.Item>
            <Form.Item name="position_id" label="投递岗位" rules={[{ required: true, message: '请选择岗位' }]}>
              <Radio.Group style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {project.positions.map((item) => (
                  <Radio key={item.id} value={item.id}>{item.title}</Radio>
                ))}
              </Radio.Group>
            </Form.Item>

            {selected && (
              <div style={{ background: '#F1F5F9', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selected.department && <Tag>{selected.department}</Tag>}
                  {selected.location && <Tag>{selected.location}</Tag>}
                  {selected.salary_range && <Tag>{selected.salary_range}</Tag>}
                </div>
                <Title level={5}>岗位职责</Title>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.description || '暂无描述'}</ReactMarkdown>
                <Title level={5}>任职要求</Title>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{selected.requirements || '暂无要求'}</ReactMarkdown>
              </div>
            )}

            <Form.Item
              name="file"
              label="简历附件"
              rules={[{ required: true, message: '请上传简历' }]}
              extra={RESUME_FORMAT_HINT}
            >
              <Upload
                maxCount={1}
                accept={RESUME_ACCEPT}
                beforeUpload={(file) => {
                  const error = resumeFileError(file);
                  if (error) {
                    message.error(error);
                    return Upload.LIST_IGNORE;
                  }
                  return false;
                }}
              >
                <Button icon={<UploadOutlined />}>上传简历</Button>
              </Upload>
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} block>
              提交投递
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default CampusApply;
