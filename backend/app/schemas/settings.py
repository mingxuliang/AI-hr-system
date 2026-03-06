from pydantic import BaseModel
from typing import Optional


class SystemModelConfigResponse(BaseModel):
    llm_base_url: Optional[str] = None
    llm_model: str
    llm_api_key_set: bool
    llm_api_key_last4: Optional[str] = None


class SystemModelConfigUpdate(BaseModel):
    llm_base_url: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None


class MailConfigResponse(BaseModel):
    """邮件配置响应"""
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 465
    smtp_username: Optional[str] = None
    smtp_password_set: bool = False
    mail_from: Optional[str] = None
    mail_from_name: Optional[str] = "招聘系统"
    mail_enabled: bool = False


class MailConfigUpdate(BaseModel):
    """邮件配置更新"""
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_username: Optional[str] = None
    smtp_password: Optional[str] = None
    mail_from: Optional[str] = None
    mail_from_name: Optional[str] = None
    mail_enabled: Optional[bool] = None


class SystemConfigResponse(BaseModel):
    """系统配置响应（包含LLM和邮件配置）"""
    llm: SystemModelConfigResponse
    mail: MailConfigResponse


class SystemConfigUpdate(BaseModel):
    """系统配置更新"""
    llm: Optional[SystemModelConfigUpdate] = None
    mail: Optional[MailConfigUpdate] = None
