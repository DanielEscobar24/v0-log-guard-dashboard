# LogGuard Dashboard

LogGuard es un dashboard de observabilidad de red construido con **Next.js 16** y un gateway **Express** que lee las colecciones `logs` y `alerts` desde **MongoDB**. El repositorio también incluye un pipeline opcional para poblar esos datos desde **CICIDS-2017** usando **RabbitMQ**, `ingestion-service` y `analytics-engine`.

## Estado actual del proyecto

- Las pantallas `/`, `/live-logs` y `/alerts` consumen datos reales desde la API.
- La antigua pantalla `/analytics` fue removida del dashboard.
- El botón **"Ejecutar corrida ML"** del panel principal dispara una corrida real contra `Guard-logs-ML`, reentrena el modelo, crea una nueva versión `model_vN`, persiste el resumen en MongoDB y enriquece `logs`/`alerts`.
- El diagnóstico visual del sidebar también es simulado.
- La vista **"Logs en vivo"** no usa websockets: hace polling manual o automático cada **8 segundos** contra MongoDB vía API.
- Si ya tienes datos en MongoDB, puedes usar el dashboard sin desplegar RabbitMQ ni los workers de Python.

## Arquitectura actual

```text
Navegador
  -> Next.js 16 (App Router)
      -> /api/[...path] (proxy server-side)
          -> api-log-guard (Express)
              -> Guard-logs-ML (Flask)
              -> MongoDB (colecciones logs, alerts)

Pipeline opcional de carga:
CICIDS-2017 / CSV local
  -> ingestion-service
      -> RabbitMQ queue raw_logs
          -> analytics-engine
              -> MongoDB (logs, alerts)
              -> RabbitMQ queues processed_logs, alerts
```

Notas importantes:

- El frontend nunca llama al gateway directamente desde el navegador; siempre usa rutas relativas `/api/...`.
- `api-log-guard` hoy **no consume RabbitMQ** y **no expone Socket.IO**. Solo consulta MongoDB.
- `analytics-engine` sí publica en `processed_logs` y `alerts`, pero el dashboard actual no consume esas colas.
- `Guard-logs-ML` entrena, versiona y ejecuta inferencia por rango usando la colección `logs`, y persiste corridas en `logguard_ml.ml_runs`.
- Cada corrida manual desde el panel principal fuerza reentrenamiento y, por diseño, incrementa la versión activa del modelo.

## Capa ML actual

`Guard-logs-ML` trabaja hoy sobre datos tabulares de red ya normalizados en MongoDB. La colección `logs` aporta variables como:

- `src_port`
- `dst_port`
- `bytes_sent`
- `bytes_received`
- `packets`
- `duration`
- `protocol`

Con esas variables el servicio construye features adicionales como `total_bytes`, `byte_balance`, `packets_per_second`, `dst_port_bucket`, `src_scope` y `dst_scope`, y luego compara **tres modelos supervisados** por `weighted_f1`.

### Modelos usados actualmente

1. `RandomForest`
   Se usa porque este problema es de clasificación multiclase sobre datos tabulares de red. Captura relaciones no lineales, tolera ruido y suele rendir mejor que un árbol solo, por lo que es el candidato principal para quedar como modelo activo.

2. `LogisticRegression`
   Se conserva como baseline serio porque es rápida, estable y fácil de interpretar. Sirve para justificar académicamente si un modelo más complejo realmente aporta mejora, y además entrega probabilidades útiles para confianza de alerta.

3. `DecisionTree`
   Se usa por explicabilidad. Permite sustentar reglas del tipo “si pasa esto y esto, entonces probable ataque”, lo cual es valioso para defensa del proyecto, aunque normalmente generaliza peor que `RandomForest`.

### Por qué solo estos 3 modelos

- Porque son los modelos vistos en clase que mejor se adaptan a clasificación supervisada sobre logs tabulares.
- Porque mantienen el servicio entendible y justificable académicamente.
- Porque cubren tres necesidades distintas del proyecto:
  - rendimiento práctico (`RandomForest`)
  - baseline interpretable (`LogisticRegression`)
  - explicabilidad de reglas (`DecisionTree`)

## Pantallas y comportamiento real

### `/`

- Carga métricas, timeline, top de ataques, top de IP origen y protocolos desde la API real.
- Usa un selector de rango persistido en `localStorage` (`logguard.dashboard.range`).
- El rango máximo permitido es de **15 días**.
- La tabla principal exporta CSV.
- Para traer todos los registros del rango, hace paginación interna en bloques de `500` documentos.

