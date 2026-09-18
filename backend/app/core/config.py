"""Environment-aware application settings with path-safe model locations."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import os


@dataclass(frozen=True)
class Settings:
    """Runtime settings. No secrets are defined by default."""

    backend_dir: Path
    model_path: Path
    model_config_path: Path
    cors_origins: tuple[str, ...]


def _cors_origins_from_environment() -> tuple[str, ...]:
    raw_origins = os.getenv("FRIE_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return tuple(origin.strip() for origin in raw_origins.split(",") if origin.strip())


def get_settings() -> Settings:
    """Build settings from paths relative to this module, not the working directory."""

    backend_dir = Path(__file__).resolve().parents[2]
    models_dir = backend_dir / "models"
    return Settings(
        backend_dir=backend_dir,
        model_path=models_dir / "frie_xgboost_final_pipeline_v2.joblib",
        model_config_path=models_dir / "frie_model_config_v2.json",
        cors_origins=_cors_origins_from_environment(),
    )
