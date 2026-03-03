from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class DashboardStats(BaseModel):
    active_positions: int
    pending_resumes: int
    today_interviews: int
    total_questions: int
    trends: dict  # {"active_positions": 15, "pending_resumes": 8, ...}

class Activity(BaseModel):
    id: str
    title: str
    time: datetime
    status: str
    avatar_color: str
    type: str  # "interview", "resume", "position"

class TrendData(BaseModel):
    date: str
    count: int

class DashboardData(BaseModel):
    stats: DashboardStats
    recent_activities: List[Activity]
    interview_trends: List[TrendData]
