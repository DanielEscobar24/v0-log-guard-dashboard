from pymongo import MongoClient
from dotenv import load_dotenv
import os
import time
import random
from datetime import datetime, UTC

# 🔥 FIX IMPORTANTE (rutas)
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Importa tu generador
from pipelines.generar_logs import generar_log  

print("🔥 INICIANDO PRODUCTOR 🔥")

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("DB_NAME", "logs_db")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "eventos")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]
collection = db[COLLECTION_NAME]

def enviar_log(log):
    log["timestamp"] = log["timestamp"].isoformat()
    collection.insert_one(log)

def run_stream(rate_per_sec=5):
    delay = 1 / rate_per_sec
    while True:
        tipo = random.choices(
            ["normal", "brute_force", "flood"],
            weights=[0.7, 0.2, 0.1]
        )[0]
        log = generar_log(tipo)
        enviar_log(log)
        print(f"[{datetime.now()}] → {tipo}")
        time.sleep(delay)
        
if __name__ == "__main__":
    run_stream()