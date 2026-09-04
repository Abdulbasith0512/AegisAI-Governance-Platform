from typing import List, Union
import json
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    """
    Application settings for AegisAI.
    Loads configurations from environment variables or a .env file.
    """
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    # Project Information
    PROJECT_NAME: str = Field(default="AegisAI", description="The name of the application.")
    VERSION: str = Field(default="1.0.0", description="SemVer version code.")
    ENVIRONMENT: str = Field(default="development", description="Execution environment (development, staging, production).")
    LOG_LEVEL: str = Field(default="INFO", description="Log level thresholds (DEBUG, INFO, WARNING, ERROR).")
    SECRET_KEY: str = Field(default="aegisai_default_secret_key_change_me_in_production_environments_32_chars", description="JWT secret hashing sign key.")

    # Server Bind configurations
    BACKEND_HOST: str = Field(default="0.0.0.0", description="IP address bind target.")
    BACKEND_PORT: int = Field(default=8000, description="Network port bind target.")
    CORS_ORIGINS: List[str] = Field(
        default=[
            "http://localhost:3000", "http://127.0.0.1:3000",
            "http://localhost:3001", "http://127.0.0.1:3001",
            "http://localhost:3002", "http://127.0.0.1:3002",
            "http://localhost:5173", "http://127.0.0.1:5173"
        ], 
        description="Allowed Cross-Origin requests paths."
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        # Accept JSON list string from .env ('["http://..."]') or comma-separated string.
        if isinstance(v, str):
            s = v.strip()
            if not s:
                return []
            if s.startswith("["):
                try:
                    parsed = json.loads(s)
                    if isinstance(parsed, list):
                        return [str(x).strip() for x in parsed if str(x).strip()]
                except json.JSONDecodeError:
                    pass
            # Fallback: comma-separated
            return [p.strip().strip('"').strip("'") for p in s.split(",") if p.strip()]
        return v

    @field_validator("LOG_LEVEL", mode="before")
    @classmethod
    def normalize_log_level(cls, v: str) -> str:
        return str(v).upper() if isinstance(v, str) else v

    # Relational Database Connection (PostgreSQL)
    DB_HOST: str = Field(default="localhost")
    DB_PORT: int = Field(default=5432)
    DB_USER: str = Field(default="postgres")
    DB_PASSWORD: str = Field(default="postgres_password")
    DB_NAME: str = Field(default="aegisai_db")
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://postgres:postgres_password@localhost:5432/aegisai_db",
        description="SQLAlchemy asyncpg PostgreSQL connection URL."
    )

    # Caching Layer (Redis)
    REDIS_HOST: str = Field(default="localhost")
    REDIS_PORT: int = Field(default=6379)
    REDIS_URL: str = Field(default="redis://localhost:6379/0")

    # Graph Database Connection (Neo4j)
    NEO4J_URI: str = Field(default="bolt://localhost:7687")
    NEO4J_USER: str = Field(default="neo4j")
    NEO4J_PASSWORD: str = Field(default="neo4j_password")

    # Vector Storage Connection (Qdrant)
    QDRANT_HOST: str = Field(default="localhost")
    QDRANT_PORT: int = Field(default=6333)
    QDRANT_URL: str = Field(default="http://localhost:6333")
    QDRANT_API_KEY: str = Field(default="")

    # Third-Party Model Providers Credentials
    OPENAI_API_KEY: str = Field(default="")
    ANTHROPIC_API_KEY: str = Field(default="")
    HUGGINGFACE_API_TOKEN: str = Field(default="")

    # Outbound Mail Server (SMTP) Configurations
    SMTP_HOST: str = Field(default="")
    SMTP_PORT: int = Field(default=587)
    SMTP_USER: str = Field(default="")
    SMTP_PASSWORD: str = Field(default="")
    SMTP_FROM: str = Field(default="noreply@aegisai.io")

    # Core Banking Governance Policies
    HUMAN_REVIEW_THRESHOLD: int = Field(default=75, description="Auditor review limit trigger score.")
    TRUST_SCORE_MIN_THRESHOLD: int = Field(default=50, description="Hard block score limit trigger.")
    COMPLIANCE_MODE: str = Field(default="strict", description="Governance compliance mode validation settings.")
