from __future__ import annotations

import atexit
import hashlib
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from pymongo import InsertOne, MongoClient, UpdateOne
from pymongo.collection import Collection
from pymongo.errors import PyMongoError
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")

SERVICE_NAME = "Guard-logs-ML"
SERVICE_PORT = int(os.getenv("GUARD_LOGS_ML_PORT", "8100"))
MONGODB_URL = os.getenv(
    "MONGODB_URL",
    "mongodb://admin:logguard123@localhost:27017/logguard?authSource=admin",
)
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "logguard")
MONGODB_ML_DB_NAME = os.getenv("MONGODB_ML_DB_NAME", "logguard_ml")
MODEL_DIR = Path(os.getenv("ML_MODEL_DIR", Path(__file__).resolve().parent / "model"))
TRAIN_TEST_SIZE = float(os.getenv("ML_TRAIN_TEST_SIZE", "0.25"))
MIN_TRAINING_ROWS = int(os.getenv("ML_MIN_TRAINING_ROWS", "32"))
TRAINING_DATASET_NAME = os.getenv("ML_TRAINING_DATASET_NAME", "LogGuard logs")
AUTO_TRAIN_ON_RUN = os.getenv("ML_AUTO_TRAIN_ON_RUN", "true").strip().lower() != "false"

MODEL_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("guard-logs-ml")

app = Flask(__name__)

mongo_client: MongoClient | None = None

SEVERITY_BY_LABEL = {
    "Benign": "low",
    "Port Scan": "medium",
    "Brute Force": "high",
    "DDoS": "critical",
    "Web Attack": "high",
    "SQL Injection": "critical",
    "Botnet": "critical",
    "Infiltration": "critical",
    "Heartbleed": "critical",
}

ALERT_MESSAGES = {
    "DDoS": "DDoS attack detected from {src_ip}",
    "Port Scan": "Port scanning activity from {src_ip}",
    "Brute Force": "Brute force attempt from {src_ip}",
    "Web Attack": "Web attack detected from {src_ip}",
    "SQL Injection": "SQL injection attempt from {src_ip}",
    "Botnet": "Botnet activity detected from {src_ip}",
    "Infiltration": "Network infiltration from {src_ip}",
    "Heartbleed": "Heartbleed exploit attempt from {src_ip}",
}

NUMERIC_FEATURES = [
    "src_port",
    "dst_port",
    "bytes_sent",
    "bytes_received",
    "packets",
    "duration",
    "total_bytes",
    "byte_balance",
    "packets_per_second",
]

CATEGORICAL_FEATURES = [
    "protocol",
    "dst_port_bucket",
    "src_scope",
    "dst_scope",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def to_builtin(value: Any) -> Any:
    if isinstance(value, dict):
        return {str(key): to_builtin(inner) for key, inner in value.items()}
    if isinstance(value, list):
        return [to_builtin(inner) for inner in value]
    if isinstance(value, tuple):
        return [to_builtin(inner) for inner in value]
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, Path):
        return str(value)
    return value


def parse_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "si"}:
            return True
        if normalized in {"0", "false", "no"}:
            return False
    return default


def normalize_label(label: Any) -> str:
    value = str(label or "Benign").strip()
    return value if value else "Benign"


def severity_for_label(label: str) -> str:
    return SEVERITY_BY_LABEL.get(label, "medium")


def is_internal_ip(ip: str) -> str:
    value = str(ip or "").strip()
    if value.startswith("10.") or value.startswith("192.168."):
        return "private"
    if value.startswith("172."):
        parts = value.split(".")
        if len(parts) > 1:
            try:
                second_octet = int(parts[1])
            except ValueError:
                second_octet = -1
            if 16 <= second_octet <= 31:
                return "private"
    return "public"


def bucket_port(port: pd.Series) -> pd.Series:
    series = port.fillna(0).astype(int)
    return np.select(
        [
            series <= 0,
            series <= 1023,
            series <= 49151,
        ],
        [
            "unknown",
            "well-known",
            "registered",
        ],
        default="dynamic",
    )


def stable_hash(*parts: Any, prefix: str = "") -> str:
    digest = hashlib.md5("::".join(str(part) for part in parts).encode("utf-8")).hexdigest()[:16]
    return f"{prefix}{digest}" if prefix else digest


def get_mongo_client() -> MongoClient:
    global mongo_client
    if mongo_client is None:
        mongo_client = MongoClient(MONGODB_URL)
        mongo_client.admin.command("ping")
        logger.info("Connected to MongoDB")
    return mongo_client


