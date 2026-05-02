from pymongo import MongoClient
from dotenv import load_dotenv
import os
import pandas as pd
from datetime import datetime
import json

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, f1_score

import joblib

load_dotenv()

# =========================
# CONFIG
# =========================
MODEL_DIR = "ml/models/"
REGISTRY_PATH = "ml/registry.json"

os.makedirs(MODEL_DIR, exist_ok=True)

# =========================
# CONEXIÓN
# =========================
client = MongoClient(os.getenv("MONGO_URI"))
db = client["logs_db"]
collection = db["eventos"]

# =========================
# 1. Cargar datos
# =========================
logs = list(collection.find())
df = pd.DataFrame(logs)

# =========================
# 2. Preprocesamiento
# =========================
df["timestamp"] = pd.to_datetime(df["timestamp"])
df["minute"] = df["timestamp"].dt.floor("T")

# =========================
# 3. Feature engineering
# =========================
grouped = df.groupby(["ip", "minute"]).agg({
    "status": lambda x: (x == "fail").sum(),
    "response_time_ms": "mean",
    "attempts": "sum",
    "attack_label": lambda x: x.mode()[0]
}).rename(columns={
    "status": "failed_requests",
    "response_time_ms": "avg_response_time",
    "attempts": "total_attempts"
})

grouped["requests"] = df.groupby(["ip", "minute"]).size()
grouped["error_rate"] = grouped["failed_requests"] / grouped["requests"]

grouped = grouped.reset_index()

X = grouped[[
    "failed_requests",
    "avg_response_time",
    "total_attempts",
    "requests",
    "error_rate"
]]

y = grouped["attack_label"]

# =========================
# 4. Split
# =========================
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

# =========================
# 5. MODELOS
# =========================
models = {
    "RandomForest": RandomForestClassifier(n_estimators=100),
    "LogisticRegression": LogisticRegression(max_iter=1000),
    "GradientBoosting": GradientBoostingClassifier()
}

results = {}

# =========================
# 6. Entrenamiento y evaluación
# =========================
for name, model in models.items():
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)

    report = classification_report(y_test, y_pred, output_dict=True)

    f1 = f1_score(y_test, y_pred, average="weighted")

    results[name] = {
        "model": model,
        "f1_score": f1,
        "report": report
    }

# =========================
# 7. Selección del mejor modelo
# =========================
best_model_name = max(results, key=lambda x: results[x]["f1_score"])
best_model = results[best_model_name]["model"]
best_f1 = results[best_model_name]["f1_score"]

print(f"🏆 Mejor modelo: {best_model_name} (F1: {best_f1})")

# =========================
# 8. VERSIONAMIENTO
# =========================
def load_registry():
    if os.path.exists(REGISTRY_PATH):
        with open(REGISTRY_PATH, "r") as f:
            return json.load(f)
    return {}

def save_registry(registry):
    with open(REGISTRY_PATH, "w") as f:
        json.dump(registry, f, indent=4)

registry = load_registry()

version = f"model_v{len(registry) + 1}"
model_path = os.path.join(MODEL_DIR, f"{version}.pkl")

# =========================
# 9. CRITERIO DE CALIDAD
# =========================
THRESHOLD_F1 = 0.80

if best_f1 >= THRESHOLD_F1:
    joblib.dump(best_model, model_path)

    registry[version] = {
        "model_type": best_model_name,
        "date": datetime.utcnow().isoformat(),
        "f1_score": best_f1,
        "features": list(X.columns),
        "metrics": results[best_model_name]["report"]
    }

    save_registry(registry)

    print(f"✅ Modelo guardado como {version}")
else:
    print("❌ Modelo NO cumple el umbral mínimo")