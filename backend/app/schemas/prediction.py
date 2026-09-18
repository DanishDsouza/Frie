"""Strict API schemas for source-normalized FRIE customer feature data and scores."""

from __future__ import annotations

from math import isfinite
from typing import Annotated, Any, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StrictStr, create_model

from app.core.feature_contract import get_feature_contract


FEATURE_CONTRACT = get_feature_contract()


def _strict_finite_number(value: Any) -> float:
    """Accept numeric JSON values only; strings, nulls, booleans, and infinities are rejected."""

    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError("must be a numeric JSON value")
    numeric_value = float(value)
    if not isfinite(numeric_value):
        raise ValueError("must be finite")
    return numeric_value


StrictFiniteNumber = Annotated[float, BeforeValidator(_strict_finite_number)]

_feature_fields = {
    **{name: (StrictFiniteNumber, Field(...)) for name in FEATURE_CONTRACT.numeric_features},
    **{name: (StrictStr, Field(..., min_length=1)) for name in FEATURE_CONTRACT.categorical_features},
}

CustomerFeatureData = create_model(
    "CustomerFeatureData",
    __config__=ConfigDict(extra="forbid"),
    **_feature_fields,
)


class PredictionRequest(BaseModel):
    """A complete, source-normalized customer feature record for prototype scoring."""

    model_config = ConfigDict(extra="forbid")
    features: CustomerFeatureData = Field(
        description=(
            "All 98 source-normalized customer features required by the saved FRIE pipeline. "
            "No missing values, defaults, or inferred financial facts are accepted by this API."
        )
    )


class PredictionResponse(BaseModel):
    """The score output from the saved FRIE prototype pipeline."""

    frie_score: float = Field(description="Prototype FRIE score, rounded for display.")
    reliability_level: Literal["Poor", "Average", "Good", "Excellent"] = Field(
        description="Prototype calibration category; not a regulatory or universal threshold."
    )
