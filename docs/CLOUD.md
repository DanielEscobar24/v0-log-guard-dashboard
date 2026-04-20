# LogGuard — despliegue en la nube (sin Docker Compose)

Este documento es la referencia para ejecutar el **backend** (microservicios + datos) usando **servicios administrados** y **tres procesos** desplegados donde elijas (Railway, Render, Fly.io, AWS ECS/Fargate, una VM, etc.). No hace falta `docker-compose`: cada servicio ya tiene su propio `Dockerfile` en su carpeta si tu plataforma construye imágenes.

## Qué hay que correr (3 microservicios)

| Servicio | Carpeta | Rol |
|----------|---------|-----|
| **api-gateway** | `services/api-gateway/` | HTTP + Socket.io hacia el front; lee Mongo y consume colas `processed_logs` / `alerts`. |
| **analytics-engine** | `services/analytics-engine/` | Consume `raw_logs`, escribe en Mongo, publica `processed_logs` y `alerts`. |
| **ingestion-service** | `services/ingestion-service/` | Descarga el dataset (Kaggle) y publica a `raw_logs`. |

## Infraestructura en la nube (recomendado)

- **MongoDB**: [MongoDB Atlas](https://www.mongodb.com/atlas) (o el proveedor que uses). Crea un cluster y la base `logguard` (o la que uses en la URI).
- **RabbitMQ**: [CloudAMQP](https://www.cloudamqp.com/) o **Amazon MQ** (protocolo AMQP). Declara colas `raw_logs`, `processed_logs`, `alerts` con durable=true (o deja que los servicios las declaren al arrancar, como hace el código hoy).

## Variables de entorno (contrato real)

Los tres servicios leen URLs completas, no el `docker-compose` anterior.

### api-gateway (`services/api-gateway/server.js`)

| Variable | Ejemplo / notas |
|----------|-----------------|
| `PORT` | `4000` (o el que asigne el PaaS). |
| `MONGODB_URL` | URI de Atlas, ej. `mongodb+srv://user:pass@cluster.mongodb.net/logguard?...` |
| `RABBITMQ_URL` | URI AMQP del broker, ej. `amqps://user:pass@xxx.cloudamqp.com/vhost` |
| `CORS_ORIGIN` | URL del front en producción, ej. `https://tu-app.vercel.app` |

### analytics-engine (`services/analytics-engine/main.py`)

| Variable | Ejemplo / notas |
|----------|-----------------|
| `MONGODB_URL` | Igual que el gateway. |
| `RABBITMQ_URL` | Igual que el gateway. |
| `MODEL_PATH` | Ruta solo si montas un modelo `.pkl`; por defecto `/app/model` en contenedor. |

### ingestion-service (`services/ingestion-service/main.py`)

| Variable | Ejemplo / notas |
|----------|-----------------|
| `RABBITMQ_URL` | Igual que arriba. |
| `KAGGLE_API_TOKEN` | **Recomendado** (kagglehub ≥ 0.4): token desde Ajustes → API (suele empezar por `KGAT_`). |
| `KAGGLE_USERNAME` / `KAGGLE_KEY` | Credenciales “legacy”; si solo tienes token `KGAT_` en `KAGGLE_KEY`, el ingestion lo mapea a `KAGGLE_API_TOKEN` al descargar vía API. |
| `KAGGLE_DATASET` | Opcional; por defecto `bertvankeulen/cicids-2017` (ejemplo oficial en Kaggle Hub). Otro mirror, p. ej. `ciaboreanuda/cicids2017-cleaned`, solo si tu cuenta tiene acceso vía API. |
| `LOCAL_DATASET_PATH` | **Opcional**: ruta absoluta o relativa a una carpeta con `.csv` (recursivo). Si está definida y válida, **no** se llama a Kaggle (evita 403 por reglas/consentimiento no aceptados en la web). |
| `STREAM_INTERVAL_MS` | Opcional, ej. `500`. |
| `MAX_STREAM_ROWS` | Opcional; entero \> 0 = máximo de filas publicadas **por cada pasada** del stream **después** de unir los CSV. Vacío = sin tope. Si usas `SAMPLE_ROWS_PER_CSV`, suele convenir dejar esto vacío para publicar todas las filas de la muestra. |
| `SAMPLE_ROWS_PER_CSV` | Opcional; entero \> 0 = solo las **primeras N filas de cada archivo .csv** (p. ej. 10 por día). Orden estable entre ficheros; el stream **no** mezcla filas al azar en este modo. |
| `DATA_PATH` | Opcional; ruta writable si quieres volcar datos en disco. |

## Desarrollo local (Python)

`ingestion-service` declara versiones de **`pandas` / `numpy` / `kagglehub`** con ruedas para **Python 3.13**. Si `pip install -r requirements.txt` intenta compilar pandas desde fuente y falla, borra `.venv` en esa carpeta y vuelve a instalar tras `git pull`.

Si RabbitMQ devuelve **`PRECONDITION_FAILED - Existing queue ... declared with other arguments`**, es casi siempre porque **dos servicios declararon la misma cola con opciones distintas**. Arranca siempre **analytics** antes o borra las colas en CloudAMQP y vuelve a declararlas con el mismo código.

Si **Kaggle** devuelve **`403`** aunque el log muestre el token (`KGAT_`): entra en Kaggle con la **misma cuenta** que creó el token, abre la página del dataset y **acepta reglas / términos** si aparecen (la API suele fallar hasta entonces). Alternativa inmediata: define **`LOCAL_DATASET_PATH`** con una carpeta que contenga los `.csv` descargados y descomprimidos **desde el navegador**; el servicio no llamará a la API de Kaggle.

### Arranque local de los dos workers (Python)

Con los `.venv` ya creados en `services/analytics-engine` y `services/ingestion-service`:

```bash
cd /ruta/al/v0-log-guard-dashboard
python3 scripts/run_logguard_workers.py
```

Carga **`.env`** de la raíz, levanta **analytics** (espera 2 s) y luego **ingestion**; **Ctrl+C** detiene ambos.

## Orden sugerido al desplegar

1. Crear **Atlas** y **RabbitMQ**; copiar `MONGODB_URL` y `RABBITMQ_URL`.
2. Desplegar **api-gateway** y comprobar `GET /health` (y `GET /api/logs` cuando ya haya datos).
3. Desplegar **analytics-engine** (sin él, los mensajes en `raw_logs` no se procesan).
4. Desplegar **ingestion-service** (requiere salida a internet hacia Kaggle).

## Front (Next)

El front no define el pipeline; solo debe apuntar al gateway público (REST y/o Socket.io). Define las variables en tu **`.env`** en la raíz cuando conectes datos reales.

## Nota sobre Docker

Los **`Dockerfile`** dentro de `services/*` sirven para **build en la nube** (CI/CD, ECS, etc.). Este repo ya no incluye `docker-compose.yml` para evitar mezclar “orquestación local” con el modelo mental de **URLs + tres servicios + Atlas + Rabbit**.
