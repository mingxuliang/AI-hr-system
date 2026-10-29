from pydantic import BaseModel, ConfigDict, field_validator
from typing import Optional
from uuid import UUID
from app.models.models import UserRole

# DB 列名仍为 email，语义为登录用户名（可任意账号，不必是邮箱）
_USERNAME_MIN = 2
_USERNAME_MAX = 64


def _normalize_username(v: str) -> str:
    v = (v or "").strip()
    if len(v) < _USERNAME_MIN or len(v) > _USERNAME_MAX:
        raise ValueError(f"用户名长度需为 {_USERNAME_MIN}–{_USERNAME_MAX} 个字符")
    if any(ch.isspace() for ch in v):
        raise ValueError("用户名不能包含空格")
    return v


class UserBase(BaseModel):
    email: str  # 登录用户名
    full_name: Optional[str] = None
    role: Optional[UserRole] = UserRole.HR

    @field_validator("email")
    @classmethod
    def validate_username(cls, v: str) -> str:
        return _normalize_username(v)

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: str  # 登录用户名
    password: str

    @field_validator("email")
    @classmethod
    def validate_username(cls, v: str) -> str:
        return _normalize_username(v)

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[UserRole] = None

class UserUpdateMe(BaseModel):
    full_name: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UserResponse(UserBase):
    id: UUID
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
