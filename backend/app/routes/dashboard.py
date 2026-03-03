from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.config.database import get_db
from app.schemas.dashboard import DashboardData, DashboardStats, Activity, TrendData
from app.services.dashboard_service import get_dashboard_stats, get_recent_activities, get_interview_trends

router = APIRouter(
    prefix="/dashboard",
    tags=["dashboard"],
    responses={404: {"description": "Not found"}},
)

@router.get("/stats", response_model=DashboardData)
def read_dashboard_stats(db: Session = Depends(get_db)):
    stats = get_dashboard_stats(db)
    activities = get_recent_activities(db)
    trends = get_interview_trends(db)
    
    return {
        "stats": stats,
        "recent_activities": activities,
        "interview_trends": trends
    }
