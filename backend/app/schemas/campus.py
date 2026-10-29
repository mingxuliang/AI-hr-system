from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import List, Optional


class CampusPositionBrief(BaseModel):
    id: UUID
    title: str
    department: Optional[str] = None
    location: Optional[str] = None
    salary_range: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[str] = None


class CampusProjectCreate(BaseModel):
    school: str = Field(min_length=1, max_length=200)
    company: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    position_ids: List[UUID] = Field(min_length=1)


class CampusProjectUpdate(BaseModel):
    school: str = Field(min_length=1, max_length=200)
    company: str = Field(min_length=1, max_length=200)
    title: str = Field(min_length=1, max_length=200)
    position_ids: List[UUID] = Field(min_length=1)


class CampusApplicationItem(BaseModel):
    id: UUID
    candidate_name: Optional[str] = None
    contact: Optional[str] = None
    school: Optional[str] = None
    major: Optional[str] = None
    position_id: Optional[UUID] = None
    position_title: Optional[str] = None
    match_score: Optional[int] = None
    parse_status: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None


class CampusProjectListItem(BaseModel):
    id: UUID
    school: str
    company: Optional[str] = None
    title: str
    status: str
    position_count: int
    application_count: int
    created_at: Optional[datetime] = None


class CampusProjectDetail(CampusProjectListItem):
    positions: List[CampusPositionBrief]
    applications: List[CampusApplicationItem]


class PublicCampusOut(BaseModel):
    id: UUID
    school: str
    company: Optional[str] = None
    title: str
    status: str
    accepting: bool
    positions: List[CampusPositionBrief]
