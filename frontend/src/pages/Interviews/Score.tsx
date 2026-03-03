import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Button, InputNumber, Form, Input, Row, Col, Typography, message, Divider, Tag, Space, Spin, Modal, Popconfirm, Select, Collapse, Avatar, Tooltip, Switch } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { EditOutlined, DeleteOutlined, PlusOutlined, SaveOutlined, CloseOutlined, DownloadOutlined, FilePdfOutlined, FileWordOutlined, LeftOutlined, RightOutlined, CheckCircleOutlined, CheckCircleFilled, CaretRightOutlined, UserOutlined, TeamOutlined, EyeInvisibleOutlined, EyeOutlined, AudioOutlined, LoadingOutlined, ExpandOutlined, CompressOutlined } from '@ant-design/icons';
import request from '../../utils/request';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const InterviewScore: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [interview, setInterview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [editingIndex, setEditingIndex] = useState<number>(-1);
  const [editForm] = Form.useForm();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  
  // Add Question Modal State
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();
  
  // Scoring state
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  
  // Panel state
  const [panels, setPanels] = useState<any[]>([]);
  const [showOtherScores, setShowOtherScores] = useState(false); // Toggle for collaboration mode

  const [submitting, setSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Audio recording state
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) {
      fetchInterview(id);
    }
  }, [id]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    onChange();
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      message.error('无法切换全屏');
    }
  };
  
  // ... (polling logic)

  const fetchInterview = async (interviewId: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await request.get(`/interviews/${interviewId}`) as any;
      
      // Check if already evaluated (main result)
      if (res.evaluation || (res.result === 'pending' && res.scores && Object.keys(res.scores).length > 0)) {
          // Check if current user has submitted panel score
          // If so, maybe redirect? Or allow viewing?
          // For now, let's keep logic simple: if main result exists, redirect to result page.
          if (res.status === 'completed') {
             navigate(`/interviews/${interviewId}/result`);
             return;
          }
      }
      
      setInterview(res);
      setQuestions(res.questions || []);
      
      // Load panels if available
      if (res.panels) {
          setPanels(res.panels);
          // Pre-fill my scores if I submitted before
          const myPanel = res.panels.find((p: any) => p.interviewer_id === user?.id);
          if (myPanel) {
              setScores(myPanel.scores || {});
              setComments(myPanel.comments || {});
          }
      }
    } catch (error) {
      if (!silent) message.error('获取面试详情失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Poll for collaboration data
  useEffect(() => {
    let interval: any;
    
    // Check status immediately
    if (interview && interview.status === 'completed' && interview.evaluation) {
         navigate(`/interviews/${id}/result`);
         return;
    }
    
    // Poll regardless of showOtherScores if we are waiting for completion
    // Or just make it simple: always poll every 5s if not completed
    if (id && (!interview || interview.status !== 'completed')) {
        // Initial fetch
        if (!interview) fetchInterview(id, true);
        
        interval = setInterval(() => {
            fetchInterview(id, true);
        }, 5000);
    }
    return () => {
        if (interval) clearInterval(interval);
    };
  }, [id, interview?.status, showOtherScores]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `recording-${currentQuestionIndex}.webm`, { type: 'audio/webm' });
        
        // Upload audio
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            message.loading({ content: '正在转写音频...', key: 'transcribing' });
            const res = await request.post(`/interviews/${id}/audio/${currentQuestionIndex}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            }) as any;
            
            if (res.transcript) {
                setTranscripts(prev => ({ ...prev, [currentQuestionIndex]: res.transcript }));
                message.success({ content: '转写完成', key: 'transcribing' });
            } else {
                message.warning({ content: '未识别到有效语音', key: 'transcribing' });
            }
        } catch (e) {
            message.error({ content: '音频上传或转写失败', key: 'transcribing' });
        }
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (err) {
      message.error('无法访问麦克风');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorder && recording) {
        mediaRecorder.stop();
        setRecording(false);
        mediaRecorder.stream.getTracks().forEach((track: any) => track.stop());
    }
  };

  const handleAddQuestionClick = () => {
    addForm.resetFields();
    addForm.setFieldsValue({
      difficulty: 'intermediate',
      type: 'technical'
    });
    setIsAddModalVisible(true);
  };

  const handleAddModalOk = async () => {
    try {
      const values = await addForm.validateFields();
      const newQuestion = {
        ...values,
        follow_up: values.follow_up ? values.follow_up.split('\n').filter(Boolean) : [],
        resume_association: values.resume_association || '',
        reference_answer: values.reference_answer || '',
        grading_criteria: values.grading_criteria || ''
      };
      // Sync to backend
      const updatedQuestions = [...questions, newQuestion];
      await request.put(`/interviews/${id}/questions`, updatedQuestions);

      setQuestions(updatedQuestions);
      setIsAddModalVisible(false);
      message.success('添加成功');
      
      // Scroll to bottom
      setTimeout(() => {
        // Switch to the new question
        setCurrentQuestionIndex(updatedQuestions.length - 1);
      }, 100);
    } catch (error) {
      message.error('添加失败');
    }
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    const q = questions[index];
    editForm.setFieldsValue({
        ...q,
        follow_up: Array.isArray(q.follow_up) ? q.follow_up.join('\n') : q.follow_up
    });
  };

  const handleSaveQuestion = async () => {
    try {
      const values = await editForm.validateFields();
      const newQuestions = [...questions];
      newQuestions[editingIndex] = { 
          ...newQuestions[editingIndex], 
          ...values,
          follow_up: values.follow_up ? values.follow_up.split('\n').filter(Boolean) : []
      };
      
      // Sync to backend
      await request.put(`/interviews/${id}/questions`, newQuestions);
      
      setQuestions(newQuestions);
      setEditingIndex(-1);
      message.success('保存成功');
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handleCancelEdit = () => {
    setEditingIndex(-1);
  };

  const handleDelete = async (index: number) => {
    try {
      const newQuestions = [...questions];
      newQuestions.splice(index, 1);
      
      // Sync to backend
      await request.put(`/interviews/${id}/questions`, newQuestions);
      
      setQuestions(newQuestions);
      message.success('删除成功');
      
      // Adjust current index if needed
      if (currentQuestionIndex >= newQuestions.length && newQuestions.length > 0) {
        setCurrentQuestionIndex(newQuestions.length - 1);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmitScore = async () => {
    // Validate scores
    for (let i = 0; i < questions.length; i++) {
      if (scores[i] === undefined) {
        message.error(`请为第 ${i + 1} 题打分`);
        return;
      }
    }

    try {
      setSubmitting(true);
      // Submit as panel score
      const res = await request.post(`/interviews/${id}/panel-score`, { 
        scores,
        comments 
      }) as any;
      message.success('提交评分成功');
      
      // Check if auto-aggregation triggered
      if (res.interview_status === 'completed') {
          message.success('所有面试官评分已完成，正在生成报告...');
          navigate(`/interviews/${id}/result`);
          return;
      }
      
      // If Admin or HR, ask if they want to aggregate and finalize
      if (user?.role === 'admin' || user?.role === 'hr') {
          Modal.confirm({
              title: '汇总评分',
              content: '是否立即汇总所有面试官评分并生成最终报告？',
              okText: '汇总并生成报告',
              cancelText: '稍后',
              onOk: async () => {
                  try {
                      await request.post(`/interviews/${id}/aggregate`);
                      message.success('正在生成最终报告...');
                      navigate(`/interviews/${id}/result`);
                  } catch (e) {
                      message.error('汇总失败');
                  }
              }
          });
      } else {
          message.info('评分已保存，请等待其他面试官完成评分');
      }
      
    } catch (error) {
      message.error('提交评分失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Render other interviewers' scores
  const renderOtherScores = () => {
      if (!showOtherScores) return null;
      
      const otherPanels = panels.filter(p => p.interviewer_id !== user?.id && p.scores && p.scores[currentQuestionIndex] !== undefined);
      
      if (otherPanels.length === 0) return null;
      
      return (
          <div style={{ marginTop: 16, padding: 12, background: '#F0F9FF', borderRadius: 8, border: '1px dashed #BAE6FD' }}>
              <Text strong style={{ color: '#0369A1', marginBottom: 8, display: 'block' }}><TeamOutlined /> 其他面试官评分</Text>
              <Space direction="vertical" style={{ width: '100%' }}>
                  {otherPanels.map((p, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Space>
                              <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#87d068' }} />
                              <Text type="secondary">面试官 {p.interviewer_id.slice(0, 4)}...</Text>
                          </Space>
                          <Space>
                              <Tag color="blue">{p.scores[currentQuestionIndex]}分</Tag>
                              {p.comments && p.comments[currentQuestionIndex] && (
                                  <Text type="secondary" style={{ fontSize: 12, maxWidth: 200 }} ellipsis>{p.comments[currentQuestionIndex]}</Text>
                              )}
                          </Space>
                      </div>
                  ))}
              </Space>
          </div>
      );
  };

  const fileUrl = interview?.resume?.file_path ? `/${interview.resume.file_path}` : '';
  const isPdf = fileUrl.toLowerCase().endsWith('.pdf');

  if (loading && !interview) {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <Spin size="large" tip="加载中..." />
        </div>
    );
  }

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handleJumpToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  const currentQuestion = questions[currentQuestionIndex];
  
  if (interview && (!interview.questions || interview.questions.length === 0)) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <Spin size="large" />
            <Title level={4} style={{ marginTop: 24, color: '#64748B' }}>AI 正在生成面试题，请稍候...</Title>
            <Text type="secondary">根据简历内容和题库生成定制化题目通常需要 10-20 秒</Text>
        </div>
      );
  }
  
  if (!interview) return null;

  const questionFormContent = (
    <>
      <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
        <Input placeholder="例如：Java并发编程" />
      </Form.Item>
      <Form.Item name="content" label="问题内容" rules={[{ required: true, message: '请输入问题内容' }]}>
        <TextArea rows={3} placeholder="详细的问题描述" />
      </Form.Item>
      <Form.Item name="resume_association" label="简历关联">
        <TextArea rows={2} placeholder="关联的简历经历" />
      </Form.Item>
      <Form.Item name="reference_answer" label="参考答案">
        <TextArea rows={3} placeholder="理想的回答要点" />
      </Form.Item>
      <Form.Item name="grading_criteria" label="评分标准">
        <TextArea rows={3} placeholder="评分细则" />
      </Form.Item>
      <Form.Item name="follow_up" label="追问方向 (每行一个)">
        <TextArea rows={2} placeholder="追问1&#10;追问2" />
      </Form.Item>
      <Row gutter={16}>
          <Col span={12}>
              <Form.Item name="difficulty" label="难度">
                  <Select>
                      <Select.Option value="junior">初级</Select.Option>
                      <Select.Option value="intermediate">中级</Select.Option>
                      <Select.Option value="senior">高级</Select.Option>
                  </Select>
              </Form.Item>
          </Col>
          <Col span={12}>
              <Form.Item name="type" label="类型">
                  <Select>
                      <Select.Option value="technical">技术</Select.Option>
                      <Select.Option value="project">项目</Select.Option>
                      <Select.Option value="behavioral">行为</Select.Option>
                  </Select>
              </Form.Item>
          </Col>
      </Row>
    </>
  );

  const handleForceAggregate = async () => {
      try {
          Modal.confirm({
              title: '强制汇总',
              content: '确定要强制汇总当前评分并生成报告吗？未提交的面试官评分将被忽略。',
              okText: '确认',
              cancelText: '取消',
              onOk: async () => {
                    if (id) {
                       await request.post(`/interviews/${id}/aggregate`);
                       message.success('正在生成最终报告...');
                       // Wait a bit or rely on polling
                       setTimeout(() => fetchInterview(id, true), 2000);
                    }
               }
           });
      } catch (e) {
          message.error('操作失败');
      }
  };

  const headerExtra = (
      <Space>
         {(user?.role === 'admin' || user?.role === 'hr') && (
             <Button danger onClick={handleForceAggregate}>强制汇总</Button>
         )}
         <Button icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />} onClick={toggleFullscreen}>
           {isFullscreen ? '退出全屏' : '全屏'}
         </Button>
         <div style={{ display: 'flex', alignItems: 'center', marginRight: 16 }}>
             <Text style={{ marginRight: 8, fontSize: 12 }}>协作模式</Text>
             <Switch 
                checkedChildren={<EyeOutlined />} 
                unCheckedChildren={<EyeInvisibleOutlined />} 
                checked={showOtherScores} 
                onChange={setShowOtherScores} 
             />
         </div>
         <Button icon={<PlusOutlined />} onClick={handleAddQuestionClick}>添加题目</Button>
         <Button type="primary" onClick={handleSubmitScore} loading={submitting}>提交评分</Button>
      </Space>
  );

  return (
    <div style={{ height: isFullscreen ? '100vh' : 'calc(100vh - 100px)', display: 'flex', gap: '24px' }}>
      {/* Left: Resume Preview */}
      <div style={{ flex: 1, background: '#fff', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 24px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', display: 'flex', justifyContent: 'space-between' }}>
          <Text strong>简历预览: {interview.resume?.candidate_name}</Text>
          <Button type="link" icon={<DownloadOutlined />} href={fileUrl} download>下载</Button>
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
                <Text type="secondary">暂不支持预览，请下载查看</Text>
              </div>
            )
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94A3B8' }}>暂无文件</div>
          )}
        </div>
      </div>

      {/* Right: Interview Questions & Scoring */}
      <div id="questions-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flexShrink: 0, paddingRight: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>面试题目 & 评分</Title>
            {headerExtra}
          </div>

          {/* Question Navigation */}
          <div style={{ marginBottom: 16, overflowX: 'auto', whiteSpace: 'nowrap', paddingBottom: 8, paddingTop: 4, paddingLeft: 4 }}>
            <Space>
              {questions.map((_, index) => {
                const isScored = scores[index] !== undefined;
                const isCurrent = index === currentQuestionIndex;
                return (
                  <Button 
                    key={index}
                    type={isCurrent ? 'primary' : 'default'}
                    shape="circle"
                    onClick={() => handleJumpToQuestion(index)}
                    style={{ 
                      borderColor: isScored ? '#10B981' : undefined,
                      color: !isCurrent && isScored ? '#10B981' : undefined,
                      fontWeight: isCurrent ? 'bold' : 'normal'
                    }}
                  >
                    {index + 1}
                  </Button>
                );
              })}
            </Space>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', paddingRight: '4px', paddingBottom: '4px', display: 'flex', flexDirection: 'column' }}>
          {currentQuestion && (
            <Card 
              key={currentQuestionIndex}
              style={{ flex: 1, borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
              bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingBottom: 0 }}
              title={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <Tag color="blue">第 {currentQuestionIndex + 1} / {questions.length} 题</Tag>
                    <Text strong>{currentQuestion.title || '无标题'}</Text>
                    {scores[currentQuestionIndex] !== undefined && (
                      <Tag icon={<CheckCircleFilled />} color="success">已评分: {scores[currentQuestionIndex]}</Tag>
                    )}
                  </Space>
                  {editingIndex !== currentQuestionIndex && (
                    <Space>
                      {/* Audio Recorder Button */}
                      <Tooltip title={transcripts[currentQuestionIndex] ? "重新录制" : "录制候选人回答"}>
                          <Button 
                            type={recording ? 'primary' : 'default'} 
                            danger={recording}
                            shape="circle"
                            icon={recording ? <LoadingOutlined /> : <AudioOutlined />}
                            onClick={recording ? stopRecording : startRecording}
                          />
                      </Tooltip>
                      {transcripts[currentQuestionIndex] && (
                          <Tooltip title="查看转写内容">
                             <Popconfirm
                                title="候选人回答转写"
                                description={
                                    <div style={{ maxWidth: 300, maxHeight: 200, overflowY: 'auto' }}>
                                        {transcripts[currentQuestionIndex]}
                                    </div>
                                }
                                icon={<AudioOutlined style={{ color: '#722ED1' }} />}
                                showCancel={false}
                                okText="关闭"
                             >
                                <Tag color="purple" style={{ cursor: 'pointer', margin: 0 }}>已转写</Tag>
                             </Popconfirm>
                          </Tooltip>
                      )}
                      
                      <Divider type="vertical" />
                      
                      <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(currentQuestionIndex)} />
                      <Popconfirm title="确定删除此题吗？" onConfirm={() => handleDelete(currentQuestionIndex)}>
                        <Button type="text" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  )}
                </div>
              }
            >
              {editingIndex === currentQuestionIndex ? (
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <Form form={editForm} layout="vertical">
                    {questionFormContent}
                    <Space style={{ justifyContent: 'flex-end', width: '100%', marginTop: 16, marginBottom: 16 }}>
                      <Button onClick={handleCancelEdit}>取消</Button>
                      <Button type="primary" onClick={handleSaveQuestion}>保存</Button>
                    </Space>
                  </Form>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="问题内容">
                        <Paragraph style={{ margin: 0, fontSize: 16 }}>{currentQuestion.content}</Paragraph>
                      </Descriptions.Item>
                      {currentQuestion.resume_association && (
                        <Descriptions.Item label="简历关联">
                          <Text type="secondary">{currentQuestion.resume_association}</Text>
                        </Descriptions.Item>
                      )}
                    </Descriptions>

                    <div style={{ marginTop: 16 }}>
                      {currentQuestion.follow_up && (
                        <div style={{ marginBottom: 16, background: '#F0F9FF', padding: '12px 16px', borderRadius: 8, border: '1px solid #BAE6FD' }}>
                          <Text strong style={{ color: '#0369A1', display: 'block', marginBottom: 8 }}>追问方向</Text>
                          <ul style={{ paddingLeft: 20, margin: 0, color: '#0C4A6E' }}>
                            {(Array.isArray(currentQuestion.follow_up) ? currentQuestion.follow_up : [currentQuestion.follow_up]).map((item: string, i: number) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      <Collapse
                        ghost
                        expandIcon={({ isActive }) => <CaretRightOutlined rotate={isActive ? 90 : 0} />}
                        items={[
                          {
                            key: '1',
                            label: <Text strong>参考答案</Text>,
                            children: <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#64748B' }}>{currentQuestion.reference_answer}</Paragraph>,
                          },
                          {
                            key: '2',
                            label: <Text strong>评分标准</Text>,
                            children: <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#64748B' }}>{typeof currentQuestion.grading_criteria === 'string' ? currentQuestion.grading_criteria : JSON.stringify(currentQuestion.grading_criteria)}</Paragraph>,
                          }
                        ]}
                      />
                    </div>
                  
                    <div style={{ marginTop: 24, background: '#F8FAFC', padding: 16, borderRadius: 8 }}>
                      <Row gutter={16}>
                        <Col span={8}>
                          <Text strong>评分 (0-10):</Text>
                          <InputNumber 
                            min={0} max={10} 
                            style={{ width: '100%', marginTop: 8 }} 
                            value={scores[currentQuestionIndex]}
                            onChange={(val) => setScores({...scores, [currentQuestionIndex]: val || 0})}
                          />
                        </Col>
                        <Col span={16}>
                          <Text strong>评语:</Text>
                          <TextArea 
                            rows={2} 
                            style={{ marginTop: 8 }} 
                            placeholder="请输入评语..." 
                            value={comments[currentQuestionIndex]}
                            onChange={(e) => setComments({...comments, [currentQuestionIndex]: e.target.value})}
                          />
                          
                          <div style={{ marginTop: 16 }}>
                              {transcripts[currentQuestionIndex] && (
                                  <div style={{ padding: 8, background: '#F3E8FF', borderRadius: 4, border: '1px dashed #D8B4FE' }}>
                                      <Text type="secondary" style={{ fontSize: 12 }}>候选人回答转写：</Text>
                                      <Paragraph style={{ margin: 0, color: '#6B21A8' }}>{transcripts[currentQuestionIndex]}</Paragraph>
                                  </div>
                              )}
                          </div>
                          
                          {renderOtherScores()}
                        </Col>
                      </Row>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, marginTop: 24, paddingTop: 16, borderTop: '1px solid #E2E8F0', flexShrink: 0 }}>
                    <Button 
                      icon={<LeftOutlined />} 
                      onClick={handlePrevQuestion} 
                      disabled={currentQuestionIndex === 0}
                      style={{ paddingLeft: 24, paddingRight: 24, background: '#F8FAFC' }}
                    >
                      上一题
                    </Button>
                    {currentQuestionIndex < questions.length - 1 ? (
                      <Button 
                        type="primary" 
                        icon={<RightOutlined />} 
                        onClick={handleNextQuestion}
                        style={{ paddingLeft: 24, paddingRight: 24}}
                      >
                        下一题
                      </Button>
                    ) : (
                      <Button 
                        type="primary" 
                        icon={<SaveOutlined />} 
                        onClick={handleSubmitScore} 
                        loading={submitting}
                        style={{ paddingLeft: 24, paddingRight: 24 }}
                      >
                        提交评分
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Add Question Modal */}
      <Modal
        title="添加面试题"
        open={isAddModalVisible}
        onOk={handleAddModalOk}
        onCancel={() => setIsAddModalVisible(false)}
        width={600}
        okText="添加"
        cancelText="取消"
      >
        <Form form={addForm} layout="vertical">
            {questionFormContent}
        </Form>
      </Modal>
    </div>
  );
};

export default InterviewScore;
