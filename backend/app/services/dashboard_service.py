from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.models.models import Position, Resume, Interview, QuestionBank, PositionStatus, ResumeStatus, InterviewStatus
from datetime import datetime, timedelta

def get_dashboard_stats(db: Session):
    # 1. Active Positions (OPEN and PUBLISHED)
    active_positions_count = db.query(Position).filter(
        (Position.status == PositionStatus.OPEN) | (Position.status == PositionStatus.PUBLISHED)
    ).count()
    
    # 2. Pending Resumes (PENDING_SCREENING and PENDING_REVIEW)
    pending_resumes_count = db.query(Resume).filter(
        (Resume.status == ResumeStatus.PENDING_SCREENING) | (Resume.status == ResumeStatus.PENDING_REVIEW)
    ).count()
    
    # 3. Today's Interviews (Any status except Cancelled, scheduled for today)
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    today_interviews_count = db.query(Interview).filter(
        Interview.interview_time >= today_start,
        Interview.interview_time < today_end,
        Interview.status != InterviewStatus.CANCELLED
    ).count()
    
    # 4. Total Questions (Count Question Banks for now)
    total_questions_count = db.query(QuestionBank).count()

    # Trends (Mocked for now, or simple calculation based on creation in last 7 days)
    # Simple calculation: (count in last 7 days / total count) * 100 or similar.
    # Let's keep trends static or simple for now as historical data is not fully tracked.
    trends = {
        "active_positions": 5,
        "pending_resumes": 10,
        "today_interviews": 0,
        "total_questions": 2
    }

    return {
        "active_positions": active_positions_count,
        "pending_resumes": pending_resumes_count,
        "today_interviews": today_interviews_count,
        "total_questions": total_questions_count,
        "trends": trends
    }

def get_recent_activities(db: Session, limit: int = 5):
    activities = []
    
    # Recent Interviews
    recent_interviews = db.query(Interview).order_by(desc(Interview.created_at)).limit(limit).all()
    for interview in recent_interviews:
        status_text = "Pending"
        color = "#F59E0B"
        if interview.status == InterviewStatus.COMPLETED:
            status_text = "Completed"
            color = "#10B981"
        elif interview.status == InterviewStatus.CANCELLED:
            status_text = "Cancelled"
            color = "#EF4444"
            
        activities.append({
            "id": str(interview.id),
            "title": f"Interview for {interview.position.title if interview.position else 'Unknown Position'}",
            "time": interview.created_at,
            "status": status_text,
            "avatar_color": color,
            "type": "interview"
        })
        
    # Recent Resumes
    recent_resumes = db.query(Resume).order_by(desc(Resume.created_at)).limit(limit).all()
    for resume in recent_resumes:
        activities.append({
            "id": str(resume.id),
            "title": f"{resume.candidate_name or 'Candidate'} applied for {resume.position.title if resume.position else 'Position'}",
            "time": resume.created_at,
            "status": "New",
            "avatar_color": "#3B82F6",
            "type": "resume"
        })

    # Sort by time desc
    activities.sort(key=lambda x: x['time'], reverse=True)
    return activities[:limit]

def get_interview_trends(db: Session, days: int = 7):
    # Get interviews from last N days
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    
    # Query interviews created in range
    # Group by date
    # In SQLite/Postgres, date truncation might differ. 
    # For now, fetch all and aggregate in Python for simplicity/portability
    
    interviews = db.query(Interview.created_at).filter(
        Interview.created_at >= start_date,
        Interview.created_at <= end_date
    ).all()
    
    # Initialize counts map
    counts = {}
    current = start_date
    while current <= end_date:
        date_str = current.strftime("%Y-%m-%d")
        counts[date_str] = 0
        current += timedelta(days=1)
        
    for interview in interviews:
        date_str = interview[0].strftime("%Y-%m-%d") # interview is a tuple (created_at,)
        if date_str in counts:
            counts[date_str] += 1
            
    # Convert to list
    trends = [{"date": date, "count": count} for date, count in counts.items()]
    trends.sort(key=lambda x: x['date'])
    
    return trends