Endpoints usados:

- `/api/stats/dashboard`
- `/api/logs`
- `/api/stats/attacks`
- `/api/stats/top-sources`
- `/api/stats/protocols`
- `/api/stats/timeline`

### `/live-logs`

- Carga la última página de `50` registros desde `/api/logs`.
- Muestra un documento seleccionado en JSON.
- Puede entrar en modo auto-refresh cada `8s`.
- Usa virtualización para mantener rendimiento en la tabla.

Endpoints usados:

- `/api/logs`
- `/api/stats/timeline`
- `/api/stats/dashboard`

### `/alerts`

- Lee alertas reales desde MongoDB.
- Permite filtrar entre `Todas`, `Críticas`, `Altas` y `Reconocidas`.
- Permite marcar una alerta como reconocida mediante `PUT`.
- Hereda el rango temporal guardado por la pantalla principal.

Endpoints usados:

- `/api/alerts`
- `/api/stats/alerts-trend`
- `/api/stats/attacks`
- `/api/alerts/:id/acknowledge`

## Contrato de datos esperado

### Colección `logs`

El gateway y el frontend esperan documentos con esta forma:

```json
{
  "id": "4a2f9d7f2b1c8e10",
  "timestamp": "2017-02-15T09:18:00Z",
  "src_ip": "192.168.10.3",
  "src_port": 62547,
  "dst_ip": "192.168.10.1",
  "dst_port": 53,
  "protocol": "UDP",
  "bytes_sent": 94,
  "bytes_received": 250,
  "packets": 4,
  "duration": 0.116,
  "label": "Benign",
  "severity": "low",
  "confidence": 0.95,
  "ml_prediction": "Benign",
  "ml_severity": "low",
  "ml_confidence": 0.98,
  "ml_model_version": "model_v3",
  "ml_model_type": "RandomForest",
  "ml_detection_source": "Guard-logs-ML",
  "ml_last_run_id": "run-d62084ad8be5e610",
  "ml_last_scored_at": "2026-05-02T03:19:09.131858Z",
  "ml_reason": "flujo UDP sin indicios de ataque, 4 paquetes observados"
}
```

### Colección `alerts`

```json
{
  "id": "0d8f8f18e8c9b201",
  "timestamp": "2017-02-15T09:18:05.123456Z",
  "type": "DDoS",
  "severity": "critical",
  "source_ip": "192.168.10.3",
  "target_ip": "192.168.10.1",
  "message": "DDoS attack detected from 192.168.10.3",
  "log_id": "4a2f9d7f2b1c8e10",
  "acknowledged": false,
  "detection_source": "Guard-logs-ML",
  "ml_confidence": 0.94,
  "ml_model_version": "model_v3",
  "inference_run_id": "run-d62084ad8be5e610"
}
```

Recomendaciones del contrato:

- `timestamp` debe guardarse como **string ISO 8601**. El código actual filtra por rango usando comparaciones sobre ese campo.
- Si cargas datos manualmente, mantén nombres de severidad en minúscula: `low`, `medium`, `high`, `critical`.
- `label: "Benign"` es el valor que el sistema usa para separar tráfico normal de ataques.

## Advertencia importante sobre fechas

El panel principal y la página de alertas arrancan con el rango por defecto en el **día actual del navegador**. Si tus documentos conservan los timestamps originales de **CICIDS-2017** (por ejemplo febrero o julio de 2017), es normal que `/` y `/alerts` aparezcan vacíos hasta que selecciones manualmente ese rango en el calendario.

La pantalla `/live-logs` no tiene este problema porque siempre consulta la última página de registros sin aplicar el filtro persistido.

## Requisitos

- Node.js **20 o superior** para el frontend y el entorno principal de desarrollo.
- npm
- MongoDB accesible desde `api-log-guard`
- Python **3.13 recomendado** para los workers, por compatibilidad con ruedas de `pandas` y `numpy`
- RabbitMQ solo si vas a usar el pipeline de ingesta
- Credenciales de Kaggle o un `LOCAL_DATASET_PATH` con CSV si vas a usar `ingestion-service`

## Variables de entorno

Usa un único archivo **`.env` en la raíz del repo**. Tanto `api-log-guard` como `scripts/run_logguard_workers.py` leen ese archivo desde ahí.

Puedes partir de:

```bash
cp .env.example .env
```

Variables clave:

