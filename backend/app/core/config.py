from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "FMCG Digital Twin API"
    environment: str = "dev"
    postgres_dsn: str = "postgresql://postgres:postgres@localhost:5432/fmcg"
    forecasting_model: str = "statsmodels"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
