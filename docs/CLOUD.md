# LogGuard en la nube

Esta guía describe el despliegue del proyecto **tal como está hoy en el código**. La idea central es separar dos escenarios:

1. **Visualización sobre datos ya cargados**: solo necesitas `Next.js`, `api-log-guard` y `MongoDB`.
2. **Pipeline completo de ingesta**: además necesitas `RabbitMQ`, `analytics-engine` e `ingestion-service`.

No hace falta `docker-compose`. Cada servicio ya tiene su `Dockerfile`, y también puedes desplegarlos como procesos separados en Railway, Render, Fly.io, ECS/Fargate, una VM o cualquier PaaS equivalente.

## Topología real

### Frontend

- Carpeta: `./`
- Stack: Next.js 16
- Rol: renderiza la UI y hace proxy server-side de `/api/*` hacia el gateway usando `API_GATEWAY_URL`

### Gateway

- Carpeta: `services/api-log-guard/`
- Stack: Express + MongoDB driver
- Rol real hoy:
  - expone endpoints REST,
  - lee `logs` y `alerts` desde MongoDB,
  - no consume RabbitMQ,
  - no usa Socket.IO aunque haya dependencias heredadas en el repo.

### Analytics engine

- Carpeta: `services/analytics-engine/`
- Stack: Python + `pika` + `pymongo`
- Rol:
  - consume `raw_logs` desde RabbitMQ,
  - transforma filas CICIDS-2017 al formato del frontend,
  - inserta en MongoDB las colecciones `logs` y `alerts`,
  - publica en las colas `processed_logs` y `alerts`.

### Ingestion service

- Carpeta: `services/ingestion-service/`
- Stack: Python + `kagglehub` + `pandas` + `pika`
- Rol:
  - descarga el dataset desde Kaggle o lee CSV desde `LOCAL_DATASET_PATH`,
  - limpia y valida filas,
  - publica mensajes en la cola `raw_logs`.

## Qué desplegar según tu objetivo

### Opción A: dashboard sobre Mongo ya poblado

Despliega:

- MongoDB
- `api-log-guard`
- frontend Next.js

No necesitas:

- RabbitMQ
- `analytics-engine`
- `ingestion-service`

Este es el camino más simple si:

- ya tienes una colección `logs`,
- ya tienes una colección `alerts`,
- o vas a cargar los documentos manualmente.

### Opción B: pipeline completo

Despliega:

- MongoDB
- RabbitMQ
- `analytics-engine`
- `ingestion-service`
- `api-log-guard`
- frontend Next.js

Este modo sirve si quieres poblar MongoDB desde CICIDS-2017 usando los workers incluidos en el repo.

## Infraestructura recomendada

### MongoDB

- Recomendado: MongoDB Atlas
- Colecciones esperadas: `logs`, `alerts`

### RabbitMQ

- Recomendado: CloudAMQP, Amazon MQ o cualquier broker AMQP compatible
- Colas usadas por el código:
  - `raw_logs`
  - `processed_logs`
  - `alerts`

## Comandos de arranque sugeridos

| Servicio | Comando |
|----------|---------|
| Frontend Next.js | `npm run build && npm run start` |
| `api-log-guard` | `npm start` |
| `analytics-engine` | `python main.py` |
| `ingestion-service` | `python main.py` |

Notas:

- En el frontend, ejecuta `npm install` en la raíz antes del build.
- En `services/api-log-guard`, ejecuta `npm install` dentro de esa carpeta o usa tu `Dockerfile`.
- En los servicios Python, crea el entorno e instala `requirements.txt` antes del arranque.

## Variables de entorno reales

### Frontend / Next.js

| Variable | Uso real |
|----------|----------|
| `API_GATEWAY_URL` | URL base del gateway que consumirá el proxy `/api/*`. Ejemplo: `https://api-log-guard.tu-dominio.com` |
| `NEXT_PUBLIC_API_URL` | Fallback heredado. El proxy aún la revisa, pero hoy la opción recomendada es `API_GATEWAY_URL`. |

Notas:

- En desarrollo, si no existe `API_GATEWAY_URL`, el proxy cae a `http://localhost:4000`.
- En producción, si falta `API_GATEWAY_URL`, las rutas `/api/*` devolverán `503`.

### api-log-guard

| Variable | Uso real |
|----------|----------|
| `PORT` | Puerto HTTP del servicio. |
| `MONGODB_URL` | URI de MongoDB. |
| `MONGODB_DB_NAME` | Base de datos que leerá el gateway. |
| `CORS_ORIGIN` | Origen permitido para llamadas directas al gateway. |

Notas:

- El código actual del gateway **no usa RabbitMQ**.
- `ENABLE_RABBITMQ` puede aparecer en ejemplos viejos, pero hoy no se lee.
- Si despliegas el servicio de forma independiente, configura estas variables en la plataforma; el helper `load-env.js` solo es cómodo para el monorepo local.

### analytics-engine

| Variable | Uso real |
|----------|----------|
| `MONGODB_URL` | URI de MongoDB. |
| `RABBITMQ_URL` | URI del broker AMQP. |
| `MODEL_PATH` | Declarada en configuración, pero el código actual no carga ningún modelo desde ahí. |

Notas críticas:

