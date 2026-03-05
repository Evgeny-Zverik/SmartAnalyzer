from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    env: str = "local"
    database_url: str = ""
    jwt_secret: str = "change_me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    storage_path: str = "/storage/documents"
    max_upload_bytes: int = 20 * 1024 * 1024

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
