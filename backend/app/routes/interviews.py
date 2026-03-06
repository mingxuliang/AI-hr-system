from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Response
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.schemas.interview import InterviewResponse, InterviewCreate, InterviewUpdate, InterviewScore
from app.services.interview_service import (
    create_interview, get_interviews, get_interview, update_interview, delete_interview,
    submit_interview_score, update_interview_questions, export_interview_result, confirm_interview_result,
    submit_interview_panel_score, aggregate_panel_scores, start_interview, cancel_interview, get_submission_status
)
from app.schemas.interview import InterviewResponse, InterviewCreate, InterviewUpdate, InterviewScore, InterviewPanelResponse
from app.models.models import User, UserRole, Resume, Position
from app.routes.auth import get_current_user
from app.core.security import check_roles

from typing import List
from uuid import UUID
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

router = APIRouter(
    prefix="/interviews",
    tags=["interviews"]
)

class ConfirmResult(BaseModel):
    result: str

class CancelRequest(BaseModel):
    reason: str = None

class EmailSendRequest(BaseModel):
    subject: str
    content: str

class EmailPreviewRequest(BaseModel):
    resume_id: UUID
    position_id: UUID
    interview_time: str = None
    round: int = 1
    interview_type: str = 'onsite'
    interview_category: str = 'technical'
    interview_location: str = None
    meeting_link: str = None

@router.post("/{interview_id}/panel-score", response_model=InterviewPanelResponse)
def submit_panel_score_route(
    interview_id: UUID, 
    score_data: InterviewScore, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Submit individual score
    # Check if this triggers auto-aggregation
    panel = submit_interview_panel_score(db, interview_id, current_user.id, score_data)
    
    # Check if we should aggregate
    # This logic was partially in submit_interview_panel_score but that function didn't have background_tasks
    # So we do a check here or move the logic fully here
    # Let's check if all submitted
    from app.models.models import Interview, InterviewPanel
    
    db_interview = db.query(Interview).get(interview_id)
    if db_interview and db_interview.panel_members:
        submitted_panels = db.query(InterviewPanel).filter(
            InterviewPanel.interview_id == interview_id,
            InterviewPanel.is_submitted == True
        ).all()
        submitted_ids = [str(p.interviewer_id) for p in submitted_panels]
        required_ids = [str(uid) for uid in db_interview.panel_members]
        
        print(f"Auto-Aggregation Debug: Submitted={submitted_ids}, Required={required_ids}")
        
        if all(uid in submitted_ids for uid in required_ids):
             print(f"All panel members submitted. Triggering aggregation for interview {interview_id}")
             # Auto aggregate
             aggregate_panel_scores(db, interview_id, background_tasks)
             # Update status in response object (not DB object, as panel is different model)
             panel.interview_status = "completed"
             
    return panel

@router.post("/{interview_id}/aggregate", response_model=InterviewResponse)
def aggregate_scores_route(
    interview_id: UUID, 
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) # Only allowed users (HR/Admin) should do this ideally
):
    db_interview = aggregate_panel_scores(db, interview_id, background_tasks)
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview or panels not found")
    return db_interview

