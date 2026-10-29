import html
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.config.database import get_db
from app.core.security import check_roles
from app.models.models import (
    User, UserRole, CampusProject, CampusProjectStatus, Position, PositionStatus, Resume,
)
from app.schemas.campus import (
    CampusProjectCreate, CampusProjectUpdate, CampusProjectListItem, CampusProjectDetail,
    CampusPositionBrief, CampusApplicationItem, PublicCampusOut,
)
from app.schemas.resume import ResumeResponse
from app.services.resume_service import upload_resume
from app.utils.file_storage import validate_resume_file
from typing import List
from uuid import UUID

router = APIRouter(prefix="/campus", tags=["campus"])
public_router = APIRouter(prefix="/public/campus", tags=["campus-public"])

HR_ROLES = [UserRole.ADMIN, UserRole.HR]


def _status_value(status) -> str:
    return status.value if hasattr(status, "value") else str(status)


def _is_published(position: Position) -> bool:
    return _status_value(position.status) == PositionStatus.PUBLISHED.value


def _load_published_positions(db: Session, position_ids: List[UUID]) -> List[Position]:
    unique_ids = list(dict.fromkeys(position_ids))
    positions = db.query(Position).filter(Position.id.in_(unique_ids)).all()
    found = {p.id for p in positions}
    missing = [str(pid) for pid in unique_ids if pid not in found]
    if missing:
        raise HTTPException(status_code=400, detail="包含不存在的岗位")
    unpublished = [p.title for p in positions if not _is_published(p)]
    if unpublished:
        raise HTTPException(status_code=400, detail=f"只能选择已发布岗位：{'、'.join(unpublished)}")
    order = {pid: i for i, pid in enumerate(unique_ids)}
    positions.sort(key=lambda p: order.get(p.id, 0))
    return positions


def _position_brief(position: Position) -> CampusPositionBrief:
    return CampusPositionBrief(
        id=position.id,
        title=position.title,
        department=position.department,
        location=position.location,
        salary_range=position.salary_range,
        description=position.description,
        requirements=position.requirements,
    )


def _application_count(db: Session, project_id: UUID) -> int:
    return db.query(func.count(Resume.id)).filter(Resume.campus_project_id == project_id).scalar() or 0


def _list_item(db: Session, project: CampusProject) -> CampusProjectListItem:
    return CampusProjectListItem(
        id=project.id,
        school=project.school,
        company=project.company,
        title=project.title,
        status=project.status,
        position_count=len(project.positions or []),
        application_count=_application_count(db, project.id),
        created_at=project.created_at,
    )


def _application_item(resume: Resume) -> CampusApplicationItem:
    return CampusApplicationItem(
        id=resume.id,
        candidate_name=resume.candidate_name,
        contact=resume.contact,
        school=resume.school,
        major=resume.major,
        position_id=resume.position_id,
        position_title=resume.position.title if resume.position else None,
        match_score=resume.match_score,
        parse_status=resume.parse_status,
        status=_status_value(resume.status) if resume.status is not None else None,
        created_at=resume.created_at,
    )


def _get_project(db: Session, project_id: UUID) -> CampusProject:
    project = (
        db.query(CampusProject)
        .options(joinedload(CampusProject.positions))
        .filter(CampusProject.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="校招项目不存在")
    return project


def _normalize_phone(contact: str) -> str:
    phone = "".join(ch for ch in (contact or "") if ch.isdigit() or ch == "+")
    if len(phone) < 6:
        raise HTTPException(status_code=400, detail="请填写有效手机号")
    return phone


@router.get("", response_model=List[CampusProjectListItem])
def list_campus_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles(HR_ROLES)),
):
    projects = (
        db.query(CampusProject)
        .options(joinedload(CampusProject.positions))
        .order_by(CampusProject.created_at.desc())
        .all()
    )
    seen = []
    unique = []
    for project in projects:
        if project.id in seen:
            continue
        seen.append(project.id)
        unique.append(project)
    return [_list_item(db, project) for project in unique]


@router.post("", response_model=CampusProjectDetail)
def create_campus_project(
    payload: CampusProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles(HR_ROLES)),
):
    positions = _load_published_positions(db, payload.position_ids)
    project = CampusProject(
        school=payload.school.strip(),
        company=payload.company.strip(),
        title=payload.title.strip(),
        status=CampusProjectStatus.ACTIVE.value,
        positions=positions,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _detail(db, project.id)


@router.get("/{project_id}", response_model=CampusProjectDetail)
def get_campus_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles(HR_ROLES)),
):
    return _detail(db, project_id)