- El servicio escribe en la base **`logguard`** de forma fija (`self.client.logguard`).
- Aunque el gateway permita elegir `MONGODB_DB_NAME`, el pipeline no respeta ese valor.
- Si quieres que el dashboard vea lo que inserta `analytics-engine` sin tocar código, mantén `MONGODB_DB_NAME=logguard` en el gateway.

### ingestion-service

| Variable | Uso real |
|----------|----------|
| `RABBITMQ_URL` | URI del broker AMQP. |
| `LOCAL_DATASET_PATH` | Si apunta a una carpeta válida con CSV, el servicio no llama a Kaggle. |
| `KAGGLE_DATASET` | Dataset a descargar con `kagglehub`. Por defecto: `bertvankeulen/cicids-2017`. |
| `KAGGLE_API_TOKEN` | Token actual recomendado por Kaggle Hub. |
| `KAGGLE_USERNAME` / `KAGGLE_KEY` | Compatibilidad heredada; si `KAGGLE_KEY` empieza por `KGAT_`, el servicio lo copia a `KAGGLE_API_TOKEN`. |
| `STREAM_INTERVAL_MS` | Tiempo entre mensajes publicados. |
| `MAX_STREAM_ROWS` | Límite total de filas emitidas por pasada. |
| `SAMPLE_ROWS_PER_CSV` | Recorta cada CSV a sus primeras `N` filas antes de combinar. |
| `DATA_PATH` | Declarada en configuración, pero el código actual no la usa. |

## Contrato operativo de datos

### Formato de timestamps

El proyecto actual funciona mejor si `timestamp` está guardado como **string ISO 8601**. Ejemplo:

```json
"timestamp": "2017-02-15T09:18:00Z"
```

Motivo:

- `/api/logs`, `/api/alerts` y varios endpoints de estadísticas filtran por `from`/`to` comparando directamente el campo `timestamp`.
- Si importas datos con otro formato, los filtros por rango y parte de las agregaciones pueden comportarse mal.

### Base de datos esperada

- Colección `logs`: documentos en el formato que produce `analytics-engine`
- Colección `alerts`: alertas con `acknowledged: true/false`

## Comportamientos importantes en producción

### El dashboard no es streaming real

- La pantalla `/live-logs` usa polling cada `8s` cuando el usuario activa el modo en vivo.
- No hay websockets ni suscripción push en el código actual.

### El rango inicial puede dejar el dashboard vacío

- La pantalla principal y `/alerts` arrancan con el rango del día actual del navegador.
- Si tus datos conservan fechas de CICIDS-2017, tendrás que seleccionar manualmente febrero/julio de 2017 para ver datos en esas vistas.

### ingestion-service repite la carga

Cuando `ingestion-service` termina de recorrer el dataset:

- espera `5` segundos,
- y vuelve a publicar el dataset desde el principio.

Eso significa que, si el servicio permanece corriendo, seguirá insertando más documentos en MongoDB. Para una carga única controlada, detén el proceso después de la primera pasada o limita la muestra con `SAMPLE_ROWS_PER_CSV` / `MAX_STREAM_ROWS`.

## Orden recomendado de despliegue

### Si solo quieres visualizar datos existentes

1. Crear MongoDB y cargar `logs` y `alerts`.
2. Desplegar `api-log-guard` con `MONGODB_URL`, `MONGODB_DB_NAME`, `CORS_ORIGIN`.
3. Verificar `GET /health`.
4. Desplegar Next.js con `API_GATEWAY_URL` apuntando al gateway.
5. Verificar en el frontend `/api/stats/dashboard` y `/api/logs?limit=1`.

### Si también quieres poblar datos con el pipeline

1. Crear MongoDB.
2. Crear RabbitMQ.
3. Desplegar `analytics-engine` con `MONGODB_URL` y `RABBITMQ_URL`.
4. Desplegar `ingestion-service` con `RABBITMQ_URL` y `LOCAL_DATASET_PATH` o credenciales Kaggle.
5. Desplegar `api-log-guard`.
6. Desplegar Next.js con `API_GATEWAY_URL`.

## Smoke tests recomendados

### Gateway

- `GET /health`
- `GET /api/logs?limit=1`
- `GET /api/stats/dashboard`
- `GET /api/stats/protocols`

### Frontend

- Abrir `/`
- Confirmar que el proxy responde sin errores `503`
- Ajustar el rango del calendario si los datos están en 2017
- Abrir `/alerts` y probar un `Reconocer` si existen alertas abiertas

### Pipeline

- Verificar que `raw_logs` recibe mensajes
- Verificar que MongoDB recibe documentos en `logs`
- Verificar que solo los ataques generan documentos en `alerts`

## Observaciones para plataformas cloud

- `api-log-guard` puede vivir en un servicio HTTP tradicional.
- `analytics-engine` e `ingestion-service` necesitan procesos persistentes de background.
- `ingestion-service` requiere salida a internet si descargará desde Kaggle.
- Si usas `LOCAL_DATASET_PATH`, la plataforma debe montar esos archivos en el contenedor o en el filesystem disponible para el proceso.

## Resumen de mínimos

- **Visualización**: Next.js + `api-log-guard` + MongoDB
- **Carga automática**: añadir RabbitMQ + `analytics-engine` + `ingestion-service`

Ese es el estado real del proyecto hoy.