@router.post("/{interview_id}/confirm", response_model=InterviewResponse)
def confirm_interview_result_route(
    interview_id: UUID,
    confirm_data: ConfirmResult,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    db_interview = confirm_interview_result(db, interview_id, confirm_data.result, background_tasks)
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return db_interview

@router.post("/{interview_id}/cancel", response_model=InterviewResponse)
def cancel_interview_route(
    interview_id: UUID,
    reason: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR]))
):
    """
    取消面试。
    """
    try:
        db_interview = cancel_interview(db, interview_id, reason)
        if not db_interview:
            raise HTTPException(status_code=404, detail="Interview not found")
        return db_interview
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{interview_id}/submission-status")
def get_submission_status_route(
    interview_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    获取面试评分提交状态。
    返回各面试官是否已提交评分。
    """
    status = get_submission_status(db, interview_id)
    if not status:
        raise HTTPException(status_code=404, detail="Interview not found")
    return status

@router.get("/{interview_id}/export")
def export_interview_route(interview_id: UUID, format: str = "markdown", db: Session = Depends(get_db)):
    content = export_interview_result(db, interview_id, format)
    if not content:
        raise HTTPException(status_code=404, detail="Interview not found")
        
    return PlainTextResponse(content=content)

@router.put("/{interview_id}/questions", response_model=InterviewResponse)
def update_questions_route(interview_id: UUID, questions: List[dict], db: Session = Depends(get_db)):
    db_interview = update_interview_questions(db, interview_id, questions)
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return db_interview

@router.post("", response_model=InterviewResponse)
def create_interview_route(
    interview: InterviewCreate, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR]))
):
    return create_interview(db, interview, background_tasks)

@router.get("", response_model=List[InterviewResponse])
def get_interviews_route(
    skip: int = 0, 
    limit: int = 100, 
    status: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Filter for interviewers: only see interviews where they are panel members
    if current_user.role == UserRole.INTERVIEWER:
        # We need to implement a filter in get_interviews or do it here
        # Since panel_members is a JSON list of UUIDs, it's tricky to query directly in all SQL dialects efficiently without specific JSON operators.
        # But we can fetch all and filter in python for now (assuming not huge volume) or use specific query.
        # Better: Update get_interviews service to handle filtering.
        from app.services.interview_service import get_interviews_for_interviewer
        interviews = get_interviews_for_interviewer(db, current_user.id, skip=0, limit=10000)
        if status:
            interviews = [i for i in interviews if str(i.status) == status or getattr(i.status, "value", None) == status]
        return interviews[skip: skip + limit]
        
    return get_interviews(db, skip=skip, limit=limit, status=status)

@router.post("/email-preview")
def preview_email_before_create(
    preview_data: EmailPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """在创建面试前预览邮件内容"""
    from app.services.mail_service import get_mail_service
    from datetime import datetime

    # 获取简历和岗位信息
    resume = db.query(Resume).filter(Resume.id == preview_data.resume_id).first()
    position = db.query(Position).filter(Position.id == preview_data.position_id).first()

    if not resume or not position:
        raise HTTPException(status_code=404, detail="简历或岗位不存在")

    mail_service = get_mail_service(db)

    # 面试类型中文映射
    category_map = {
        "hr": "HR面",
        "technical": "技术面",
        "manager": "主管面",
        "ceo": "CEO面",
        "comprehensive": "综合面"
    }
    interview_category_text = category_map.get(preview_data.interview_category, "面试")

    # 面试形式中文映射
    type_map = {
        "onsite": "现场面试",
        "video": "视频面试",
        "phone": "电话面试"
    }
    interview_type_text = type_map.get(preview_data.interview_type, "现场面试")

    # 格式化面试时间
    time_str = "待定"
    if preview_data.interview_time:
        try:
            dt = datetime.fromisoformat(preview_data.interview_time.replace('Z', '+00:00'))
            time_str = dt.strftime('%Y年%m月%d日 %H:%M')
        except:
            time_str = preview_data.interview_time

    # 渲染邮件模板
    context = {
        "candidate_name": resume.candidate_name or "候选人",
        "position_title": position.title,
        "interview_time": time_str,
        "interview_round": preview_data.round,
        "interview_category": interview_category_text,
        "interview_type": interview_type_text,
        "interview_location": preview_data.interview_location,
        "meeting_link": preview_data.meeting_link,
        "contact_person": "HR",
        "contact_phone": "",
        "company_name": "公司"
    }

    html_content = mail_service._render_template("interview_invitation.html", context)
    subject = f"面试邀请 - {position.title} 岗位"

    return {
        "to_email": resume.email,
        "candidate_name": resume.candidate_name,
        "subject": subject,
        "content": html_content
    }

@router.get("/{interview_id}", response_model=InterviewResponse)
def get_interview_route(interview_id: UUID, db: Session = Depends(get_db)):
    interview = get_interview(db, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return interview

@router.post("/{interview_id}/start", response_model=InterviewResponse)
def start_interview_route(
    interview_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    开始面试，将状态从 SCHEDULED 改为 IN_PROGRESS。
    """
    db_interview = start_interview(db, interview_id)
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return db_interview

@router.put("/{interview_id}", response_model=InterviewResponse)
def update_interview_route(interview_id: UUID, interview: InterviewUpdate, db: Session = Depends(get_db)):
    db_interview = update_interview(db, interview_id, interview)
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return db_interview

@router.post("/{interview_id}/score", response_model=InterviewResponse)
def submit_score_route(interview_id: UUID, score_data: InterviewScore, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    db_interview = submit_interview_score(db, interview_id, score_data, background_tasks)
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return db_interview

from fastapi import UploadFile, File
import shutil
import os
from app.services.audio_service import transcribe_audio

# ...

@router.post("/{interview_id}/audio/{question_index}")
def upload_audio_route(
    interview_id: UUID,
    question_index: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Upload audio recording for a specific question, transcribe it, and save to panel record.
    """
    # 1. Save file
    upload_dir = f"uploads/audio/{interview_id}"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "webm"
    file_name = f"{current_user.id}_{question_index}.{file_extension}"
    file_path = os.path.join(upload_dir, file_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # 2. Transcribe
    transcript = transcribe_audio(file_path)
    
    # 3. Update DB (InterviewPanel)
    # We need to find or create the panel for this user
    from app.models.models import InterviewPanel
    
    panel = db.query(InterviewPanel).filter(
        InterviewPanel.interview_id == interview_id,
        InterviewPanel.interviewer_id == current_user.id
    ).first()
    
    if not panel:
        # Create provisional panel if not exists
        panel = InterviewPanel(
            interview_id=interview_id,
            interviewer_id=current_user.id,
            scores={},
            comments={},
            audio_records={},
            transcripts={}
        )
        db.add(panel)
    
    # Update JSON fields
    # Note: SQLAlchemy JSON mutation requires re-assignment or flag_modified
    audio_records = dict(panel.audio_records) if panel.audio_records else {}
    transcripts = dict(panel.transcripts) if panel.transcripts else {}
    
    audio_records[question_index] = file_path
    transcripts[question_index] = transcript
    
    panel.audio_records = audio_records
    panel.transcripts = transcripts
    
    db.commit()
    db.refresh(panel)
    
    return {"transcript": transcript, "file_path": file_path}

@router.delete("/{interview_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interview_route(
    interview_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR]))
):
    db_interview = delete_interview(db, interview_id)
    if not db_interview:
        raise HTTPException(status_code=404, detail="Interview not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{interview_id}/email-preview")
def get_email_preview(
    interview_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """获取面试邀请邮件预览"""
    from app.services.mail_service import get_mail_service

    interview = get_interview(db, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    mail_service = get_mail_service(db)

    # 获取候选人信息
    resume = db.query(Resume).filter(Resume.id == interview.resume_id).first()
    position = db.query(Position).filter(Position.id == interview.position_id).first()

    if not resume or not position:
        raise HTTPException(status_code=404, detail="Resume or position not found")

    # 从 comments 中获取面试类型和地点信息
    comments = interview.comments or {}
    interview_type = comments.get("interview_type", "onsite")
    interview_category = comments.get("interview_category", "technical")
    interview_location = comments.get("interview_location")
    meeting_link = comments.get("meeting_link")

    # 面试类型中文映射
    category_map = {
        "hr": "HR面",
        "technical": "技术面",
        "manager": "主管面",
        "ceo": "CEO面",
        "comprehensive": "综合面"
    }
    interview_category_text = category_map.get(interview_category, "面试")

    # 面试形式中文映射
    type_map = {
        "onsite": "现场面试",
        "video": "视频面试",
        "phone": "电话面试"
    }
    interview_type_text = type_map.get(interview_type, "现场面试")

    # 格式化面试时间
    time_str = interview.interview_time.strftime('%Y年%m月%d日 %H:%M') if interview.interview_time else "待定"

    # 渲染邮件模板
    context = {
        "candidate_name": resume.candidate_name or "候选人",
        "position_title": position.title,
        "interview_time": time_str,
        "interview_round": interview.round or 1,
        "interview_category": interview_category_text,
        "interview_type": interview_type_text,
        "interview_location": interview_location,
        "meeting_link": meeting_link,
        "contact_person": "HR",
        "contact_phone": "",
        "company_name": "公司"
    }

    html_content = mail_service._render_template("interview_invitation.html", context)
    subject = f"面试邀请 - {position.title} 岗位"

    return {
        "to_email": resume.email,
        "candidate_name": resume.candidate_name,
        "subject": subject,
        "content": html_content
    }


@router.post("/{interview_id}/send-email")
def send_interview_email(
    interview_id: UUID,
    email_data: EmailSendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """发送面试邀请邮件"""
    from app.services.mail_service import get_mail_service

    interview = get_interview(db, interview_id)
    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    mail_service = get_mail_service(db)

    # 获取候选人邮箱
    resume = db.query(Resume).filter(Resume.id == interview.resume_id).first()
    if not resume or not resume.email:
        raise HTTPException(status_code=400, detail="候选人邮箱为空")

    # 发送邮件
    success = mail_service._send_email(
        to_email=resume.email,
        subject=email_data.subject,
        html_content=email_data.content
    )

    if success:
        return {"message": "邮件发送成功"}
    else:
        raise HTTPException(status_code=500, detail="邮件发送失败")
