# LogGuard Dashboard

LogGuard es una aplicación para explorar flujos de red clasificados a partir de CICIDS-2017. El proyecto combina un dashboard en Next.js con un backend que consulta MongoDB y expone métricas listas para visualización.

En la iteración actual el panel principal está pensado para analizar un lote cargado en Mongo, no para monitoreo en tiempo real. La referencia operativa más clara es trabajar con un subconjunto del dataset, por ejemplo `friday.csv`, y transformar cada flujo a un documento como:

```json
{
  "timestamp": "2026-04-20T23:29:20.339894Z",
  "src_ip": "192.168.10.3",
  "dst_ip": "192.168.10.1",
  "src_port": 62547,
  "dst_port": 53,
  "protocol": "UDP",
  "bytes_sent": 94,
  "bytes_received": 250,
  "packets": 4,
  "duration": 115.895,
  "label": "Benign",
  "severity": "low",
  "confidence": 0.95
}
```

## Qué muestra la aplicación

- Panel principal con volumen total, proporción de ataques, tráfico benigno y eventos de mayor riesgo.
- Distribución por clasificación, severidad y protocolos observados.
- Ranking de tipos de ataque y orígenes sospechosos.
- Tabla de registros con filtro por rango de fechas y exportación a CSV.

## Arquitectura resumida

- `app/` y `components/`: frontend en Next.js 16.
- `app/api/[...path]/route.ts`: proxy interno de Next hacia el gateway real.
- `services/api-log-guard/`: API REST que consulta MongoDB y expone estadísticas para el dashboard.
- `services/analytics-engine/`: transforma flujos, asigna severidad y genera alertas.
- `services/ingestion-service/`: descarga o lee el dataset y publica eventos para procesamiento.

La guía de despliegue cloud del backend está en [docs/CLOUD.md](docs/CLOUD.md).

## Requisitos

- Node.js 20 o superior
- npm
- MongoDB accesible desde `api-log-guard`
- Python 3 para los workers si quieres poblar datos desde el pipeline

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto. Estas son las más importantes para el dashboard:

```bash
API_GATEWAY_URL=http://localhost:4000
MONGODB_URL=mongodb://...
MONGODB_DB_NAME=logguard
RABBITMQ_URL=amqp://...
CORS_ORIGIN=http://localhost:3000
```

Notas:

- En local, si `API_GATEWAY_URL` no existe, el proxy de Next usa `http://localhost:4000`.
- En Vercel conviene definir `API_GATEWAY_URL` con la URL pública HTTPS del backend.

## Ejecución local

Instala dependencias del frontend:

```bash
npm install
```

Inicia la aplicación:

```bash
npm run dev
```

Esto levanta Next.js y el gateway local mediante `scripts/dev-with-gateway.sh`.

Abre `http://localhost:3000`.

## Poblar datos

Si ya tienes Mongo con la colección `logs`, el dashboard debería responder de inmediato.

Si quieres poblarla desde el pipeline:

```bash
python3 scripts/run_logguard_workers.py
```

Ese script arranca `analytics-engine` e `ingestion-service` usando el `.env` de la raíz. Para esta iteración, una estrategia práctica es trabajar con un único día del dataset, como `friday.csv`, y cargar sus flujos en Mongo para mantener el análisis enfocado y liviano.

## Endpoints que usa el panel

El frontend consume rutas relativas `/api/...` y Next las reenvía al gateway. Las vistas principales dependen de:

- `/api/stats/dashboard`
- `/api/stats/attacks`
- `/api/stats/protocols`
- `/api/stats/top-sources`
- `/api/logs`

## Cómo leer el panel principal

- `Total_Flows`: tamaño del lote analizado.
- `Attacks`: flujos con `label` distinto de `Benign`.
- `Normal`: tráfico clasificado como benigno.
- `High Risk`: eventos en severidad `high` o `critical`.
- `Clasificación del tráfico`: composición general del lote.
- `Severidad observada`: prioridad operativa del conjunto cargado.
- `Protocolos con actividad sospechosa`: qué protocolos concentran más ataques relativos.
- `Riesgo por tipo de ataque`: distribución del subconjunto malicioso.
- `Orígenes sospechosos`: IP origen con mayor volumen de eventos marcados como ataque.

## Desarrollo

Scripts disponibles:

```bash
npm run dev
npm run dev:next
npm run dev:workers
npm run build
npm run lint
```

## Despliegue

Frontend:

- Despliega Next.js en Vercel.
- Configura `API_GATEWAY_URL` en el proyecto.

Backend y pipeline:

- Despliega `api-log-guard`, `analytics-engine` e `ingestion-service` en el proveedor que prefieras.
- Usa la guía de [docs/CLOUD.md](docs/CLOUD.md) para MongoDB Atlas, RabbitMQ y variables necesarias.
