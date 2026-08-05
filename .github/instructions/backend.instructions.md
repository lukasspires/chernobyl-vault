---
applyTo: "backend/**/*.ts,backend/**/*.sql,backend/package.json,backend/tsconfig.json"
---

# Fastify backend instructions

- Preserve Node.js 22+, Fastify 5, TypeScript strict mode, ESM, and `.js` suffixes in TypeScript relative imports.
- Build the app through `buildApp` so tests can inject a database, cache directory, frontend directory, and logger behavior.
- Validate params, query strings, and bodies at the HTTP boundary. Return intentional status codes and stable `{ error: string }` responses.
- Use parameterized `better-sqlite3` statements. Bound result sets and use transactions for atomic multi-table mutations.
- Register cleanup for owned resources; do not close injected test dependencies.
- Keep route modules focused and move reusable scanning, parsing, metadata, and storage logic to services.
- Validate resolved paths against approved roots before reading files or serving cached content.
- Preserve `backend/scripts/copy-assets.mjs`: the compiled app requires `dist/db/schema.sql`.
- Add `node:test` coverage under `backend/test/` and use temporary directories from the existing helpers.
- Run `npm test` and `npm run build` from `backend/` after backend changes.

