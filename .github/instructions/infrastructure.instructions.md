---
applyTo: "Dockerfile,backend/Dockerfile,docker-compose.yml,.dockerignore,.env.example,.github/workflows/**/*.yml"
---

# Infrastructure instructions

- Preserve Node.js 22 and reproducible `npm ci` installs from both lockfiles.
- Keep the comic library volume read-only. Persistent application state belongs under `/app/data`; library content belongs under `/library`.
- The production container exposes the Fastify server, which also serves the compiled frontend.
- Keep the health check on `/api/health` aligned with the backend.
- Do not bake `.env`, databases, caches, library files, or API credentials into images.
- When builds change, preserve the frontend build, backend build, `dist/db/schema.sql` asset, production dependency pruning, and final runtime layout.
- Validate Compose with `docker compose config --quiet`; for Docker changes, build the root image when available.
- The app has no authentication. Do not recommend direct public exposure.

