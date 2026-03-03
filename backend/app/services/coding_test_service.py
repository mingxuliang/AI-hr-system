from uuid import UUID
from datetime import datetime
import secrets
from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, BackgroundTasks

from app.models.models import CodingTest, CodingTestStatus, CodingSubmission, CodingSubmissionStatus
from app.schemas.coding_test import CodingTestCreate, CodingTestUpdate
from app.services.code_runner_service import run_code_against_tests
from app.services.coding_test_ai_service import generate_coding_evaluation_background


def _generate_public_token() -> str:
    return secrets.token_urlsafe(16)


def create_coding_test(db: Session, coding_test: CodingTestCreate, creator_id: UUID) -> CodingTest:
    token = _generate_public_token()
    for _ in range(5):
        exists = db.query(CodingTest).filter(CodingTest.public_token == token).first()
        if not exists:
            break
        token = _generate_public_token()
    else:
        raise HTTPException(status_code=500, detail="Failed to generate public token")

    db_test = CodingTest(
        title=coding_test.title,
        description=coding_test.description,
        difficulty=coding_test.difficulty or "intermediate",
        language=coding_test.language or "javascript",
        starter_code=coding_test.starter_code,
        test_cases=coding_test.test_cases or [],
        time_limit_ms=coding_test.time_limit_ms or 3000,
        memory_limit_mb=coding_test.memory_limit_mb or 256,
        public_token=token,
        status=coding_test.status or CodingTestStatus.DRAFT,
        created_by=creator_id,
        resume_id=coding_test.resume_id,
        position_id=coding_test.position_id,
    )
    db.add(db_test)
    db.commit()
    db.refresh(db_test)
    return db_test


def list_coding_tests(db: Session, skip: int = 0, limit: int = 100) -> List[CodingTest]:
    return db.query(CodingTest).order_by(CodingTest.created_at.desc()).offset(skip).limit(limit).all()


def get_coding_test(db: Session, coding_test_id: UUID) -> Optional[CodingTest]:
    return db.query(CodingTest).filter(CodingTest.id == coding_test_id).first()


def update_coding_test(db: Session, coding_test_id: UUID, payload: CodingTestUpdate) -> Optional[CodingTest]:
    db_test = get_coding_test(db, coding_test_id)
    if not db_test:
        return None
    data = payload.dict(exclude_unset=True)
    for k, v in data.items():
        setattr(db_test, k, v)
    db.commit()
    db.refresh(db_test)
    return db_test


def delete_coding_test(db: Session, coding_test_id: UUID) -> bool:
    db_test = get_coding_test(db, coding_test_id)
    if not db_test:
        return False
    db.delete(db_test)
    db.commit()
    return True


def publish_coding_test(db: Session, coding_test_id: UUID) -> Optional[CodingTest]:
    db_test = get_coding_test(db, coding_test_id)
    if not db_test:
        return None
    db_test.status = CodingTestStatus.PUBLISHED
    db.commit()
    db.refresh(db_test)
    return db_test


def close_coding_test(db: Session, coding_test_id: UUID) -> Optional[CodingTest]:
    db_test = get_coding_test(db, coding_test_id)
    if not db_test:
        return None
    db_test.status = CodingTestStatus.CLOSED
    db.commit()
    db.refresh(db_test)
    return db_test


def get_public_coding_test(db: Session, token: str) -> Optional[CodingTest]:
    return db.query(CodingTest).filter(CodingTest.public_token == token).first()


def run_public_code(db: Session, token: str, code: str, language: str) -> dict:
    db_test = get_public_coding_test(db, token)
    if not db_test or db_test.status != CodingTestStatus.PUBLISHED:
        raise HTTPException(status_code=404, detail="Coding test not found")
    run = run_code_against_tests(language=language, code=code, test_cases=db_test.test_cases or [], time_limit_ms=db_test.time_limit_ms or 3000)
    return run


def submit_public_code(db: Session, background_tasks: BackgroundTasks, token: str, candidate_name: Optional[str], candidate_email: Optional[str], code: str, language: str) -> CodingSubmission:
    db_test = get_public_coding_test(db, token)
    if not db_test or db_test.status != CodingTestStatus.PUBLISHED:
        raise HTTPException(status_code=404, detail="Coding test not found")

    run = run_code_against_tests(language=language, code=code, test_cases=db_test.test_cases or [], time_limit_ms=db_test.time_limit_ms or 3000)

    db_sub = CodingSubmission(
        coding_test_id=db_test.id,
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        language=language,
        code=code,
        run_result=run,
        passed=bool(run.get("passed")),
        score=int(run.get("score", 0)),
        status=CodingSubmissionStatus.SUBMITTED,
        submitted_at=datetime.utcnow(),
    )
    db.add(db_sub)
    db.commit()
    db.refresh(db_sub)

    background_tasks.add_task(generate_coding_evaluation_background, db_sub.id)

    return db_sub


def get_public_submission(db: Session, token: str, submission_id: UUID) -> Optional[CodingSubmission]:
    db_test = get_public_coding_test(db, token)
    if not db_test:
        return None
    return db.query(CodingSubmission).filter(CodingSubmission.id == submission_id, CodingSubmission.coding_test_id == db_test.id).first()


def list_coding_test_submissions(db: Session, coding_test_id: UUID, skip: int = 0, limit: int = 100) -> List[CodingSubmission]:
    return (
        db.query(CodingSubmission)
        .filter(CodingSubmission.coding_test_id == coding_test_id)
        .order_by(CodingSubmission.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_coding_submission(db: Session, submission_id: UUID) -> Optional[CodingSubmission]:
    return db.query(CodingSubmission).filter(CodingSubmission.id == submission_id).first()
