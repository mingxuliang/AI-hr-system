from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from app.config.database import get_db
from app.schemas.resume import ResumeResponse, ResumeCreate, ResumeUpdate
from app.services.resume_service import (
    upload_resume, get_resumes, get_resume, update_resume, delete_resume, batch_upload_resumes, get_resumes_by_stage, reparse_resume
)
from typing import List, Dict, Any
from uuid import UUID

router = APIRouter(
    prefix="/resumes",
    tags=["resumes"]
)

@router.get("/kanban", response_model=List[ResumeResponse])
def get_resumes_kanban_route(db: Session = Depends(get_db)):
    return get_resumes_by_stage(db)

@router.post("", response_model=ResumeResponse)
def create_resume_route(
    background_tasks: BackgroundTasks,
    position_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    return upload_resume(db, file, position_id, background_tasks)

@router.post("/batch", response_model=List[ResumeResponse])
def batch_upload_resumes_route(
    background_tasks: BackgroundTasks,
    position_id: UUID = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    return batch_upload_resumes(db, files, position_id, background_tasks)

@router.get("", response_model=List[ResumeResponse])
def get_resumes_route(
    skip: int = 0, 
    limit: int = 100, 
    candidate_name: str = None, 
    status: str = None, 
    db: Session = Depends(get_db)
):
    return get_resumes(db, skip=skip, limit=limit, candidate_name=candidate_name, status=status)

@router.get("/{resume_id}", response_model=ResumeResponse)
def get_resume_route(resume_id: UUID, db: Session = Depends(get_db)):
    resume = get_resume(db, resume_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume

@router.put("/{resume_id}", response_model=ResumeResponse)
def update_resume_route(resume_id: UUID, resume: ResumeUpdate, db: Session = Depends(get_db)):
    db_resume = update_resume(db, resume_id, resume)
    if not db_resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return db_resume

@router.delete("/{resume_id}", response_model=ResumeResponse)
def delete_resume_route(resume_id: UUID, db: Session = Depends(get_db)):
    db_resume = delete_resume(db, resume_id)
    if not db_resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return db_resume

@router.post("/{resume_id}/reparse", response_model=ResumeResponse)
def reparse_resume_route(
    resume_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    resume = reparse_resume(db, resume_id, background_tasks)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume
