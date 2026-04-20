# LogGuard Microservices Backend

This folder contains the complete microservices backend for processing CICIDS-2017 network traffic data.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Ingestion     │────▶│   RabbitMQ      │────▶│   Processing    │
│   Service       │     │   raw_logs      │     │   Service       │
│   (Python)      │     │                 │     │   (Python)      │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │
                        │   RabbitMQ      │◀─────────────┘
                        │   processed_logs│
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐     ┌─────────────────┐
                        │   API Gateway   │────▶│   MongoDB       │
                        │   (Node.js)     │     │   Storage       │
                        └────────┬────────┘     └─────────────────┘
                                 │
                        ┌────────▼────────┐
                        │   React Frontend│
                        │   (WebSocket)   │
                        └─────────────────┘
```

## Services

### 1. Ingestion Service (Python)
- Downloads CICIDS-2017 dataset using `kagglehub`
- Cleans data (handles NaN/Inf values, strips whitespace from columns)
- Streams rows to RabbitMQ `raw_logs` queue at 500ms intervals

### 2. Processing Service (Python)
- Consumes from `raw_logs` queue
- Transforms raw CSV data to frontend-compatible JSON schema
- Maps CICIDS-2017 labels to frontend labels (Benign, DDoS, PortScan, etc.)
- Stores processed logs in MongoDB
- Publishes to `processed_logs` queue for real-time streaming

### 3. API Gateway (Node.js)
- REST API for historical data queries
- Socket.io WebSocket server for real-time updates
- Emits `new_log` events for live streaming
- Emits `new_alert` events for attack detections

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Kaggle API credentials (for dataset download)

### Setup Kaggle Credentials

1. Create a Kaggle account at https://www.kaggle.com
2. Go to Account Settings → Create New API Token
3. This downloads `kaggle.json`
4. Place it in `~/.kaggle/kaggle.json` (Linux/Mac) or `C:\Users\<username>\.kaggle\kaggle.json` (Windows)

### Run the Services

```bash
cd services

# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| API Gateway | http://localhost:3001 | REST API & WebSocket |
| RabbitMQ UI | http://localhost:15672 | Management (admin/logguard_secret) |
| MongoDB | localhost:27017 | Database |

## API Endpoints

### REST API

```
GET /api/health              - Service health check
GET /api/logs                - Get logs (paginated)
GET /api/logs/:id            - Get single log
GET /api/stats/traffic       - Traffic over time (for charts)
GET /api/stats/kpi           - KPI metrics
GET /api/stats/attacks       - Attack distribution
GET /api/stats/top-ips       - Top source IPs
GET /api/stats/protocols     - Protocol distribution
```

### WebSocket Events

Connect: `ws://localhost:3001`

```javascript
// Events emitted by server:
socket.on('new_log', (logEntry) => { ... })
socket.on('new_alert', (alert) => { ... })
socket.on('connected', (info) => { ... })
socket.on('logs_batch', (logs) => { ... })

// Events to emit to server:
socket.emit('request_logs', { limit: 10 })
```

## Data Schema

### LogEntry (matches frontend interface)

```typescript
interface LogEntry {
  id: string                // "log-uuid"
  flow_id: string           // "FL-XXXXXXXX"
  timestamp: string         // ISO 8601
  src_ip: string            // Source IP
  dst_ip: string            // Destination IP
  protocol: 'TCP' | 'UDP' | 'ICMP' | 'HTTPS'
  flow_duration: number     // Microseconds
  label: 'Benign' | 'DDoS' | 'PortScan' | 'Bot' | 'Botnet' | 'Infiltration' | 'Suspicious'
  length?: number           // Packet length
  flags?: string            // TCP flags
  payload?: string          // Hex payload preview
  prediction_confidence?: number  // 0-1
}
```

## Environment Variables

### Ingestion Service
- `RABBITMQ_HOST` - RabbitMQ hostname (default: rabbitmq)
- `RABBITMQ_PORT` - RabbitMQ port (default: 5672)
- `RABBITMQ_USER` - RabbitMQ username (default: admin)
- `RABBITMQ_PASS` - RabbitMQ password (default: logguard_secret)
- `STREAM_INTERVAL_MS` - Delay between rows (default: 500)

### Processing Service
- Same RabbitMQ vars as above
- `MONGODB_URI` - MongoDB connection string

### Gateway Service
- `PORT` - HTTP port (default: 3001)
- `CORS_ORIGIN` - Allowed origins (default: http://localhost:3000)
- Same RabbitMQ and MongoDB vars

## Stopping Services

```bash
# Stop and remove containers
docker-compose down

# Stop and remove volumes (clears data)
docker-compose down -v
```

## Development

To run services individually for development:

```bash
# Start infrastructure only
docker-compose up mongodb rabbitmq

# Run services locally
cd ingestion && pip install -r requirements.txt && python main.py
cd processing && pip install -r requirements.txt && python main.py
cd gateway && npm install && npm run dev
```
