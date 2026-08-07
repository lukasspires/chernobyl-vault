# Repository instructions for Chernobyl Vault

## Communication

- Respond in Brazilian Portuguese unless the user requests another language.
- Keep identifiers, public API names, code comments, logs, and technical documentation in English unless nearby code establishes another convention.
- State assumptions explicitly. Do not invent endpoints, settings, schema fields, commands, or dependency versions.

## Repository-first workflow

Before changing code:

1. Read `AGENTS.md` and the matching path-specific instructions.
2. Inspect the relevant source, colocated tests, package manifest, API types, SQLite schema, and deployment files.
3. Check the current diff and preserve unrelated user changes.
4. Prefer the smallest coherent change and existing dependencies.

## Architecture

- Preserve the React 19 + Vite frontend and Fastify 5 + TypeScript ESM backend.
- Keep HTTP handlers thin; put reusable filesystem, parsing, metadata, and database behavior in focused services.
- Keep frontend server state in TanStack Query and persistent reader preferences in the existing Zustand store.
- Maintain explicit types at API and storage boundaries. Narrow `unknown` data before use and avoid `any`.
- Keep `frontend/src/api.ts` synchronized with backend request and response contracts.

## Manga library and data safety

- Treat configured paths, filenames, archive members, PDFs, images, request parameters, metadata responses, and settings as untrusted input.
- Resolve and validate paths before reading or serving files. Prevent path traversal and unsafe archive extraction.
- The comic library is read-only. Do not rename, move, overwrite, or delete source library files.
- Preserve scanner idempotency and stable chapter identity by path. A missing or failed root must not trigger destructive reconciliation for that root.
- Bound archive/image sizes, page indexes, queries, network response sizes, scan concurrency, and execution time where relevant.
- Use transactions for multi-statement SQLite updates that must remain consistent.
- Schema changes must support existing databases and include an explicit migration or compatibility strategy.

## Security and privacy

- This application has no authentication. Keep deployment guidance limited to a trusted LAN or VPN unless authentication is explicitly in scope.
- Never commit or log `.env`, API keys, comic contents, database files, absolute library paths, or personal reading history.
- Keep external metadata calls time-bounded, validate status/content type/size, and mock them in tests.
- Return stable API errors without stack traces or internal filesystem/database details.

## Testing and completion

- Add or update deterministic tests for changed behavior, including failure and boundary paths.
- Backend tests use `node:test` through `npm test`; frontend tests use Vitest and Testing Library through `npm test`.
- Use temporary directories and synthetic archives/images. Never access the user's real library or `data/` in tests.
- Run the relevant tests and builds declared in `AGENTS.md`. Report commands actually run, skipped checks, assumptions, and remaining risks.

