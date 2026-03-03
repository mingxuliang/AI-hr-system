from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.config.database import get_db
from app.core.security import check_roles
from app.models.models import User, UserRole, CodingTestStatus
from app.routes.auth import get_current_user
from app.schemas.coding_test import (
    CodingTestCreate,
    CodingTestUpdate,
    CodingTestResponse,
    LeetCodeImportRequest,
    LeetCodeImportResponse,
    PublicCodingTestResponse,
    CodingRunRequest,
    CodingRunResponse,
    CodingSubmitRequest,
    CodingSubmissionResponse,
    PublicCodingSubmissionResponse,
)
from app.services.leetcode_import_service import import_leetcode_problem
from app.services.coding_test_service import (
    create_coding_test,
    list_coding_tests,
    get_coding_test,
    update_coding_test,
    delete_coding_test,
    publish_coding_test,
    close_coding_test,
    list_coding_test_submissions,
    get_coding_submission,
    get_public_coding_test,
    run_public_code,
    submit_public_code,
    get_public_submission,
)


router = APIRouter(prefix="/coding-tests", tags=["coding-tests"])


@router.post("", response_model=CodingTestResponse)
def create_coding_test_route(
    payload: CodingTestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR])),
):
    return create_coding_test(db, payload, current_user.id)


@router.get("", response_model=List[CodingTestResponse])
def list_coding_tests_route(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR])),
):
    return list_coding_tests(db, skip=skip, limit=limit)


@router.post("/import/leetcode", response_model=LeetCodeImportResponse)
def import_leetcode_route(
    payload: LeetCodeImportRequest,
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR])),
):
    return import_leetcode_problem(payload.url)


@router.get("/{coding_test_id}", response_model=CodingTestResponse)
def get_coding_test_route(
    coding_test_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR])),
):
    db_test = get_coding_test(db, coding_test_id)
    if not db_test:
        raise HTTPException(status_code=404, detail="Coding test not found")
    return db_test


@router.put("/{coding_test_id}", response_model=CodingTestResponse)
def update_coding_test_route(
    coding_test_id: UUID,
    payload: CodingTestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR])),
):
    db_test = update_coding_test(db, coding_test_id, payload)
    if not db_test:
        raise HTTPException(status_code=404, detail="Coding test not found")
    return db_test


@router.delete("/{coding_test_id}")
def delete_coding_test_route(
    coding_test_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR])),
):
    ok = delete_coding_test(db, coding_test_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Coding test not found")
    return {"ok": True}


@router.post("/{coding_test_id}/publish", response_model=CodingTestResponse)
def publish_coding_test_route(
    coding_test_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR])),
):
    db_test = publish_coding_test(db, coding_test_id)
    if not db_test:
        raise HTTPException(status_code=404, detail="Coding test not found")
    return db_test


@router.post("/{coding_test_id}/close", response_model=CodingTestResponse)
def close_coding_test_route(
    coding_test_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR])),
):
    db_test = close_coding_test(db, coding_test_id)
    if not db_test:
        raise HTTPException(status_code=404, detail="Coding test not found")
    return db_test


@router.get("/{coding_test_id}/submissions", response_model=List[CodingSubmissionResponse])
def list_coding_test_submissions_route(
    coding_test_id: UUID,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR])),
):
    db_test = get_coding_test(db, coding_test_id)
    if not db_test:
        raise HTTPException(status_code=404, detail="Coding test not found")
    return list_coding_test_submissions(db, coding_test_id, skip=skip, limit=limit)


@router.get("/submissions/{submission_id}", response_model=CodingSubmissionResponse)
def get_coding_submission_route(
    submission_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles([UserRole.ADMIN, UserRole.HR])),
):
    db_sub = get_coding_submission(db, submission_id)
    if not db_sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return db_sub


public_router = APIRouter(prefix="/public/coding-tests", tags=["public-coding-tests"])


@public_router.get("/{token}", response_model=PublicCodingTestResponse)
def get_public_coding_test_route(token: str, db: Session = Depends(get_db)):
    db_test = get_public_coding_test(db, token)
    if not db_test or db_test.status != CodingTestStatus.PUBLISHED:
        raise HTTPException(status_code=404, detail="Coding test not found")
    return PublicCodingTestResponse(
        title=db_test.title,
        description=db_test.description,
        difficulty=db_test.difficulty,
        language=db_test.language,
        starter_code=db_test.starter_code,
    )


@public_router.post("/{token}/run", response_model=CodingRunResponse)
def run_public_code_route(token: str, payload: CodingRunRequest, db: Session = Depends(get_db)):
    run = run_public_code(db, token, payload.code, payload.language or "javascript")
    return CodingRunResponse(
        passed=run.get("passed", False),
        score=run.get("score", 0),
        results=run.get("results", []),
        error=run.get("error"),
        raw=run.get("raw"),
    )


@public_router.post("/{token}/submit", response_model=PublicCodingSubmissionResponse)
def submit_public_code_route(
    token: str,
    payload: CodingSubmitRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    db_sub = submit_public_code(
        db,
        background_tasks,
        token,
        payload.candidate_name,
        payload.candidate_email,
        payload.code,
        payload.language or "javascript",
    )
    return PublicCodingSubmissionResponse(
        id=db_sub.id,
        coding_test_id=db_sub.coding_test_id,
        language=db_sub.language,
        run_result=db_sub.run_result,
        passed=db_sub.passed,
        score=db_sub.score,
        status=db_sub.status,
        created_at=db_sub.created_at,
        submitted_at=db_sub.submitted_at,
    )


@public_router.get("/{token}/submissions/{submission_id}", response_model=PublicCodingSubmissionResponse)
def get_public_submission_route(token: str, submission_id: UUID, db: Session = Depends(get_db)):
    db_sub = get_public_submission(db, token, submission_id)
    if not db_sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    return PublicCodingSubmissionResponse(
        id=db_sub.id,
        coding_test_id=db_sub.coding_test_id,
        language=db_sub.language,
        run_result=db_sub.run_result,
        passed=db_sub.passed,
        score=db_sub.score,
        status=db_sub.status,
        created_at=db_sub.created_at,
        submitted_at=db_sub.submitted_at,
    )
