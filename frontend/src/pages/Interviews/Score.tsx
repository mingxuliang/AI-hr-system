import React, { useEffect, useState } from 'react';
import { Card, Descriptions, Button, InputNumber, Form, Input, Row, Col, Typography, message, Divider, Tag, Space, Spin, Modal, Popconfirm, Select, Collapse, Tooltip, List, Avatar, Progress } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { EditOutlined, DeleteOutlined, PlusOutlined, SaveOutlined, CloseOutlined, DownloadOutlined, FilePdfOutlined, FileWordOutlined, LeftOutlined, RightOutlined, CheckCircleOutlined, CheckCircleFilled, CaretRightOutlined, AudioOutlined, LoadingOutlined, ExpandOutlined, CompressOutlined, PlayCircleOutlined, UserOutlined, StopOutlined } from '@ant-design/icons';
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

  const [submitting, setSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Audio recording state
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});

  // 整场面试录音状态
  const [fullRecording, setFullRecording] = useState(false);
  const [fullRecordingTime, setFullRecordingTime] = useState(0);
  const [fullRecordingTimer, setFullRecordingTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [fullRecordingBlob, setFullRecordingBlob] = useState<Blob | null>(null);
  const [uploadingRecording, setUploadingRecording] = useState(false);
  const [fullTranscript, setFullTranscript] = useState<string>('');

  // 直接填写评价状态
  const [directEvaluation, setDirectEvaluation] = useState('');
  const [directSuggestion, setDirectSuggestion] = useState('');
  const [directScore, setDirectScore] = useState(5);
  const [submittingDirect, setSubmittingDirect] = useState(false);

  // 面试官提交状态
  const [submissionStatus, setSubmissionStatus] = useState<any>(null);
  const [startingInterview, setStartingInterview] = useState(false);

  // 取消面试相关状态
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // 判断是否可以取消面试（仅 HR/Admin 可见）
  const canCancelInterview = user?.role === 'admin' || user?.role === 'hr';

  useEffect(() => {
    if (id) {
      fetchInterview(id);
      fetchSubmissionStatus(id);
    }
  }, [id]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    onChange();
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!id || !interview) return;
    
    if (interview.status === 'completed') {
      navigate(`/interviews/${id}/result`);
      return;
    }
    
    const panelMembers = interview?.panel_members || [];
    const isMultiInterviewer = panelMembers.length > 1;
    const userIdStr = String(user?.id);
    const myPanel = interview.panels?.find((p: any) => String(p.interviewer_id) === userIdStr);
    
    const isGeneratingQuestions = interview.questions === null || interview.questions === undefined;
    
    const shouldPoll = 
      isGeneratingQuestions ||
      interview.status === 'analyzing' ||
      (isMultiInterviewer && myPanel?.is_submitted) ||
      (!isMultiInterviewer && interview.status === 'in_progress' && interview.scores && Object.keys(interview.scores).length > 0);
    
    if (shouldPoll) {
      const interval = setInterval(async () => {
        try {
          const res = await request.get(`/interviews/${id}`) as any;
          setInterview(res);
          setQuestions(res.questions || []);
          fetchSubmissionStatus(id);
          
          if (res.status === 'completed') {
            clearInterval(interval);
            navigate(`/interviews/${id}/result`);
          }
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [id, interview?.status, interview?.panels]);

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

      if (res.status === 'completed') {
         navigate(`/interviews/${interviewId}/result`);
         return;
      }

      if (res.status === 'analyzing') {
         setInterview(res);
         setQuestions(res.questions || []);
         return;
      }

      setInterview(res);
      setQuestions(res.questions || []);
    } catch (error) {
      if (!silent) message.error('获取面试详情失败');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // 获取面试官提交状态
  const fetchSubmissionStatus = async (interviewId: string) => {
    try {
      const res = await request.get(`/interviews/${interviewId}/submission-status`) as any;
      setSubmissionStatus(res);
    } catch (error) {
      // 静默失败，不影响主要功能
    }
  };

  // 开始面试
  const handleStartInterview = async () => {
    if (!id) return;

    setStartingInterview(true);
    try {
      await request.post(`/interviews/${id}/start`);
      message.success('面试已开始');
      fetchInterview(id, true);
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '开始面试失败');
    } finally {
      setStartingInterview(false);
    }
  };

  // 取消面试
  const handleCancelInterview = async () => {
    if (!id) return;

    if (!cancelReason.trim()) {
      message.error('请输入取消原因');
      return;
    }

    setCancelling(true);
    try {
      await request.post(`/interviews/${id}/cancel?reason=${encodeURIComponent(cancelReason)}`);
      message.success('面试已取消');
      setCancelModalVisible(false);
      setCancelReason('');
      navigate('/interviews');
    } catch (error: any) {
      message.error(error?.response?.data?.detail || '取消面试失败');
    } finally {
      setCancelling(false);
    }
  };

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

  // 整场面试录音功能
  const startFullRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setFullRecordingBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setFullRecording(true);
      setFullRecordingTime(0);

      // 开始计时
      const timer = setInterval(() => {
        setFullRecordingTime(prev => prev + 1);
      }, 1000);
      setFullRecordingTimer(timer);

      message.success('开始录制整场面试');
    } catch (error) {
      message.error('无法访问麦克风，请检查权限设置');
    }
  };

  const stopFullRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      setFullRecording(false);
      if (fullRecordingTimer) {
        clearInterval(fullRecordingTimer);
        setFullRecordingTimer(null);
      }
      message.success('录音已保存');
    }
  };

  const uploadFullRecording = async () => {
    if (!fullRecordingBlob || !id) return;

    setUploadingRecording(true);
    try {
      const formData = new FormData();
      formData.append('file', fullRecordingBlob, 'full_interview.webm');

      const response = await request.post(`/interviews/${id}/full-audio`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.transcript) {
        setFullTranscript(response.transcript);
        message.success('录音已上传，AI正在分析...');
      } else {
        message.success('录音已上传');
      }
    } catch (error) {
      message.error('上传录音失败');
    } finally {
      setUploadingRecording(false);
    }
  };

  // 直接提交评价（支持同时上传录音）
  const handleSubmitDirectEvaluation = async () => {
    if (!directEvaluation.trim()) {
      message.error('请填写面试评价');
      return;
    }

    setSubmittingDirect(true);
    try {
      const panelMembers = interview?.panel_members || [];
      const isMultiInterviewer = panelMembers.length > 1;
      
      if (fullRecordingBlob && !fullTranscript) {
        setUploadingRecording(true);
        const formData = new FormData();
        formData.append('file', fullRecordingBlob, 'full_interview.webm');
        formData.append('evaluation', directEvaluation);
        formData.append('suggestion', directSuggestion);
        formData.append('score', directScore.toString());

        const response = await request.post(`/interviews/${id}/direct-evaluation-with-audio`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        setInterview(response);
        
        if (isMultiInterviewer) {
          const updatedInterview = await request.get(`/interviews/${id}`) as any;
          setInterview(updatedInterview);
          
          const allSubmitted = panelMembers.every((memberId: string) => 
            updatedInterview.panels?.some((p: any) => String(p.interviewer_id) === String(memberId) && p.is_submitted)
          );
          
          if (allSubmitted) {
            message.success('所有面试官已提交，AI正在综合分析...');
          } else {
            message.success('评价已提交，等待其他面试官...');
          }
        } else {
          message.success('评价和录音已提交，AI正在综合分析...');
        }
      } else {
        const res = await request.post(`/interviews/${id}/direct-evaluation`, {
          evaluation: directEvaluation,
          suggestion: directSuggestion,
          score: directScore,
          transcript: fullTranscript || null
        });
        setInterview(res);
        
        if (isMultiInterviewer) {
          const updatedInterview = await request.get(`/interviews/${id}`) as any;
          setInterview(updatedInterview);
          
          const allSubmitted = panelMembers.every((memberId: string) => 
            updatedInterview.panels?.some((p: any) => String(p.interviewer_id) === String(memberId) && p.is_submitted)
          );
          
          if (allSubmitted) {
            message.success('所有面试官已提交，AI正在综合分析...');
          } else {
            message.success('评价已提交，等待其他面试官...');
          }
        } else {
          message.success('评价已提交');
        }
      }
    } catch (error) {
      message.error('提交评价失败');
    } finally {
      setSubmittingDirect(false);
      setUploadingRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmitScore = async () => {
    for (let i = 0; i < questions.length; i++) {
      if (scores[i] === undefined) {
        message.error(`请为第 ${i + 1} 题打分`);
        return;
      }
    }

    try {
      setSubmitting(true);
      
      const panelMembers = interview?.panel_members || [];
      const isMultiInterviewer = panelMembers.length > 1;
      
      if (isMultiInterviewer) {
        await request.post(`/interviews/${id}/panel-score`, {
          scores,
          comments 
        }) as any;
        
        const updatedInterview = await request.get(`/interviews/${id}`) as any;
        setInterview(updatedInterview);
        
        const allSubmitted = panelMembers.every((memberId: string) => {
          const found = updatedInterview.panels?.some((p: any) => {
            const match = String(p.interviewer_id) === String(memberId) && p.is_submitted;
            return match;
          });
          return found;
        });
        
        if (allSubmitted) {
          message.success('所有面试官已提交，AI正在分析...');
        } else {
          message.success('评分已提交，等待其他面试官...');
        }
      } else {
        const res = await request.post(`/interviews/${id}/score`, {
          scores,
          comments 
        }) as any;
        
        setInterview(res);
        message.success('评分已提交，AI正在分析...');
      }
      
    } catch (error) {
      message.error('提交评分失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
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

  if (!interview) return null;

  if (interview.questions === null || interview.questions === undefined) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <Spin size="large" />
            <Title level={4} style={{ marginTop: 24, color: '#64748B' }}>AI 正在生成面试题，请稍候...</Title>
            <Text type="secondary">根据简历内容和题库生成定制化题目通常需要 10-20 秒</Text>
        </div>
      );
  }

  const panelMembers = interview?.panel_members || [];
  const isMultiInterviewer = panelMembers.length > 1;
  
  if (isMultiInterviewer && interview.panels) {
    const userIdStr = String(user?.id);
    
    const myPanel = interview.panels.find((p: any) => {
      const match = String(p.interviewer_id) === userIdStr;
      return match;
    });
    
    const allSubmitted = panelMembers.every((memberId: string) => {
      const found = interview.panels?.some((p: any) => {
        const match = String(p.interviewer_id) === String(memberId) && p.is_submitted;
        return match;
      });
      return found;
    });
    
    if (myPanel?.is_submitted && !allSubmitted) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 24 }} />
            <Title level={4} style={{ color: '#64748B' }}>评分已提交</Title>
            <Text type="secondary">等待其他面试官提交评分...</Text>
            <div style={{ marginTop: 24 }}>
              <Space direction="vertical" size="small">
                {panelMembers.map((memberId: string) => {
                  const panel = interview.panels?.find((p: any) => String(p.interviewer_id) === String(memberId));
                  const isMe = String(memberId) === String(user?.id);
                  return (
                    <Tag key={memberId} color={panel?.is_submitted ? 'success' : 'processing'}>
                      {isMe ? '我' : `面试官 ${String(memberId).slice(0, 8)}`}
                      {panel?.is_submitted ? ' - 已提交' : ' - 待提交'}
                    </Tag>
                  );
                })}
              </Space>
            </div>
            <div style={{ marginTop: 24 }}>
              <Button onClick={() => navigate('/interviews')}>返回列表</Button>
            </div>
        </div>
      );
    }
  }

  if (interview.status === 'analyzing') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
            <Spin size="large" />
            <Title level={4} style={{ marginTop: 24, color: '#64748B' }}>AI 正在分析面试结果，请稍候...</Title>
            <Text type="secondary">正在根据评分生成综合评价报告</Text>
            <div style={{ marginTop: 24 }}>
              <Button onClick={() => navigate('/interviews')}>返回列表</Button>
            </div>
        </div>
      );
  }

  const skippedAiQuestions = interview.questions.length === 0;

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

  const headerExtra = (
      <Space>
         <Tooltip title="返回面试列表">
           <Button icon={<LeftOutlined />} onClick={() => navigate('/interviews')} />
         </Tooltip>

         {/* 开始面试按钮 */}
         {interview?.status === 'scheduled' && (
           <Tooltip title="开始面试">
             <Button
               type="primary"
               icon={<PlayCircleOutlined />}
               onClick={handleStartInterview}
               loading={startingInterview}
             />
           </Tooltip>
         )}

         {/* 取消面试按钮 */}
         {canCancelInterview && (interview?.status === 'scheduled' || interview?.status === 'in_progress') && (
           <Tooltip title="取消面试">
             <Button
               danger
               icon={<StopOutlined />}
               onClick={() => setCancelModalVisible(true)}
             />
           </Tooltip>
         )}

         <Tooltip title={isFullscreen ? '退出全屏' : '全屏模式'}>
           <Button icon={isFullscreen ? <CompressOutlined /> : <ExpandOutlined />} onClick={toggleFullscreen} />
         </Tooltip>
         
         <Tooltip title="添加题目">
           <Button icon={<PlusOutlined />} onClick={handleAddQuestionClick} />
         </Tooltip>
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

          {/* 面试官提交状态 */}
          {submissionStatus && submissionStatus.total_members > 0 && (
            <Card
              size="small"
              style={{ marginBottom: 16, borderRadius: 8, background: '#F8FAFC' }}
              title={
                <Space>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>面试官评分状态</span>
                  <Tag color="blue">{submissionStatus.submitted_count}/{submissionStatus.total_members} 已提交</Tag>
                </Space>
              }
            >
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {Object.entries(submissionStatus.members || {}).map(([memberId, member]: [string, any]) => (
                  <div
                    key={memberId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      background: member.submitted ? '#ECFDF5' : '#FEF3C7',
                      borderRadius: 6,
                      border: `1px solid ${member.submitted ? '#86EFAC' : '#FCD34D'}`
                    }}
                  >
                    <Avatar size="small" icon={<UserOutlined />} style={{ background: member.submitted ? '#10B981' : '#F59E0B' }} />
                    <span style={{ fontWeight: 500 }}>{member.name}</span>
                    {member.submitted ? (
                      <Tag color="success" style={{ margin: 0, border: 'none' }}>已提交</Tag>
                    ) : (
                      <Tag color="warning" style={{ margin: 0, border: 'none' }}>未提交</Tag>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'hidden', paddingRight: '4px', paddingBottom: '4px', display: 'flex', flexDirection: 'column' }}>
          {skippedAiQuestions ? (
            <Card
              style={{ flex: 1, borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'auto' }}
              title={<Text strong>选择面试方式</Text>}
            >
              <div style={{ marginBottom: 24 }}>
                <Text type="secondary">您选择了跳过AI生成面试题，请选择以下方式进行面试评估：</Text>
              </div>

              <Row gutter={[16, 16]}>
                {/* 方式1: 添加面试题目 */}
                <Col span={8}>
                  <Card
                    hoverable
                    style={{ textAlign: 'center', height: '100%' }}
                    onClick={handleAddQuestionClick}
                  >
                    <PlusOutlined style={{ fontSize: 32, color: '#1890ff', marginBottom: 12 }} />
                    <Title level={5}>添加面试题目</Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>手动添加面试问题并进行评分</Text>
                  </Card>
                </Col>

                {/* 方式2: 录制整场面试 */}
                <Col span={8}>
                  <Card style={{ textAlign: 'center', height: '100%' }}>
                    <AudioOutlined style={{ fontSize: 32, color: fullRecording ? '#ff4d4f' : '#52c41a', marginBottom: 12 }} />
                    <Title level={5}>录制整场面试</Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>录音后由AI自动分析生成评价</Text>
                    <div style={{ marginTop: 12 }}>
                      {(() => {
                        const panelMembers = interview?.panel_members || [];
                        const isFirstInterviewer = panelMembers.length > 0 && user?.id && panelMembers[0] === user.id;
                        
                        if (!isFirstInterviewer && panelMembers.length > 0) {
                          return (
                            <Tooltip title="仅首位面试官可进行录音">
                              <Button type="default" size="small" disabled>
                                开始录制
                              </Button>
                            </Tooltip>
                          );
                        }
                        
                        if (fullRecording) {
                          return (
                            <Space direction="vertical" size="small">
                              <Text type="danger" strong>录制中: {formatTime(fullRecordingTime)}</Text>
                              <Button type="primary" danger size="small" onClick={stopFullRecording}>
                                停止录制
                              </Button>
                            </Space>
                          );
                        }
                        
                        if (fullRecordingBlob) {
                          return (
                            <Space direction="vertical" size="small">
                              <Text type="success">录音已完成 ({formatTime(fullRecordingTime)})</Text>
                              <Button type="primary" size="small" loading={uploadingRecording} onClick={uploadFullRecording}>
                                上传并分析
                              </Button>
                            </Space>
                          );
                        }
                        
                        return (
                          <Button type="default" size="small" onClick={startFullRecording}>
                            开始录制
                          </Button>
                        );
                      })()}
                    </div>
                    {fullTranscript && (
                      <div style={{ marginTop: 12, textAlign: 'left', maxHeight: 100, overflow: 'auto', background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>{fullTranscript}</Text>
                      </div>
                    )}
                  </Card>
                </Col>

                {/* 方式3: 直接填写评价 */}
                <Col span={8}>
                  <Card style={{ textAlign: 'center', height: '100%' }}>
                    <EditOutlined style={{ fontSize: 32, color: '#722ed1', marginBottom: 12 }} />
                    <Title level={5}>直接填写评价</Title>
                    <Text type="secondary" style={{ fontSize: 12 }}>跳过题目直接填写综合评价</Text>
                    <div style={{ marginTop: 12 }}>
                      <InputNumber
                        min={1}
                        max={10}
                        value={directScore}
                        onChange={(v) => setDirectScore(v || 5)}
                        style={{ width: 60, marginRight: 8 }}
                      />
                      <Text>分</Text>
                    </div>
                  </Card>
                </Col>
              </Row>

              {/* 直接填写评价表单 */}
              <div style={{ marginTop: 24 }}>
                <Title level={5}>综合评价</Title>
                <Input.TextArea
                  rows={4}
                  placeholder="请填写对候选人的综合评价，包括技术能力、沟通能力、项目经验等方面..."
                  value={directEvaluation}
                  onChange={(e) => setDirectEvaluation(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <Title level={5}>录用建议</Title>
                <Input.TextArea
                  rows={2}
                  placeholder="请填写录用建议（录用/淘汰/待定）及原因..."
                  value={directSuggestion}
                  onChange={(e) => setDirectSuggestion(e.target.value)}
                  style={{ marginBottom: 16 }}
                />
                <Button
                  type="primary"
                  size="large"
                  loading={submittingDirect}
                  onClick={handleSubmitDirectEvaluation}
                  disabled={!directEvaluation.trim()}
                >
                  提交评价
                </Button>
              </div>
            </Card>
          ) : currentQuestion && (
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

      {/* 取消面试弹窗 */}
      <Modal
        title="取消面试"
        open={cancelModalVisible}
        onOk={handleCancelInterview}
        onCancel={() => setCancelModalVisible(false)}
        confirmLoading={cancelling}
        okText="确认取消"
        cancelText="返回"
        okButtonProps={{ danger: true }}
      >
        <p style={{ marginBottom: 12, color: '#64748B' }}>请输入取消面试的原因：</p>
        <Input.TextArea
          rows={3}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="请输入取消原因..."
          maxLength={500}
          showCount
        />
      </Modal>
    </div>
  );
};

export default InterviewScore;