def close_mongo_client() -> None:
    global mongo_client
    if mongo_client is not None:
        mongo_client.close()
        mongo_client = None


atexit.register(close_mongo_client)


def logs_collection() -> Collection:
    return get_mongo_client()[MONGODB_DB_NAME]["logs"]


def alerts_collection() -> Collection:
    return get_mongo_client()[MONGODB_DB_NAME]["alerts"]


def model_registry_collection() -> Collection:
    return get_mongo_client()[MONGODB_ML_DB_NAME]["model_registry"]


def ml_runs_collection() -> Collection:
    return get_mongo_client()[MONGODB_ML_DB_NAME]["ml_runs"]


def ensure_indexes() -> None:
    index_builders = [
        ("logs.id", lambda: logs_collection().create_index("id", unique=True)),
        ("alerts.id", lambda: alerts_collection().create_index("id", unique=True)),
        ("alerts.log_id", lambda: alerts_collection().create_index("log_id")),
        ("model_registry.version", lambda: model_registry_collection().create_index("version", unique=True)),
        (
            "model_registry.active",
            lambda: model_registry_collection().create_index([("is_active", -1), ("trained_at", -1)]),
        ),
        ("ml_runs.finished_at", lambda: ml_runs_collection().create_index([("finished_at", -1)])),
    ]

    for label, builder in index_builders:
        try:
            builder()
        except PyMongoError as error:
            logger.warning("Could not ensure index %s: %s", label, error)


def get_series(frame: pd.DataFrame, column: str, default: Any) -> pd.Series:
    if column in frame:
        return frame[column]
    return pd.Series([default] * len(frame), index=frame.index)


def build_feature_frame(frame: pd.DataFrame) -> pd.DataFrame:
    if frame.empty:
        return pd.DataFrame(columns=[*NUMERIC_FEATURES, *CATEGORICAL_FEATURES])

    src_port = pd.to_numeric(get_series(frame, "src_port", 0), errors="coerce").fillna(0)
    dst_port = pd.to_numeric(get_series(frame, "dst_port", 0), errors="coerce").fillna(0)
    bytes_sent = pd.to_numeric(get_series(frame, "bytes_sent", 0), errors="coerce").fillna(0)
    bytes_received = pd.to_numeric(get_series(frame, "bytes_received", 0), errors="coerce").fillna(0)
    packets = pd.to_numeric(get_series(frame, "packets", 0), errors="coerce").fillna(0)
    duration = pd.to_numeric(get_series(frame, "duration", 0), errors="coerce").fillna(0)
    protocol = get_series(frame, "protocol", "UNKNOWN").fillna("UNKNOWN").astype(str).str.upper()
    src_ip = get_series(frame, "src_ip", "").fillna("").astype(str)
    dst_ip = get_series(frame, "dst_ip", "").fillna("").astype(str)

    duration_nonzero = duration.replace(0, np.nan)
    packets_per_second = (packets / duration_nonzero).replace([np.inf, -np.inf], np.nan).fillna(packets)

    features = pd.DataFrame(
        {
            "src_port": src_port,
            "dst_port": dst_port,
            "bytes_sent": bytes_sent,
            "bytes_received": bytes_received,
            "packets": packets,
            "duration": duration,
            "total_bytes": bytes_sent + bytes_received,
            "byte_balance": (bytes_sent - bytes_received).abs(),
            "packets_per_second": packets_per_second,
            "protocol": protocol,
            "dst_port_bucket": bucket_port(dst_port),
            "src_scope": src_ip.map(is_internal_ip),
            "dst_scope": dst_ip.map(is_internal_ip),
        }
    )

    return features


def build_training_dataset(log_documents: list[dict[str, Any]]) -> tuple[pd.DataFrame, pd.Series]:
    frame = pd.DataFrame(log_documents)
    if frame.empty:
        raise ValueError("No hay logs disponibles para entrenar el modelo.")
    if "label" not in frame:
        raise ValueError("La colección logs no contiene la columna label.")

    features = build_feature_frame(frame)
    labels = get_series(frame, "label", "Benign").map(normalize_label)
    return features, labels


