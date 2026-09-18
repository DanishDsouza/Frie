"""Load and call the saved FRIE pipeline without recreating model preprocessing."""

from __future__ import annotations

import logging
from typing import Any

import joblib
import numpy as np

from app.core.config import Settings
from app.core.feature_contract import FeatureContract, FeatureContractError, get_feature_contract
from app.services.feature_service import FeatureService

logger = logging.getLogger(__name__)


class ModelUnavailableError(RuntimeError):
    """Raised when prediction is requested while the saved model is unavailable."""


class PredictionService:
    """Application-lifetime owner of the saved preprocessing-plus-XGBoost pipeline."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._pipeline: Any | None = None
        self._load_error: str | None = None
        self._contract: FeatureContract = get_feature_contract()
        self._feature_service = FeatureService(self._contract)
        self._pipeline_feature_order: tuple[str, ...] = self._contract.feature_names

    @property
    def is_loaded(self) -> bool:
        return self._pipeline is not None

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def load_model(self) -> None:
        """Load once at startup and verify its named input feature contract."""

        if self._pipeline is not None:
            return

        try:
            self._verify_artifacts_exist()
            pipeline = joblib.load(self._settings.model_path)
            pipeline_features = tuple(str(name) for name in pipeline.feature_names_in_)
            if (
                len(pipeline_features) != self._contract.feature_count
                or set(pipeline_features) != set(self._contract.feature_names)
            ):
                raise FeatureContractError("Saved pipeline feature contract differs from FRIE configuration.")
            self._pipeline = pipeline
            self._pipeline_feature_order = pipeline_features
            self._load_error = None
            logger.info("FRIE XGBoost pipeline loaded successfully with %d features.", len(pipeline_features))
        except Exception as exc:
            self._pipeline = None
            self._load_error = type(exc).__name__
            logger.exception("FRIE model loading failed.")

    def predict(self, features: dict[str, Any]) -> float:
        """Predict using the serialized pipeline's own preprocessing stages."""

        if self._pipeline is None:
            raise ModelUnavailableError("FRIE model is unavailable.")

        row = self._feature_service.build_model_input(features, self._pipeline_feature_order)
        prediction = self._pipeline.predict(row)
        return float(np.asarray(prediction).reshape(-1)[0])

    def _verify_artifacts_exist(self) -> None:
        for path in (self._settings.model_path, self._settings.model_config_path):
            if not path.is_file():
                raise FileNotFoundError(f"Required FRIE model artifact is missing: {path.name}")
