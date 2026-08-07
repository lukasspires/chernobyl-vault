---
name: quality-gate
description: Validate Chernobyl Vault changes before merge across React, Fastify, SQLite, filesystem ingestion, tests, builds, and Docker.
argument-hint: "[diff, branch, or feature]"
---

# Chernobyl Vault quality gate

1. Inspect the diff and identify affected UI, API, database, filesystem, cache, and deployment contracts.
2. Run only relevant repository-supported checks while iterating; for cross-stack work, match CI.
3. Review library immutability, path/archive safety, scan idempotency, database migrations, progress correctness, API type alignment, resource limits, secrets, and error leakage.
4. Verify deterministic tests cover changed behavior and failure paths without real library or network access.
5. Confirm backend build copies `dist/db/schema.sql` and container layout still serves the frontend.
6. Report verified failures separately from unexecuted checks and assumptions.

Use [the review checklist](./templates/review-checklist.md).

