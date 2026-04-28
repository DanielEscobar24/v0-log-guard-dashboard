# v0-log-guard-dashboard

This is a [Next.js](https://nextjs.org) project bootstrapped with [v0](https://v0.app).

## LogGuard — backend en la nube

El pipeline (ingestión → RabbitMQ → analytics → MongoDB → **api-log-guard**) se documenta para **despliegue en la nube** (Atlas, Rabbit administrado, tres servicios). No usamos `docker-compose` en este repo: cada microservicio tiene su `Dockerfile` bajo `services/` para quien despliegue con contenedores en un PaaS o en AWS.

- **Guía**: [docs/CLOUD.md](docs/CLOUD.md)
- **Variables**: crea un **`.env`** en la raíz (no se sube a Git) con `MONGODB_URL`, `RABBITMQ_URL`, Kaggle y `CORS_ORIGIN`; detalle en la guía.
- **Workers locales**: con los `venv` de cada servicio listos, `python3 scripts/run_logguard_workers.py` arranca analytics + ingestion (ver [docs/CLOUD.md](docs/CLOUD.md)).

## Frontend en Vercel

El frontend ya no necesita exponer `NEXT_PUBLIC_API_URL` para hablar con el gateway. Ahora usa un proxy interno de Next:

- En local, si no defines nada, el proxy apunta a `http://localhost:4000`.
- En Vercel, define `API_GATEWAY_URL=https://tu-api-log-guard...` en las variables del proyecto.
- El navegador solo consume `/api/...` del mismo dominio del frontend.

## Built with v0

This repository is linked to a [v0](https://v0.app) project. You can continue developing by visiting the link below -- start new chats to make changes, and v0 will push commits directly to this repo. Every merge to `main` will automatically deploy.

[Continue working on v0 →](https://v0.app/chat/projects/prj_LlrgUqtG5NbfmIVlWhhim5AU0pBB)

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Learn More

To learn more, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.
- [v0 Documentation](https://v0.app/docs) - learn about v0 and how to use it.

<a href="https://v0.app/chat/api/kiro/clone/DanielEscobar24/v0-log-guard-dashboard" alt="Open in Kiro"><img src="https://pdgvvgmkdvyeydso.public.blob.vercel-storage.com/open%20in%20kiro.svg?sanitize=true" /></a>
