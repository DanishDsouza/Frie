"""FRIE saved-pipeline prediction endpoint."""

from fastapi import APIRouter, HTTPException, Request, status

from app.schemas.prediction import PredictionRequest, PredictionResponse
from app.services.feature_service import FeatureInputError
from app.services.prediction_service import ModelUnavailableError

router = APIRouter(tags=["prediction"])


def reliability_level(score: float) -> str:
    """Apply the project-defined prototype display calibration boundaries."""

    if score < 40:
        return "Poor"
    if score < 55:
        return "Average"
    if score < 70:
        return "Good"
    return "Excellent"


@router.post(
    "/predict",
    response_model=PredictionResponse,
    summary="Generate a prototype FRIE score using the saved XGBoost pipeline",
    description=(
        "Requires every configured FRIE feature. This is a prototype/research score and is "
        "not a regulatory, universal, or externally validated financial-reliability assessment."
    ),
)
def predict(payload: PredictionRequest, request: Request) -> PredictionResponse:
    service = request.app.state.prediction_service
    try:
        score = service.predict(payload.features.model_dump())
    except ModelUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FRIE prediction service is temporarily unavailable.",
        ) from exc
    except FeatureInputError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    return PredictionResponse(frie_score=round(score, 2), reliability_level=reliability_level(score))
