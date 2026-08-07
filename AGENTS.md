# Agent operating guide

This file gives repository-level operational context to AI coding agents working on Chernobyl Vault.

## First actions

1. Read `.github/copilot-instructions.md`.
2. Read the matching files in `.github/instructions/`.
3. Inspect nearby production code and tests before editing.
4. Check `git status` and preserve unrelated worktree changes.

## Project map

- React frontend: `frontend/src/`
- Frontend API contract: `frontend/src/api.ts`
- Frontend tests: colocated `frontend/src/**/*.test.tsx`
- Fastify backend: `backend/src/`
- HTTP routes: `backend/src/routes/`
- Library scanning and archive parsing: `backend/src/services/`
- SQLite access and schema: `backend/src/db/`
- Backend tests: `backend/test/`
- Infrastructure: `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml`
- Persistent runtime data: `data/` (ignored; never commit or use as a test fixture)

## Runtime and architecture

- Node.js 22 or newer; npm lockfiles are authoritative.
- Frontend: React 19, TypeScript 5.7, Vite 6, React Router 7, TanStack Query 5, Zustand 5, Tailwind CSS 4.
- Backend: Fastify 5, TypeScript ESM, `better-sqlite3`, and local filesystem access.
- Supported content: CBZ, CBR, PDF, and image folders.
- Production builds the frontend and backend in a multi-stage container; Fastify serves the frontend bundle.
- The application has no authentication and must remain restricted to a trusted LAN or VPN unless authentication is deliberately added.

## Commands

Run commands from the indicated directory.

### Backend (`backend/`)

- Install: `npm ci`
- Develop: `npm run dev`
- Test: `npm test`
- Build: `npm run build`
- Start compiled server: `npm start`
- Debug a scan: `npm run debug:scan`

### Frontend (`frontend/`)

- Install: `npm ci`
- Develop: `npm run dev`
- Test: `npm test`
- Build: `npm run build`
- Preview compiled frontend: `npm run preview`

### Repository root

- Validate Compose: `docker compose config --quiet`
- Build container: `docker build -t chernobyl-vault:local .`
- Run application: `docker compose up -d --build`

The CI workflow runs both test suites, both builds, verifies `backend/dist/db/schema.sql`, and builds the container.

## Change discipline

- Keep the API types in `frontend/src/api.ts` aligned with backend response contracts.
- Treat filesystem paths, archive entries, image bytes, settings, query parameters, and remote metadata as untrusted input.
- Preserve scan idempotency. Missing or temporarily inaccessible library roots must not cause unrelated chapter deletion.
- Make schema changes forward-compatible for existing SQLite databases; `CREATE TABLE IF NOT EXISTS` alone is not a migration strategy for altered tables.
- Do not expose raw library paths, secrets, stack traces, or database details through API responses or logs.
- Use temporary directories and synthetic fixtures in tests. Never mutate `data/` or the user's library.
- Do not edit package lockfiles unless dependency resolution changed.
- Do not claim a command passed unless it was executed successfully.

