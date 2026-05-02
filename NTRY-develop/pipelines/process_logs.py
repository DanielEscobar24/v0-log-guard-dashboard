from pymongo import MongoClient
from dotenv import load_dotenv
import os
import pandas as pd

load_dotenv()

client = MongoClient(os.getenv("MONGO_URI"))
db = client["logs_db"]
collection = db["eventos"]

# Traer logs
logs = list(collection.find())

df = pd.DataFrame(logs)

# Convertir timestamp
df["timestamp"] = pd.to_datetime(df["timestamp"])

# Feature engineering
df["minute"] = df["timestamp"].dt.floor("T")

grouped = df.groupby(["ip", "minute"]).agg({
    "status": lambda x: (x == "fail").sum(),
    "response_time_ms": "mean",
    "attempts": "sum"
}).rename(columns={
    "status": "failed_requests",
    "response_time_ms": "avg_response_time",
    "attempts": "total_attempts"
})

grouped["requests"] = df.groupby(["ip", "minute"]).size()
grouped["error_rate"] = grouped["failed_requests"] / grouped["requests"]

print(grouped.head())