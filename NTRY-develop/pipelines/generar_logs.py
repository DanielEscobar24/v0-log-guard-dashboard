import pandas as pd
import random
from datetime import datetime, timedelta, UTC

IPS = [f"192.168.1.{i}" for i in range(1, 50)]
USERS = ["admin", "user1", "user2", "guest"]
ENDPOINTS = ["/login", "/api/data", "/dashboard"]

def generar_log(tipo="normal"):
    now = datetime.now(UTC)

    ip = random.choice(IPS)
    user = random.choice(USERS)
    endpoint = random.choice(ENDPOINTS)

    if tipo == "normal":
        status = random.choice(["success", "fail"])
        attempts = random.randint(1, 3)
    
    elif tipo == "brute_force":
        status = "fail"
        attempts = random.randint(10, 30)
        endpoint = "/login"
    
    elif tipo == "flood":
        status = random.choice(["success", "fail"])
        attempts = random.randint(50, 100)
    
    else:
        status = "fail"
        attempts = random.randint(5, 10)

    status_code = 200 if status == "success" else 401

    log = {
        "timestamp": now,
        "ip": ip,
        "user": user,
        "method": "POST" if endpoint == "/login" else "GET",
        "endpoint": endpoint,
        "status_code": status_code,
        "status": status,
        "event_type": f"{endpoint.replace('/', '')}_{status}",
        "response_time_ms": random.randint(50, 500),
        "payload_size": random.randint(200, 1000),
        "attempts": attempts,
        "attack_label": tipo
    }

    return log

def generar_dataset(n=1000):
    logs = []

    for _ in range(n):
        tipo = random.choices(
            ["normal", "brute_force", "flood"],
            weights=[0.7, 0.2, 0.1]  # distribución realista
        )[0]

        logs.append(generar_log(tipo))

    return pd.DataFrame(logs)

if __name__ == "__main__":
    df = generar_dataset(5000)
    df.to_csv("/home/T0M1/Desktop/T0M1/NTRY/Datos_Procesados.csv", index=False)
    print("Dataset Generado 🚀")