@router.put("/{project_id}", response_model=CampusProjectDetail)
def update_campus_project(
    project_id: UUID,
    payload: CampusProjectUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles(HR_ROLES)),
):
    project = _get_project(db, project_id)
    if project.status == CampusProjectStatus.CLOSED.value:
        raise HTTPException(status_code=400, detail="已关闭的校招不能修改")
    positions = _load_published_positions(db, payload.position_ids)
    project.school = payload.school.strip()
    project.company = payload.company.strip()
    project.title = payload.title.strip()
    project.positions = positions
    db.commit()
    return _detail(db, project_id)


@router.post("/{project_id}/close", response_model=CampusProjectDetail)
def close_campus_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles(HR_ROLES)),
):
    project = _get_project(db, project_id)
    project.status = CampusProjectStatus.CLOSED.value
    db.commit()
    return _detail(db, project_id)


@router.delete("/{project_id}")
def delete_campus_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_roles(HR_ROLES)),
):
    project = _get_project(db, project_id)
    db.delete(project)
    db.commit()
    return {"ok": True}


def _detail(db: Session, project_id: UUID) -> CampusProjectDetail:
    project = _get_project(db, project_id)
    applications = (
        db.query(Resume)
        .options(joinedload(Resume.position))
        .filter(Resume.campus_project_id == project.id)
        .order_by(Resume.match_score.desc().nulls_last(), Resume.created_at.desc())
        .all()
    )
    base = _list_item(db, project)
    return CampusProjectDetail(
        **base.model_dump(),
        positions=[_position_brief(p) for p in (project.positions or [])],
        applications=[_application_item(r) for r in applications],
    )


@public_router.get("/{project_id}", response_model=PublicCampusOut)
def get_public_campus(project_id: UUID, db: Session = Depends(get_db)):
    project = _get_project(db, project_id)
    accepting = project.status == CampusProjectStatus.ACTIVE.value
    positions = [p for p in (project.positions or []) if _is_published(p)] if accepting else []
    return PublicCampusOut(
        id=project.id,
        school=project.school,
        company=project.company,
        title=project.title,
        status=project.status,
        accepting=accepting and len(positions) > 0,
        positions=[_position_brief(p) for p in positions],
    )


def _job_cards(positions: list) -> str:
    cards = []
    for position in positions:
        pid = html.escape(str(position.id))
        name = html.escape(position.title or "未命名岗位")
        meta = " · ".join(
            html.escape(part)
            for part in (position.department, position.location, position.salary_range)
            if part
        )
        meta_html = f'<span class="job-meta">{meta}</span>' if meta else ""
        duty = html.escape((position.description or "暂无描述")[:1200])
        req = html.escape((position.requirements or "暂无要求")[:800])
        cards.append(
            f"""<label class="job">
<input type="radio" name="position_id" value="{pid}" required>
<span class="job-mark"></span>
<span class="job-copy"><span class="job-title">{name}</span>{meta_html}</span>
</label>
<details class="jd">
<summary>查看职位说明</summary>
<p class="jd-label">岗位职责</p><p>{duty}</p>
<p class="jd-label">任职要求</p><p>{req}</p>
</details>"""
        )
    return "\n".join(cards)


