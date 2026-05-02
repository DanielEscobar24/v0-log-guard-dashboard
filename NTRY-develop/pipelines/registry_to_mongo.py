from pymongo import MongoClient
from dotenv import load_dotenv
import os
import time
import random
from datetime import datetime, UTC
import json

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = "logs_db"
COLLECTION_NAME = "model_metrics"
REGISTRY_PATH = "/home/T0M1/Desktop/T0M1/NTRY/ml/registry.json"

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]

def load_registry():
    if not os.path.exists(REGISTRY_PATH):
        raise FileNotFoundError("No existe registry.json")

    with open(REGISTRY_PATH, "r") as f:
        return json.load(f)


def model_exists(version):
    return collection.find_one({"model_version": version}) is not None


def transform_and_insert(registry):
    inserted = 0

    for version, data in registry.items():

        # Evitar duplicados
        if model_exists(version):
            print(f"⚠️ {version} ya existe en Mongo, se omite")
            continue

        # Extraer métricas principales
        metrics = data.get("metrics", {})
        weighted = metrics.get("weighted avg", {})

        document = {
            "model_version": version,
            "model_type": data.get("model_type"),
            "f1_score": data.get("f1_score"),
            "precision": weighted.get("precision"),
            "recall": weighted.get("recall"),
            "features": data.get("features"),
            "metrics": metrics,  # guardas todo el report completo
            "timestamp": datetime.utcnow()
        }

        collection.insert_one(document)
        inserted += 1

        print(f"✅ Insertado {version}")

    print(f"\n🚀 Total insertados: {inserted}")


# =========================
# MAIN
# =========================
if __name__ == "__main__":
    registry = load_registry()
    transform_and_insert(registry)