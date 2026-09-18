"""Feature-contract and saved-pipeline tests without fabricated financial data."""

from __future__ import annotations

import json
from math import isfinite
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient
import pandas as pd
import pytest

from app.core.config import get_settings
from app.core.feature_contract import get_feature_contract
from app.api.routes.prediction import reliability_level
from app.main import app
from app.services.feature_service import FeatureInputError, FeatureService
from app.services.prediction_service import PredictionService


REAL_TEST_DATASET = Path(r"D:\frie\Model Train\frie_ml_test.csv")


@pytest.fixture(scope="module")
def real_feature_row() -> dict[str, Any]:
    """Use a complete existing row only; never manufacture a financial test customer."""

    if not REAL_TEST_DATASET.is_file():
        pytest.skip("External FRIE ML test dataset is unavailable.")

    contract = get_feature_contract()
    frame = pd.read_csv(REAL_TEST_DATASET, usecols=list(contract.feature_names))
    complete_rows = frame.dropna(subset=list(contract.feature_names))
    if complete_rows.empty:
        pytest.skip("External FRIE ML test dataset has no complete 98-feature row.")

    row = complete_rows.iloc[0].to_dict()
    return {name: value.item() if hasattr(value, "item") else value for name, value in row.items()}


def test_feature_contract_matches_the_saved_configuration() -> None:
    contract = get_feature_contract()
    config = json.loads(get_settings().model_config_path.read_text(encoding="utf-8"))

    assert contract.feature_count == 98
    assert contract.numeric_features == tuple(config["numeric_features"])
    assert contract.categorical_features == tuple(config["categorical_features"])
    assert len(contract.numeric_features) == 86
    assert len(contract.categorical_features) == 12
    assert set(contract.numeric_features).isdisjoint(contract.categorical_features)
    assert "monthly_income" in contract.numeric_features
    assert "gender" in contract.categorical_features


def test_feature_service_rejects_missing_and_unexpected_features() -> None:
    contract = get_feature_contract()
    service = FeatureService(contract)

    with pytest.raises(FeatureInputError, match="Missing required features"):
        service.build_model_input({}, contract.feature_names)

    invalid_payload = {name: 1 for name in contract.feature_names}
    invalid_payload["unexpected_field"] = "not permitted"
    with pytest.raises(FeatureInputError, match="Unexpected features"):
        service.build_model_input(invalid_payload, contract.feature_names)


def test_saved_model_loads_and_health_is_ready() -> None:
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "model_loaded": True,
        "model": "FRIE XGBoost",
    }


def test_prediction_rejects_omitted_and_unexpected_feature_payloads() -> None:
    with TestClient(app) as client:
        missing_response = client.post("/predict", json={"features": {}})
        unexpected_response = client.post("/predict", json={"features": {"unexpected_field": "x"}})

    assert missing_response.status_code == 422
    assert unexpected_response.status_code == 422
    assert "unexpected_field" in unexpected_response.text


def test_predicts_from_a_legitimate_existing_frie_test_row(real_feature_row: dict[str, Any]) -> None:
    """The external test dataset is used read-only; its target column is never requested."""

    with TestClient(app) as client:
        response = client.post("/predict", json={"features": real_feature_row})

    assert response.status_code == 200
    body = response.json()
    assert isfinite(body["frie_score"])
    assert body["reliability_level"] in {"Poor", "Average", "Good", "Excellent"}


def test_valid_prediction_response_schema_and_reliability(real_feature_row: dict[str, Any]) -> None:
    with TestClient(app) as client:
        response = client.post("/predict", json={"features": real_feature_row})

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"frie_score", "reliability_level"}
    assert isinstance(body["frie_score"], float)
    assert isinstance(body["reliability_level"], str)
    assert body["reliability_level"] == reliability_level(body["frie_score"])


def test_prediction_rejects_single_missing_feature(real_feature_row: dict[str, Any]) -> None:
    contract = get_feature_contract()
    payload = dict(real_feature_row)
    del payload[contract.numeric_features[0]]

    with TestClient(app) as client:
        response = client.post("/predict", json={"features": payload})

    assert response.status_code == 422


def test_prediction_rejects_target_column_as_input(real_feature_row: dict[str, Any]) -> None:
    payload = dict(real_feature_row)
    payload["frie_score"] = 50.0

    with TestClient(app) as client:
        response = client.post("/predict", json={"features": payload})

    assert response.status_code == 422


def test_prediction_rejects_invalid_numeric_string(real_feature_row: dict[str, Any]) -> None:
    contract = get_feature_contract()
    payload = dict(real_feature_row)
    payload[contract.numeric_features[0]] = "not-a-number"

    with TestClient(app) as client:
        response = client.post("/predict", json={"features": payload})

    assert response.status_code == 422


def test_prediction_rejects_non_finite_numbers(real_feature_row: dict[str, Any]) -> None:
    contract = get_feature_contract()
    name = contract.numeric_features[0]

    with TestClient(app) as client:
        for literal in ("NaN", "Infinity", "-Infinity"):
            payload = dict(real_feature_row)
            payload[name] = "__NON_FINITE__"
            raw = json.dumps(payload).replace('"__NON_FINITE__"', literal)
            response = client.post(
                "/predict",
                content=raw,
                headers={"Content-Type": "application/json"},
            )
            assert response.status_code == 422, literal


def test_prediction_rejects_empty_categorical(real_feature_row: dict[str, Any]) -> None:
    contract = get_feature_contract()
    payload = dict(real_feature_row)
    payload[contract.categorical_features[0]] = "  "

    with TestClient(app) as client:
        response = client.post("/predict", json={"features": payload})

    assert response.status_code == 422


def test_prediction_rejects_wrong_categorical_type(real_feature_row: dict[str, Any]) -> None:
    contract = get_feature_contract()
    payload = dict(real_feature_row)
    payload[contract.categorical_features[0]] = 123

    with TestClient(app) as client:
        response = client.post("/predict", json={"features": payload})

    assert response.status_code == 422


def test_prediction_rejects_boolean_numeric(real_feature_row: dict[str, Any]) -> None:
    contract = get_feature_contract()
    payload = dict(real_feature_row)
    payload[contract.numeric_features[0]] = True

    with TestClient(app) as client:
        response = client.post("/predict", json={"features": payload})

    assert response.status_code == 422


def test_repeated_predictions_are_identical(real_feature_row: dict[str, Any]) -> None:
    with TestClient(app) as client:
        scores = [
            client.post("/predict", json={"features": real_feature_row}).json()["frie_score"]
            for _ in range(3)
        ]

    assert scores[0] == scores[1] == scores[2]


def test_unavailable_model_reports_503(real_feature_row: dict[str, Any]) -> None:
    with TestClient(app) as client:
        original = client.app.state.prediction_service
        try:
            client.app.state.prediction_service = PredictionService(get_settings())
            health_response = client.get("/health")
            predict_response = client.post("/predict", json={"features": real_feature_row})
        finally:
            client.app.state.prediction_service = original

    assert health_response.status_code == 503
    assert predict_response.status_code == 503