_APPLY_PAGE = """<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="format-detection" content="telephone=no">
<title>__SCHOOL__ 校招投递</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    min-height: 100dvh;
    font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
    color: #e8eefc;
    background:
      radial-gradient(120% 70% at 80% -10%, rgba(56, 189, 248, .45), transparent 55%),
      radial-gradient(90% 60% at -10% 20%, rgba(99, 102, 241, .55), transparent 50%),
      radial-gradient(70% 50% at 100% 80%, rgba(14, 165, 233, .25), transparent 45%),
      #070b16;
    padding:
      calc(20px + env(safe-area-inset-top))
      16px
      calc(28px + env(safe-area-inset-bottom));
  }
  body.closed #apply, body.open #closed { display: none; }
  main { width: min(100%, 440px); margin: 0 auto; }
  .eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    margin: 0 0 14px; padding: 6px 12px; border-radius: 999px;
    background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.14);
    letter-spacing: .14em; font-size: 11px; color: #c7d2fe;
  }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: #22d3ee; box-shadow: 0 0 12px #22d3ee; }
  .brand { margin: 0 0 10px; font-size: 15px; font-weight: 700; letter-spacing: .12em; color: #67e8f9; }
  h1 { margin: 0; font-size: 34px; line-height: 1.15; letter-spacing: -0.03em; word-break: break-word; }
  .session { margin: 10px 0 22px; color: #9fb0d0; font-size: 16px; line-height: 1.5; }
  .card {
    background: rgba(255,255,255,.96); color: #0f172a;
    border-radius: 24px; padding: 18px 16px 16px;
    box-shadow: 0 24px 60px rgba(2, 6, 23, .35);
  }
  .field { display: block; margin-bottom: 14px; }
  .field span, .block-label { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #334155; }
  input[type="text"], input[type="tel"] {
    width: 100%; height: 48px; border-radius: 14px; border: 1px solid #e2e8f0;
    background: #f8fafc; padding: 0 14px; font-size: 16px; color: #0f172a;
  }
  input:focus { outline: 2px solid #818cf8; border-color: transparent; background: #fff; }
  .jobs { display: flex; flex-direction: column; gap: 10px; }
  .job {
    position: relative; display: flex; align-items: flex-start; gap: 12px;
    min-height: 56px; padding: 14px; border-radius: 16px;
    border: 1px solid #e2e8f0; background: #f8fafc;
  }
  .job input { position: absolute; opacity: 0; pointer-events: none; }
  .job-mark {
    flex: none; width: 20px; height: 20px; margin-top: 1px; border-radius: 50%;
    border: 2px solid #cbd5e1; background: #fff;
  }
  .job:has(input:checked), .job.checked { border-color: #4f46e5; background: #eef2ff; box-shadow: 0 0 0 3px rgba(79,70,229,.15); }
  .job:has(input:checked) .job-mark, .job.checked .job-mark { border-color: #4f46e5; background: radial-gradient(circle at center, #4f46e5 0 5px, #fff 6px); }
  .job-copy { min-width: 0; }
  .job-title { display: block; font-size: 16px; font-weight: 650; line-height: 1.35; word-break: break-word; }
  .job-meta { display: block; margin-top: 4px; color: #64748b; font-size: 13px; line-height: 1.4; }
  .jd { margin: -2px 0 4px; color: #334155; }
  .jd summary { padding: 4px 2px 8px; color: #4f46e5; font-size: 13px; }
  .jd p { margin: 0 0 8px; white-space: pre-wrap; word-break: break-word; font-size: 14px; line-height: 1.6; color: #475569; }
  .jd-label { font-weight: 700; color: #0f172a !important; margin-top: 4px !important; }
  .file { display: block; margin: 4px 0 8px; }
  .file input { position: absolute; width: 1px; height: 1px; opacity: 0; }
  .file-ui {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 18px 12px; border-radius: 16px; text-align: center;
    border: 1.5px dashed #c7d2fe; background: linear-gradient(180deg, #f8fafc, #eef2ff);
  }
  .file-title { font-size: 16px; font-weight: 700; }
  .file-hint, .file-name { font-size: 12px; color: #64748b; line-height: 1.45; }
  .file-name { color: #4f46e5; font-weight: 600; }
  button {
    width: 100%; height: 52px; margin-top: 8px; border: 0; border-radius: 16px;
    color: #fff; font-size: 16px; font-weight: 700; letter-spacing: .04em;
    background: linear-gradient(90deg, #4f46e5, #0ea5e9);
    box-shadow: 0 12px 24px rgba(79, 70, 229, .28);
  }
  button:disabled { opacity: .65; }
  #msg { min-height: 1.2em; margin: 10px 0 0; text-align: center; color: #b45309; font-size: 14px; }
  .success { text-align: center; padding: 12px 8px 8px; }
  .check {
    width: 72px; height: 72px; margin: 4px auto 16px; border-radius: 50%;
    display: grid; place-items: center;
    background: linear-gradient(180deg, #22d3ee, #4f46e5);
    box-shadow: 0 12px 30px rgba(79, 70, 229, .35);
  }
  .check span {
    width: 18px; height: 10px; margin-top: -4px;
    border-left: 3px solid #fff; border-bottom: 3px solid #fff; transform: rotate(-45deg);
  }
  .success h2 { margin: 0 0 8px; font-size: 26px; }
  .success p { margin: 0; color: #64748b; font-size: 15px; line-height: 1.6; }
  .closed-copy h2 { margin: 0 0 8px; font-size: 22px; }
  .closed-copy p { margin: 0; color: #64748b; line-height: 1.6; }
</style>
</head>
<body class="__MODE__">
<main>
  <p class="eyebrow"><i class="dot"></i>CAMPUS</p>
  __COMPANY__
  <h1>__SCHOOL__</h1>
  <p class="session">__TITLE__</p>
  <section id="closed" class="card closed-copy">
    <h2>暂不接受投递</h2>
    <p>本次校招已结束。感谢你的关注，欢迎关注后续招聘。</p>
  </section>
  <form id="apply" class="card">
    <label class="field"><span>姓名</span><input name="candidate_name" type="text" required maxlength="50" autocomplete="name" placeholder="请输入真实姓名"></label>
    <label class="field"><span>专业</span><input name="major" type="text" required maxlength="100" placeholder="例如：计算机科学与技术"></label>
    <label class="field"><span>手机号</span><input name="contact" type="tel" required inputmode="tel" maxlength="20" autocomplete="tel" placeholder="用于联系和查重"></label>
    <div class="block-label">投递岗位</div>
    <div class="jobs">__JOBS__</div>
    <div class="block-label" style="margin-top:14px">简历附件</div>
    <label class="file">
      <input name="file" type="file" required accept=".pdf,.doc,.docx,.txt,.md,.markdown,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain">
      <span class="file-ui">
        <span class="file-title">点击上传简历</span>
        <span class="file-hint">支持 PDF、Word、TXT、Markdown，不超过 10MB</span>
        <span class="file-name" id="fileName">尚未选择文件</span>
      </span>
    </label>
    <button id="submit" type="submit">提交投递</button>
    <p id="msg"></p>
  </form>
  <section id="done" class="card success" hidden>
    <div class="check"><span></span></div>
    <h2>投递成功</h2>
    <p>简历已提交，我们会尽快完成评估。</p>
  </section>
</main>
<script>
document.querySelectorAll('.job input').forEach(function (input) {
  input.addEventListener('change', function () {
    document.querySelectorAll('.job').forEach(function (job) { job.classList.remove('checked'); });
    var card = input.closest('.job');
    if (card) card.classList.add('checked');
  });
});
var fileInput = document.querySelector('input[name="file"]');
if (fileInput) {
  fileInput.addEventListener('change', function () {
    var picked = fileInput.files && fileInput.files[0];
    document.getElementById('fileName').textContent = picked ? picked.name : '尚未选择文件';
  });
}
var form = document.getElementById('apply');
if (form) form.onsubmit = async function (event) {
  event.preventDefault();
  var button = document.getElementById('submit');
  var msg = document.getElementById('msg');
  button.disabled = true;
  msg.textContent = '正在提交...';
  try {
    var response = await fetch('apply', { method: 'POST', body: new FormData(form) });
    var data = await response.json().catch(function () { return {}; });
    if (response.ok) {
      form.hidden = true;
      document.getElementById('done').hidden = false;
      window.scrollTo(0, 0);
      return;
    }
    msg.textContent = (typeof data.detail === 'string' && data.detail) || '投递失败，请稍后重试';
  } catch (error) {
    msg.textContent = '网络异常，请重试';
  }
  button.disabled = false;
};
</script>
</body>
</html>
"""


