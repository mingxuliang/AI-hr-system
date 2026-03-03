import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Tag, Button, Row, Col, Typography, message, Divider, Spin, Progress, Modal, Form, Input, Space } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import request from '../../utils/request';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DownloadOutlined, FilePdfOutlined, FileWordOutlined, ArrowLeftOutlined, CloseCircleOutlined, EditOutlined, SaveOutlined, ReloadOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

const ResumeDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [resume, setResume] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (id) {
      fetchResume(id);
    }
  }, [id]);

  const fetchResume = async (resumeId: string) => {
    setLoading(true);
    try {
      const res = await request.get(`/resumes/${resumeId}`) as any;
      setResume(res);
      form.setFieldsValue({
          candidate_name: res.candidate_name,
          email: res.email,
          contact: res.contact,
          highest_degree: res.parsed_data?.highest_degree,
          school: res.parsed_data?.school,
          major: res.parsed_data?.major,
          years_of_experience: res.parsed_data?.years_of_experience,
          recent_company: res.parsed_data?.recent_company
      });
    } catch (error) {
      message.error('获取简历详情失败');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
      try {
          const values = await form.validateFields();
          // Update basic info in Resume model
          // Update parsed_data if needed (backend logic might need adjustment or we update parsed_data json)
          // For now, let's assume backend updates Resume fields. 
          // Note: parsed_data fields are JSON, updating them via API might require specific handling if they are nested.
          // However, our requirement is mainly basic info.
          
          // Construct payload. 
          // Since our backend ResumeUpdate schema now supports candidate_name, email, contact directly.
          // But highest_degree etc are inside parsed_data. 
          // We might need to update parsed_data as well.
          
          const currentParsedData = resume.parsed_data || {};
          const newParsedData = {
              ...currentParsedData,
              highest_degree: values.highest_degree,
              school: values.school,
              major: values.major,
              years_of_experience: values.years_of_experience,
              recent_company: values.recent_company
          };
          
          // Actually, our backend update_resume logic (in service) uses `update_data = resume.dict(exclude_unset=True)` and `setattr`.
          // And ResumeUpdate schema does NOT have parsed_data.
          // So we can only update candidate_name, email, contact directly.
          // To update parsed_data, we need to add it to ResumeUpdate schema or handle it.
          // Let's add parsed_data to ResumeUpdate in backend first?
          // Wait, I already checked backend schema, it DOES NOT have parsed_data in ResumeUpdate.
          // But I can add it now.
          
          await request.put(`/resumes/${id}`, {
              candidate_name: values.candidate_name,
              email: values.email,
              contact: values.contact,
              // We need backend support for parsed_data update or we just update what we can.
              // For now, let's update what we added to schema. 
              // If user wants to edit school/degree, we should support it.
              // Let's assume we will add parsed_data to backend schema in next step if needed, 
              // or we just send it and see if backend accepts dynamic fields (it likely won't if using Pydantic).
              
              // Actually, the previous step only added candidate_name, contact, email. 
              // So I should only allow editing those or update backend schema again.
              // The user said "basic information", usually implies name/email/phone.
              // But the UI shows degree/school etc.
              // Let's stick to name/email/phone for now, and maybe parsed fields if I update backend.
          });
          
          message.success('更新成功');
          setIsEditing(false);
          fetchResume(id!);
      } catch (error) {
          message.error('更新失败');
      }
  };
  
  // Helper to get status color/text
  const getStatusInfo = (status: string, parseStatus?: string) => {
      if (parseStatus === 'failed') return { text: '解析失败', color: 'error' };
      if (parseStatus === 'processing') return { text: '解析中', color: 'processing' };
      const statusMap: Record<string, any> = {
        pending_screening: { text: '解析中', color: 'processing' },
        pending_review: { text: '待评审', color: 'warning' },
        pending_interview: { text: '待面试', color: 'geekblue' },
        completed: { text: '已完成', color: 'success' },
        rejected: { text: '已淘汰', color: 'error' },
      };
      return statusMap[status] || { text: status, color: 'default' };
  };

  if (loading || !resume) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  const parsedData = resume.parsed_data || {};
  const fileUrl = resume.file_path ? `/${resume.file_path}` : '';
  const isPdf = fileUrl.toLowerCase().endsWith('.pdf');
  const statusInfo = getStatusInfo(resume.status, resume.parse_status);

  const handleReparse = () => {
    Modal.confirm({
      title: '重新解析简历',
      content: '将重新调用 AI 解析该简历，并覆盖现有解析结果。',
      okText: '确认',
      cancelText: '取消',
      onOk: async () => {
        try {
          await request.post(`/resumes/${id}/reparse`);
          message.success('已开始重新解析');
          fetchResume(id!);
        } catch (error) {
          message.error('重新解析失败');
        }
      },
    });
  };

  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/resumes')}>返回列表</Button>
      </div>
      <div style={{ flex: 1, display: 'flex', gap: '24px', overflow: 'hidden' }}>
      {/* Left: File Preview */}
      <div style={{ flex: 1, background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC' }}>
          <Title level={5} style={{ margin: 0 }}>简历原件预览</Title>
          <Button type="primary" icon={<DownloadOutlined />} href={fileUrl} target="_blank" download>
            下载原件
          </Button>
        </div>
        <div style={{ flex: 1, background: '#F1F5F9' }}>
          {fileUrl ? (
            isPdf ? (
              <iframe 
                src={fileUrl} 
                style={{ width: '100%', height: '100%', border: 'none' }} 
                title="Resume Preview"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748B' }}>
                <FileWordOutlined style={{ fontSize: '64px', marginBottom: '16px', color: '#3B82F6' }} />
                <Text type="secondary" style={{ marginBottom: '16px' }}>该文件格式暂不支持在线预览，请下载后查看</Text>
                <Button type="primary" href={fileUrl} download>下载文件</Button>
              </div>
            )
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8' }}>
              暂无文件
            </div>
          )}
        </div>
      </div>

      {/* Right: AI Analysis & Details */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
        <Card 
          bordered={false} 
          style={{ borderRadius: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #E2E8F0' }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div style={{ flex: 1 }}>
              {isEditing ? (
                  <Form form={form} layout="inline">
                      <Form.Item name="candidate_name" style={{ marginBottom: 0 }}>
                          <Input placeholder="姓名" style={{ fontSize: 24, fontWeight: 600, width: 150 }} />
                      </Form.Item>
                  </Form>
              ) : (
                  <Title level={2} style={{ margin: 0 }}>{resume.candidate_name}</Title>
              )}
              
              <div style={{ marginTop: 8 }}>
                {isEditing ? (
                    <Form form={form} layout="inline" style={{ marginTop: 8 }}>
                         <Form.Item name="email" style={{ marginBottom: 0 }}>
                             <Input placeholder="邮箱" style={{ width: 200 }} />
                         </Form.Item>
                         <Form.Item name="contact" style={{ marginBottom: 0 }}>
                             <Input placeholder="电话" style={{ width: 150 }} />
                         </Form.Item>
                    </Form>
                ) : (
                    <>
                        <Text type="secondary" style={{ marginRight: 16 }}>{resume.email}</Text>
                        <Text type="secondary">{resume.contact}</Text>
                    </>
                )}
              </div>
            </div>
            
            <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <Text type="secondary" style={{ fontSize: 12 }}>匹配度</Text>
                <div style={{ marginTop: 4 }}>
                  <Progress 
                    type="circle" 
                    percent={resume.match_score} 
                    width={50} 
                    format={percent => <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{percent}%</span>} 
                    strokeColor={resume.match_score >= 80 ? '#10B981' : resume.match_score >= 60 ? '#F59E0B' : '#EF4444'} 
                  />
                </div>
              </div>
              <div>
                <Tag color={statusInfo.color} style={{ fontSize: 14, padding: '4px 10px', margin: 0 }}>
                  {statusInfo.text}
                </Tag>
              </div>
              
              {!isEditing ? (
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={handleReparse} disabled={resume?.parse_status === 'processing'}>重新解析</Button>
                    <Button icon={<EditOutlined />} onClick={() => setIsEditing(true)}>编辑</Button>
                  </Space>
              ) : (
                  <Space>
                      <Button icon={<SaveOutlined />} type="primary" onClick={handleUpdate}>保存</Button>
                      <Button onClick={() => setIsEditing(false)}>取消</Button>
                  </Space>
              )}
              
              {resume.status !== 'rejected' && resume.status !== 'completed' && !isEditing && (
                <Button danger icon={<CloseCircleOutlined />} onClick={() => {
                    Modal.confirm({
                      title: '确认淘汰',
                      content: '确定要淘汰这份简历吗？',
                      okText: '确认',
                      cancelText: '取消',
                      okType: 'danger',
                      onOk: async () => {
                        try {
                          await request.put(`/resumes/${id}`, { status: 'rejected' });
                          message.success('已标记为淘汰');
                          fetchResume(id!);
                        } catch (error) {
                          message.error('操作失败');
                        }
                      },
                    });
                }}>淘汰</Button>
              )}
            </div>
          </div>

          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="应聘岗位">{resume.position?.title}</Descriptions.Item>
            <Descriptions.Item label="学历">{parsedData.highest_degree || '未识别'}</Descriptions.Item>
            <Descriptions.Item label="毕业院校">{parsedData.school || '未识别'}</Descriptions.Item>
            <Descriptions.Item label="专业">{parsedData.major || '未识别'}</Descriptions.Item>
            <Descriptions.Item label="工作年限">{parsedData.years_of_experience || '0'}年</Descriptions.Item>
            <Descriptions.Item label="最近公司">{parsedData.recent_company || '未识别'}</Descriptions.Item>
            <Descriptions.Item label="解析状态">{statusInfo.text}</Descriptions.Item>
            <Descriptions.Item label="失败原因">{resume.parse_status === 'failed' ? (resume.parse_error || '未知') : '-'}</Descriptions.Item>
          </Descriptions>

          <Divider style={{ borderColor: '#E2E8F0' }}>AI 初审评价</Divider>
          <div style={{ 
            background: '#F8FAFC', 
            padding: '20px', 
            borderRadius: '12px', 
            border: '1px solid #E2E8F0', 
            color: '#334155',
            fontSize: '15px',
            lineHeight: 1.8
          }}>
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h3: ({node, ...props}) => <h3 style={{ color: '#0F172A', marginTop: '16px', marginBottom: '8px', fontSize: '16px' }} {...props} />,
                p: ({node, ...props}) => <p style={{ marginBottom: '12px' }} {...props} />,
                ul: ({node, ...props}) => <ul style={{ paddingLeft: '20px', marginBottom: '12px' }} {...props} />,
                li: ({node, ...props}) => <li style={{ marginBottom: '4px' }} {...props} />
              }}
            >
              {resume.ai_review || '暂无评价'}
            </ReactMarkdown>
          </div>
        </Card>
      </div>
      </div>
    </div>
  );
};

export default ResumeDetail;
