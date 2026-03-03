from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, Tuple

from app.config.database import get_db
from app.core.security import check_roles
from app.models.models import SystemConfig, UserRole
from app.schemas.settings import SystemModelConfigResponse, SystemModelConfigUpdate


router = APIRouter(
    prefix="/settings",
    tags=["settings"],
)


def _mask_key(api_key: Optional[str]) -> Tuple[bool, Optional[str]]:
    if not api_key:
        return False, None
    return True, api_key[-4:]


def _get_or_create_config(db: Session) -> SystemConfig:
    config = db.query(SystemConfig).first()
    if config:
        return config
    config = SystemConfig()
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.get("/system", response_model=SystemModelConfigResponse)
def get_system_settings(
    db: Session = Depends(get_db),
    _current_user=Depends(check_roles([UserRole.ADMIN])),
):
    config = _get_or_create_config(db)
    api_key_set, api_key_last4 = _mask_key(config.llm_api_key)
    return SystemModelConfigResponse(
        llm_base_url=config.llm_base_url or "https://dashscope.aliyuncs.com/compatible-mode/v1",
        llm_model=config.llm_model or "qwen3.5-plus",
        llm_api_key_set=api_key_set,
        llm_api_key_last4=api_key_last4,
    )


@router.put("/system", response_model=SystemModelConfigResponse)
def update_system_settings(
    payload: SystemModelConfigUpdate,
    db: Session = Depends(get_db),
    _current_user=Depends(check_roles([UserRole.ADMIN])),
):
    config = _get_or_create_config(db)
    data = payload.dict(exclude_unset=True)

    if "llm_base_url" in data:
        config.llm_base_url = (data["llm_base_url"] or "").strip() or None

    if "llm_model" in data:
        model = (data["llm_model"] or "").strip()
        if model:
            config.llm_model = model

    if "llm_api_key" in data:
        api_key = (data["llm_api_key"] or "").strip()
        if api_key:
            config.llm_api_key = api_key

    if not config.llm_base_url:
        raise HTTPException(status_code=400, detail="请配置 Base URL")

    if not config.llm_model:
        raise HTTPException(status_code=400, detail="请配置 Model")

    if not config.llm_api_key:
        raise HTTPException(status_code=400, detail="请配置 API Key")

    db.commit()
    db.refresh(config)

    api_key_set, api_key_last4 = _mask_key(config.llm_api_key)
    return SystemModelConfigResponse(
        llm_base_url=config.llm_base_url,
        llm_model=config.llm_model or "qwen3.5-plus",
        llm_api_key_set=api_key_set,
        llm_api_key_last4=api_key_last4,
    )