def build_pipeline(classifier: Any) -> Pipeline:
    numeric_pipeline = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="constant", fill_value=0.0)),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_pipeline = Pipeline(
        [
            ("imputer", SimpleImputer(strategy="constant", fill_value="UNKNOWN")),
            ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
        ]
    )
    preprocessor = ColumnTransformer(
        [
            ("numeric", numeric_pipeline, NUMERIC_FEATURES),
            ("categorical", categorical_pipeline, CATEGORICAL_FEATURES),
        ]
    )
    return Pipeline(
        [
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )


def model_candidates() -> dict[str, Pipeline]:
    return {
        "RandomForest": build_pipeline(
            RandomForestClassifier(
                n_estimators=220,
                random_state=42,
                class_weight="balanced",
                n_jobs=-1,
            )
        ),
        "LogisticRegression": build_pipeline(
            LogisticRegression(
                max_iter=2500,
                class_weight="balanced",
                random_state=42,
            )
        ),
        "DecisionTree": build_pipeline(
            DecisionTreeClassifier(
                max_depth=10,
                min_samples_leaf=4,
                class_weight="balanced",
                random_state=42,
            )
        ),
    }


def next_model_version() -> str:
    max_version = 0
    for document in model_registry_collection().find({}, {"version": 1}):
        version = str(document.get("version", "")).strip()
        if not version.startswith("model_v"):
            continue
        try:
            max_version = max(max_version, int(version.split("_v", 1)[1]))
        except (ValueError, IndexError):
            continue
    return f"model_v{max_version + 1}"


def serialize_model_document(document: dict[str, Any] | None) -> dict[str, Any] | None:
    if not document:
        return None
    metrics = document.get("metrics", {})
    return {
        "serviceName": SERVICE_NAME,
        "modelVersion": document.get("version"),
        "modelType": document.get("model_type"),
        "trainingDataset": document.get("training_dataset", TRAINING_DATASET_NAME),
        "referenceF1": float(metrics.get("weighted_f1", 0)),
        "inferenceMode": "supervisado + correlación operativa",
        "trainedAt": document.get("trained_at"),
        "featureNames": document.get("feature_names", []),
        "totalTrainingRows": document.get("training_rows", 0),
        "testRows": document.get("test_rows", 0),
        "isActive": bool(document.get("is_active")),
        "thresholdF1": float(document.get("threshold_f1", 0)),
    }


def latest_active_model_document() -> dict[str, Any] | None:
    return model_registry_collection().find_one(
        {"is_active": True},
        sort=[("trained_at", -1)],
    )


def load_active_model(auto_train: bool = AUTO_TRAIN_ON_RUN) -> tuple[dict[str, Any], Pipeline, bool]:
    active_document = latest_active_model_document()
    trained_now = False
    if active_document is None and auto_train:
        active_document = train_model()
        trained_now = True
    if active_document is None:
        raise ValueError("No existe un modelo activo. Ejecuta primero /train.")

    model_path = Path(str(active_document.get("model_path", "")))
    if not model_path.is_file():
        if not auto_train:
            raise FileNotFoundError(f"No existe el archivo del modelo activo: {model_path}")
        active_document = train_model()
        trained_now = True
        model_path = Path(str(active_document.get("model_path", "")))

    model = joblib.load(model_path)
    return active_document, model, trained_now


def train_model() -> dict[str, Any]:
    log_documents = list(logs_collection().find({}, {"_id": 0}))
    if len(log_documents) < MIN_TRAINING_ROWS:
        raise ValueError(
            f"Se requieren al menos {MIN_TRAINING_ROWS} logs para entrenar. Solo hay {len(log_documents)}."
        )

    features, labels = build_training_dataset(log_documents)
    class_counts = labels.value_counts()
    if len(class_counts.index) < 2:
        raise ValueError("Se necesitan al menos dos clases distintas para entrenar un clasificador.")

    stratify = labels if class_counts.min() >= 2 else None
    test_size = min(max(TRAIN_TEST_SIZE, 0.2), 0.35)

    x_train, x_test, y_train, y_test = train_test_split(
        features,
        labels,
        test_size=test_size,
        random_state=42,
        stratify=stratify,
    )

    results: list[dict[str, Any]] = []
    for model_name, pipeline in model_candidates().items():
        logger.info("Training %s", model_name)
        pipeline.fit(x_train, y_train)
        predictions = pipeline.predict(x_test)
        weighted_f1 = f1_score(y_test, predictions, average="weighted", zero_division=0)
        report = classification_report(y_test, predictions, output_dict=True, zero_division=0)
        results.append(
            {
                "model_name": model_name,
                "pipeline": pipeline,
                "weighted_f1": float(weighted_f1),
                "report": to_builtin(report),
            }
        )

    best_result = max(results, key=lambda result: result["weighted_f1"])
    version = next_model_version()
    model_path = MODEL_DIR / f"{version}.joblib"
    joblib.dump(best_result["pipeline"], model_path)

    trained_at = now_iso()
    model_registry_collection().update_many({"is_active": True}, {"$set": {"is_active": False}})
    model_document = {
        "version": version,
        "model_type": best_result["model_name"],
        "model_path": str(model_path),
        "training_dataset": TRAINING_DATASET_NAME,
        "feature_names": [*NUMERIC_FEATURES, *CATEGORICAL_FEATURES],
        "training_rows": int(len(features)),
        "test_rows": int(len(x_test)),
        "threshold_f1": 0.8,
        "trained_at": trained_at,
        "is_active": True,
        "metrics": {
            "weighted_f1": float(best_result["weighted_f1"]),
            "classification_report": best_result["report"],
        },
        "candidate_scores": [
            {
                "model_type": result["model_name"],
                "weighted_f1": result["weighted_f1"],
            }
            for result in results
        ],
    }
    model_registry_collection().insert_one(model_document)
    logger.info("Stored active model %s (%s)", version, best_result["model_name"])
    return model_document


def build_reason(log_document: dict[str, Any], prediction: str, confidence: float) -> str:
    protocol = str(log_document.get("protocol", "UNKNOWN")).upper()
    packets = int(float(log_document.get("packets", 0) or 0))
    if prediction == "Benign":
        return f"flujo {protocol} sin indicios de ataque, {packets} paquetes observados"
    return (
        f"{prediction.lower()} sobre {protocol} con {packets} paquetes "
        f"y confianza {confidence * 100:.1f}%"
    )


def create_new_alert(
    log_document: dict[str, Any],
    prediction: str,
    confidence: float,
    model_document: dict[str, Any],
    run_id: str,
    scored_at: str,
) -> dict[str, Any]:
    src_ip = str(log_document.get("src_ip", "0.0.0.0"))
    message_template = ALERT_MESSAGES.get(prediction, "Attack detected from {src_ip}")
    return {
        "id": stable_hash(run_id, log_document.get("id"), prediction, prefix="ml-"),
        "timestamp": scored_at,
        "type": prediction,
        "severity": severity_for_label(prediction),
        "source_ip": src_ip,
        "target_ip": str(log_document.get("dst_ip", "0.0.0.0")),
        "message": message_template.format(src_ip=src_ip),
        "log_id": log_document.get("id"),
        "acknowledged": False,
        "detection_source": SERVICE_NAME,
        "ml_confidence": confidence,
        "ml_model_version": model_document.get("version"),
        "inference_run_id": run_id,
    }


def serialize_run_document(document: dict[str, Any] | None) -> dict[str, Any] | None:
    if not document:
        return None
    return {
        "runId": document.get("run_id"),
        "status": document.get("status"),
        "triggerSource": document.get("trigger_source"),
        "startedAt": document.get("started_at"),
        "finishedAt": document.get("finished_at"),
        "range": document.get("range", {}),
        "modelVersion": document.get("model_version"),
        "modelType": document.get("model_type"),
        "totalScored": int(document.get("total_scored", 0)),
        "suspiciousCount": int(document.get("suspicious_count", 0)),
        "benignCount": int(document.get("benign_count", 0)),
        "averageConfidencePct": float(document.get("average_confidence_pct", 0)),
        "suspiciousConfidencePct": float(document.get("suspicious_confidence_pct", 0)),
        "coveragePct": float(document.get("coverage_pct", 0)),
        "collectionsWritten": document.get("collections_written", "logguard_ml.ml_runs"),
        "logsUpdated": int(document.get("logs_updated", 0)),
        "alertsCreated": int(document.get("alerts_created", 0)),
        "alertsEnriched": int(document.get("alerts_enriched", 0)),
        "trainedModel": bool(document.get("trained_model")),
        "labelDistribution": document.get("label_distribution", {}),
        "topRiskySources": document.get("top_risky_sources", []),
    }


def run_inference(
    range_from: str | None,
    range_to: str | None,
    *,
    trigger_source: str = "ui",
    auto_train: bool = AUTO_TRAIN_ON_RUN,
    force_retrain: bool = False,
) -> dict[str, Any]:
    if force_retrain:
        model_document = train_model()
        model = joblib.load(Path(str(model_document.get("model_path", ""))))
        trained_now = True
    else:
        model_document, model, trained_now = load_active_model(auto_train=auto_train)
    started_at = now_iso()
    run_id = stable_hash(started_at, range_from, range_to, model_document.get("version"), prefix="run-")

    query: dict[str, Any] = {}
    if range_from or range_to:
        query["timestamp"] = {}
        if range_from:
            query["timestamp"]["$gte"] = range_from
        if range_to:
            query["timestamp"]["$lte"] = range_to

    log_documents = list(logs_collection().find(query))
    if not log_documents:
        finished_at = now_iso()
        run_document = {
            "run_id": run_id,
            "status": "completed",
            "trigger_source": trigger_source,
            "started_at": started_at,
            "finished_at": finished_at,
            "range": {"from": range_from, "to": range_to},
            "model_version": model_document.get("version"),
            "model_type": model_document.get("model_type"),
            "total_scored": 0,
            "suspicious_count": 0,
            "benign_count": 0,
            "average_confidence_pct": 0.0,
            "suspicious_confidence_pct": 0.0,
            "coverage_pct": 0.0,
            "collections_written": "logguard_ml.ml_runs",
            "logs_updated": 0,
            "alerts_created": 0,
            "alerts_enriched": 0,
            "trained_model": trained_now,
            "label_distribution": {},
            "top_risky_sources": [],
        }
        ml_runs_collection().insert_one(run_document)
        return run_document

    feature_frame = build_feature_frame(pd.DataFrame(log_documents))
    predictions = model.predict(feature_frame)
    probabilities = model.predict_proba(feature_frame) if hasattr(model, "predict_proba") else None

    scored_at = now_iso()
    log_updates: list[UpdateOne] = []
    attack_documents: list[tuple[dict[str, Any], str, float]] = []
    confidence_values: list[float] = []
    suspicious_confidences: list[float] = []
    label_distribution: dict[str, int] = {}
    risky_sources: dict[str, int] = {}

    for index, log_document in enumerate(log_documents):
        prediction = normalize_label(predictions[index])
        confidence = (
            float(np.max(probabilities[index]))
            if probabilities is not None and len(probabilities) > index
            else 0.5
        )
        confidence = max(0.5, min(0.995, confidence))
        label_distribution[prediction] = label_distribution.get(prediction, 0) + 1
        confidence_values.append(confidence)

        update_fields = {
            "ml_prediction": prediction,
            "ml_severity": severity_for_label(prediction),
            "ml_confidence": confidence,
            "ml_model_version": model_document.get("version"),
            "ml_model_type": model_document.get("model_type"),
            "ml_detection_source": SERVICE_NAME,
            "ml_last_run_id": run_id,
            "ml_last_scored_at": scored_at,
            "ml_reason": build_reason(log_document, prediction, confidence),
        }
        update_filter = {"_id": log_document["_id"]} if "_id" in log_document else {"id": log_document.get("id")}
        log_updates.append(UpdateOne(update_filter, {"$set": update_fields}))

        if prediction != "Benign":
            suspicious_confidences.append(confidence)
            risky_sources[str(log_document.get("src_ip", "unknown"))] = (
                risky_sources.get(str(log_document.get("src_ip", "unknown")), 0) + 1
            )
            attack_documents.append((log_document, prediction, confidence))

    logs_result = logs_collection().bulk_write(log_updates, ordered=False) if log_updates else None
    logs_updated = int(getattr(logs_result, "modified_count", 0)) + int(getattr(logs_result, "upserted_count", 0))

    alerts_created = 0
    alerts_enriched = 0
    if attack_documents:
        existing_alerts = {
            str(alert.get("log_id")): alert
            for alert in alerts_collection().find(
                {"log_id": {"$in": [str(doc.get("id")) for doc, _, _ in attack_documents]}}
            )
        }
        alert_operations: list[InsertOne | UpdateOne] = []

        for log_document, prediction, confidence in attack_documents:
            log_id = str(log_document.get("id"))
            existing_alert = existing_alerts.get(log_id)
            if existing_alert:
                alert_operations.append(
                    UpdateOne(
                        {"_id": existing_alert["_id"]},
                        {
                            "$set": {
                                "detection_source": "hybrid" if existing_alert.get("detection_source") else SERVICE_NAME,
                                "ml_confidence": confidence,
                                "ml_model_version": model_document.get("version"),
                                "inference_run_id": run_id,
                            }
                        },
                    )
                )
                alerts_enriched += 1
                continue

            alert_operations.append(
                InsertOne(
                    create_new_alert(
                        log_document,
                        prediction,
                        confidence,
                        model_document,
                        run_id,
                        scored_at,
                    )
                )
            )
            alerts_created += 1

        if alert_operations:
            alerts_collection().bulk_write(alert_operations, ordered=False)

    suspicious_count = len(attack_documents)
    total_scored = len(log_documents)
    average_confidence_pct = (
        round((sum(confidence_values) / len(confidence_values)) * 100, 2) if confidence_values else 0.0
    )
    suspicious_confidence_pct = (
        round((sum(suspicious_confidences) / len(suspicious_confidences)) * 100, 2)
        if suspicious_confidences
        else 0.0
    )
    finished_at = now_iso()

    run_document = {
        "run_id": run_id,
        "status": "completed",
        "trigger_source": trigger_source,
        "started_at": started_at,
        "finished_at": finished_at,
        "range": {"from": range_from, "to": range_to},
        "model_version": model_document.get("version"),
        "model_type": model_document.get("model_type"),
        "total_scored": total_scored,
        "suspicious_count": suspicious_count,
        "benign_count": max(total_scored - suspicious_count, 0),
        "average_confidence_pct": average_confidence_pct,
        "suspicious_confidence_pct": suspicious_confidence_pct,
        "coverage_pct": 100.0 if total_scored else 0.0,
        "collections_written": (
            "logs, alerts, logguard_ml.ml_runs"
            if suspicious_count > 0
            else "logs, logguard_ml.ml_runs"
        ),
        "logs_updated": logs_updated if logs_updated > 0 else len(log_updates),
        "alerts_created": alerts_created,
        "alerts_enriched": alerts_enriched,
        "trained_model": trained_now,
        "label_distribution": label_distribution,
        "top_risky_sources": [
            {"ip": ip, "count": count}
            for ip, count in sorted(risky_sources.items(), key=lambda item: item[1], reverse=True)[:5]
        ],
    }
    ml_runs_collection().insert_one(run_document)
    return run_document


@app.get("/health")
def health() -> Any:
    try:
        get_mongo_client()
        active_model = serialize_model_document(latest_active_model_document())
        return jsonify(
            {
                "status": "healthy",
                "service": SERVICE_NAME,
                "database": MONGODB_DB_NAME,
                "mlDatabase": MONGODB_ML_DB_NAME,
                "activeModel": active_model,
                "timestamp": now_iso(),
            }
        )
    except Exception as error:  # pragma: no cover - defensive
        logger.exception("Health check failed")
        return jsonify({"status": "unhealthy", "error": str(error)}), 503


@app.get("/models/active")
def get_active_model() -> Any:
    active_model = serialize_model_document(latest_active_model_document())
    if active_model is None:
        return jsonify({"error": "No active model found"}), 404
    return jsonify(active_model)


@app.get("/runs/latest")
def get_latest_run() -> Any:
    latest_run = ml_runs_collection().find_one({}, sort=[("finished_at", -1)])
    if latest_run is None:
        return jsonify({"error": "No ML runs found"}), 404
    return jsonify(serialize_run_document(latest_run))


@app.post("/train")
def train_endpoint() -> Any:
    try:
        model_document = train_model()
        return jsonify(serialize_model_document(model_document))
    except Exception as error:
        logger.exception("Training failed")
        return jsonify({"error": str(error)}), 400


@app.post("/run")
def run_endpoint() -> Any:
    payload = request.get_json(silent=True) or {}
    range_from = payload.get("from")
    range_to = payload.get("to")
    if not range_from or not range_to:
        return jsonify({"error": "from and to are required"}), 400

    trigger_source = str(payload.get("triggerSource") or "dashboard-ui")
    auto_train = parse_bool(payload.get("autoTrain"), AUTO_TRAIN_ON_RUN)
    force_retrain = parse_bool(payload.get("forceRetrain"), False)

    try:
        run_document = run_inference(
            str(range_from),
            str(range_to),
            trigger_source=trigger_source,
            auto_train=auto_train,
            force_retrain=force_retrain,
        )
        return jsonify(serialize_run_document(run_document))
    except Exception as error:
        logger.exception("ML run failed")
        return jsonify({"error": str(error)}), 400


def main() -> None:
    ensure_indexes()
    logger.info("Starting %s on port %s", SERVICE_NAME, SERVICE_PORT)
    app.run(host="0.0.0.0", port=SERVICE_PORT, debug=False)


if __name__ == "__main__":
    main()
