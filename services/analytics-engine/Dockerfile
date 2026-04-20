FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY main.py .

# Create model directory (for future ML model)
RUN mkdir -p /app/model

# Run as non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

CMD ["python", "-u", "main.py"]
