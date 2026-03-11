from pydantic import BaseModel


class UserSettingsRead(BaseModel):
    llm_base_url: str | None = None
    llm_api_key_set: bool = False
    llm_model: str | None = None
    compression_level: str | None = None
    analysis_mode: str | None = None


class UserSettingsUpdate(BaseModel):
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None
    compression_level: str | None = None
    analysis_mode: str | None = None
