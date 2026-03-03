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
