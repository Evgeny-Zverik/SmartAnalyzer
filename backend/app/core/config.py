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
    ocr_backend: str = "local"
    ocr_service_url: str = ""
    ocr_service_timeout_seconds: int = 60
    ocr_service_api_key: str = ""
    ocr_model_id: str = "kazars24/trocr-base-handwritten-ru@5342fbb29ec56eb677f553738c2fcc2befd6b0ab"
    ocr_model_fallbacks: str = "cyrillic-trocr/trocr-handwritten-cyrillic,microsoft/trocr-base-handwritten"
    ocr_generic_secondary_model_id: str = "cyrillic-trocr/trocr-handwritten-cyrillic"
    ocr_generic_ensemble_enabled: bool = False
    ocr_max_new_tokens: int = 96
    ocr_pdf_render_scale: float = 2.0
    llm_timeout_seconds: int = 60
    llm_max_retries: int = 2
    case_law_search_url: str = ""
    case_law_search_api_key: str = ""
    case_law_timeout_seconds: int = 20
    yandex_search_api_key: str = ""
    yandex_search_folder_id: str = ""
    yandex_search_api_url: str = "https://searchapi.api.cloud.yandex.net/v2/web/search"
    yandex_search_region: int = 225
    yandex_search_groups_on_page: int = 20
    yandex_search_docs_in_group: int = 1
    case_law_web_search_url: str = ""
    case_law_web_search_api_key: str = ""
    case_law_web_search_domains: str = "kad.arbitr.ru,sudrf.ru,sudact.ru"
    encryption_key: str = ""
    cors_allow_origins: str = ""
    smtp_host: str = ""
    smtp_port: int = 465
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_use_ssl: bool = True
    smtp_use_tls: bool = False
    app_public_url: str = "http://localhost:3000"
    password_reset_token_minutes: int = 60

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
