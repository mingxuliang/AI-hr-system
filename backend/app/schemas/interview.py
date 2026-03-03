from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from app.models.models import InterviewStatus, InterviewResult
from app.schemas.resume import ResumeResponse
from app.schemas.position import PositionResponse

class InterviewBase(BaseModel):
    resume_id: UUID
    position_id: UUID
    interviewer: Optional[str] = None
    interview_time: Optional[datetime] = None
    panel_members: Optional[List[str]] = [] # List of user IDs for the panel (strings or UUIDs)
    
class InterviewCreate(InterviewBase):
    question_bank_ids: Optional[List[UUID]] = []
    question_count: Optional[int] = 5

class InterviewUpdate(BaseModel):
    interviewer: Optional[str] = None
    interview_time: Optional[datetime] = None
    status: Optional[InterviewStatus] = None
    result: Optional[InterviewResult] = None
    evaluation: Optional[str] = None
    suggestion: Optional[str] = None

class InterviewScore(BaseModel):
    scores: Dict[str, int] # 题目索引 -> 分数
    comments: Optional[Dict[str, str]] = {} # 题目索引 -> 评语
    
class InterviewPanelResponse(BaseModel):
    id: UUID
    interviewer_id: UUID
    scores: Optional[Dict[str, Any]] = None
    comments: Optional[Dict[str, Any]] = None
    total_score: Optional[int] = None
    is_submitted: bool
    
    # Custom field to indicate main interview status
    interview_status: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class InterviewResponse(InterviewBase):
    id: UUID
    questions: Optional[List[Dict[str, Any]]] = None
    scores: Optional[Dict[str, Any]] = None
    comments: Optional[Dict[str, Any]] = None
    total_score: Optional[int] = None
    result: InterviewResult
    evaluation: Optional[str] = None
    suggestion: Optional[str] = None
    status: InterviewStatus
    created_at: datetime
    resume: Optional[ResumeResponse] = None
    position: Optional[PositionResponse] = None
    panels: Optional[List[InterviewPanelResponse]] = []
    
    model_config = ConfigDict(from_attributes=True)
