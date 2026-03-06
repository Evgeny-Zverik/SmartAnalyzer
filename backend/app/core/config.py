from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    env: str = "local"
    database_url: str = ""
    jwt_secret: str = "change_me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    storage_path: str = "/storage/documents"
    max_upload_bytes: int = 20 * 1024 * 1024
    openai_api_key: str = ""
    openai_base_url: str = ""
    openai_model: str = "gpt-4o-mini"
    llm_timeout_seconds: int = 60
    llm_max_retries: int = 2

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