```bash
# Frontend / proxy de Next
API_GATEWAY_URL=http://localhost:4000

# api-log-guard
PORT=4000
MONGODB_URL=mongodb://admin:logguard123@localhost:27017/logguard?authSource=admin
MONGODB_DB_NAME=logguard
CORS_ORIGIN=http://localhost:3000

# Pipeline opcional
RABBITMQ_URL=amqp://guest:guest@localhost:5672
LOCAL_DATASET_PATH=
KAGGLE_DATASET=bertvankeulen/cicids-2017
KAGGLE_API_TOKEN=
KAGGLE_USERNAME=
KAGGLE_KEY=
STREAM_INTERVAL_MS=500
MAX_STREAM_ROWS=
SAMPLE_ROWS_PER_CSV=
```

Notas:

- `NEXT_PUBLIC_API_URL` sigue existiendo como fallback heredado del proxy, pero la variable recomendada es `API_GATEWAY_URL`.
- `ENABLE_RABBITMQ` aparece en el `.env.example` antiguo, pero el gateway actual no la usa.
- Si vas a usar el pipeline sin cambiar código, mantén `MONGODB_DB_NAME=logguard`: `analytics-engine` escribe en esa base de datos de forma fija.

## Instalación local

Instala dependencias del frontend:

```bash
npm install
```

Instala dependencias del gateway:

```bash
npm install --prefix services/api-log-guard
```

Si también vas a usar el pipeline de Python, crea los `venv`:

```bash
cd services/guard-logs-ml
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

```bash
cd services/analytics-engine
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

```bash
cd services/ingestion-service
python3 -m venv .venv
source .venv/bin/activate
python3 -m pip install -r requirements.txt
```

## Ejecución local

Levanta frontend y gateway:

```bash
npm run dev
```

Ese script arranca:

- `next dev --webpack`
- `services/api-log-guard/server.js`
- `services/guard-logs-ml/main.py` si su `.venv` ya existe

Abre `http://localhost:3000`.

Si además quieres cargar datos desde el pipeline:

```bash
npm run dev:workers
```

Ese comando:

- carga el `.env` de la raíz,
- arranca `analytics-engine`,
- espera `2` segundos,
- y luego arranca `ingestion-service`.

## Comportamiento real del pipeline

- `ingestion-service` puede leer CSV desde `LOCAL_DATASET_PATH` o descargarlos con `kagglehub`.
- Si `SAMPLE_ROWS_PER_CSV` está definido, toma solo las primeras filas de cada archivo.
- Si `MAX_STREAM_ROWS` está definido, recorta el total combinado antes de publicar.
- Cuando termina de publicar el dataset, **vuelve a empezar desde el principio** tras una pausa de `5` segundos. Esto significa que, si lo dejas corriendo, seguirá duplicando datos en MongoDB.

Para una carga de prueba controlada, normalmente conviene:

- usar `LOCAL_DATASET_PATH` con una carpeta pequeña,
- definir `SAMPLE_ROWS_PER_CSV`,
- y detener `npm run dev:workers` cuando termine la primera pasada.

## Endpoints disponibles hoy

### Gateway

- `GET /health`
- `GET /api/logs`
- `GET /api/logs/:id`
- `GET /api/alerts`
- `PUT /api/alerts/:id/acknowledge`
- `GET /api/stats/dashboard`
- `GET /api/stats/timeline`
- `GET /api/stats/traffic`
- `GET /api/stats/attacks`
- `GET /api/stats/alerts-trend`
- `GET /api/stats/top-sources`
- `GET /api/stats/protocols`
- `GET /api/ml/models/active`
- `GET /api/ml/runs/latest`
- `POST /api/ml/train`
- `POST /api/ml/run`

### Filtros soportados hoy

- `/api/logs`: `page`, `limit`, `label`, `severity`, `src_ip`, `dst_ip`, `protocol`, `from`, `to`
- `/api/alerts`: `limit`, `acknowledged`, `from`, `to`
- `/api/stats/*`: según endpoint, `from`, `to` o `hours`

## Scripts útiles

```bash
npm run dev
npm run dev:next
npm run dev:workers
npm run build
npm run start
npm run lint
```

## Despliegue

Puedes separar el despliegue en dos niveles:

- **Visualización solamente**: Next.js + `api-log-guard` + `Guard-logs-ML` + MongoDB
- **Pipeline completo**: lo anterior + RabbitMQ + `analytics-engine` + `ingestion-service`

La guía actualizada está en [docs/CLOUD.md](docs/CLOUD.md).