def _campus_apply_page(project: CampusProject, positions: list) -> str:
    closed = project.status != CampusProjectStatus.ACTIVE.value or not positions
    return (
        _APPLY_PAGE
        .replace("__COMPANY__", f'<p class="brand">{html.escape(project.company)}</p>' if project.company else "")
        .replace("__SCHOOL__", html.escape(project.school or ""))
        .replace("__TITLE__", html.escape(project.title or ""))
        .replace("__MODE__", "closed" if closed else "open")
        .replace("__JOBS__", "" if closed else _job_cards(positions))
    )


@public_router.get("/{project_id}/page", response_class=HTMLResponse)
def campus_apply_page(project_id: UUID, db: Session = Depends(get_db)):
    project = _get_project(db, project_id)
    accepting = project.status == CampusProjectStatus.ACTIVE.value
    positions = [p for p in (project.positions or []) if _is_published(p)] if accepting else []
    return HTMLResponse(_campus_apply_page(project, positions))


@public_router.post("/{project_id}/apply", response_model=ResumeResponse)
def apply_campus(
    project_id: UUID,
    background_tasks: BackgroundTasks,
    candidate_name: str = Form(...),
    major: str = Form(...),
    contact: str = Form(...),
    position_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    project = _get_project(db, project_id)
    if project.status != CampusProjectStatus.ACTIVE.value:
        raise HTTPException(status_code=400, detail="该校招已结束，暂不接受投递")

    name = (candidate_name or "").strip()
    major_text = (major or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="请填写姓名")
    if not major_text:
        raise HTTPException(status_code=400, detail="请填写专业")
    phone = _normalize_phone(contact)

    allowed = {p.id for p in (project.positions or [])}
    if position_id not in allowed:
        raise HTTPException(status_code=400, detail="该岗位不在本次校招中")
    position = db.query(Position).filter(Position.id == position_id).first()
    if not position or not _is_published(position):
        raise HTTPException(status_code=400, detail="该岗位未开放投递")

    existing = (
        db.query(Resume)
        .filter(
            Resume.campus_project_id == project.id,
            Resume.position_id == position_id,
            Resume.contact == phone,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="您已投递过该岗位")

    validate_resume_file(file)
    resume = upload_resume(
        db,
        file,
        position_id,
        background_tasks,
        candidate_name=name,
        contact=phone,
    )
    resume.school = project.school
    resume.major = major_text
    resume.campus_project_id = project.id
    db.commit()
    db.refresh(resume)
    return resume
