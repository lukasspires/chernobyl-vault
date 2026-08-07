# GitHub Copilot configuration for Chernobyl Vault

This repository contains project-specific Copilot customizations for the Chernobyl Vault stack. The configuration is intentionally limited to React, Fastify, SQLite, filesystem ingestion, and the container deployment used here.

## Structure

```text
.github/
|-- copilot-instructions.md
|-- agents/
|-- instructions/
|-- prompts/
|-- skills/
`-- workflows/ci.yml
AGENTS.md
```

## Custom agents

- `frontend-react`: React UI, reader interactions, routing, state, accessibility, and Vitest tests.
- `backend-fastify`: Fastify routes, validation, SQLite access, filesystem safety, and Node tests.
- `library-ingestion`: scanning, archive parsing, page extraction, covers, and safe reconciliation.
- `solution-architect`: read-only planning across frontend, backend, storage, and deployment.
- `code-review`: read-only, low-noise correctness and security review.

## Reusable prompts

- `/plan-change`: inspect the repository and produce a risk-aware plan.
- `/frontend-feature`: implement a complete React feature.
- `/backend-endpoint`: implement or modify a Fastify endpoint.
- `/scan-library-change`: change scanner or parser behavior without risking library data.
- `/review-change`: review the current diff and run appropriate checks.

## Skills

- `react-feature`: complete React feature workflow.
- `fastify-api`: stable Fastify/SQLite API workflow.
- `library-ingestion`: safe scan, archive, and page-extraction workflow.
- `quality-gate`: repository-specific pre-merge verification.

## Expected verification

Run the smallest relevant checks while iterating. Before merging a cross-stack change, match CI:

```bash
cd backend && npm ci && npm test && npm run build
cd frontend && npm ci && npm test && npm run build
docker build -t chernobyl-vault:local .
```

Also confirm that `backend/dist/db/schema.sql` exists after the backend build. Use `docker compose config --quiet` when changing Compose or environment configuration.

## Safety boundaries

The application reads user-selected library paths and has no authentication. Agents must not expose it publicly, modify comic files, use the real `data/` directory in tests, weaken path validation, or log API keys and full filesystem paths. Any authentication or public deployment work requires an explicit threat model.

