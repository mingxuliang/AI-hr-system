from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from app.models.models import ResumeStatus, ScreeningResult
from app.schemas.position import PositionResponse

class ResumeBase(BaseModel):
    candidate_name: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[EmailStr] = None
    position_id: UUID

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v):
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return v
    
class ResumeCreate(ResumeBase):
    pass

class ResumeUpdate(BaseModel):
    screening_result: Optional[ScreeningResult] = None
    hr_review: Optional[str] = None
    status: Optional[ResumeStatus] = None
    candidate_name: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[EmailStr] = None
    stage: Optional[str] = None

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, v):
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return v

class ResumeResponse(ResumeBase):
    id: UUID
    file_path: str
    parsed_data: Optional[Dict[str, Any]] = None
    match_score: Optional[int] = None
    parse_status: Optional[str] = None
    parse_error: Optional[str] = None
    parsed_at: Optional[datetime] = None
    screening_result: ScreeningResult
    ai_review: Optional[str] = None
    hr_review: Optional[str] = None
    status: ResumeStatus
    stage: Optional[str] = "new"
    created_at: datetime
    position: Optional[PositionResponse] = None
    
    model_config = ConfigDict(from_attributes=True)
