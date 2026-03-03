from pydantic import BaseModel, ConfigDict
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.models import PositionStatus

class PositionBase(BaseModel):
    title: str
    description: str
    requirements: Optional[str] = None
    salary_range: Optional[str] = None
    location: Optional[str] = None
    department: Optional[str] = None
    status: PositionStatus = PositionStatus.OPEN

class PositionCreate(PositionBase):
    pass

class PositionUpdate(PositionBase):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[PositionStatus] = None

class PositionResponse(PositionBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
