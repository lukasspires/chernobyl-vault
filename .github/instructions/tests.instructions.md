---
applyTo: "backend/test/**/*.ts,frontend/src/**/*.test.ts,frontend/src/**/*.test.tsx,frontend/src/test/**/*.ts,frontend/vitest.config.ts"
---

# Test instructions

- Test public behavior and observable contracts, not implementation details.
- Cover success, invalid input, empty data, limits, missing files, corrupt archives, dependency failure, and cleanup behavior relevant to the change.
- Backend tests use `node:test`, `node:assert/strict`, Fastify injection, temporary SQLite databases, and temporary filesystem fixtures.
- Frontend tests use Vitest, jsdom, Testing Library, and user-event; prefer user-visible assertions.
- Do not access live metadata services, the real `data/` directory, or configured library paths.
- Keep fixtures small and synthetic. Always close databases, Fastify instances, and temporary resources.
- Avoid sleeps, network calls, shared mutable state, and order-dependent assertions.
- For bug fixes, add a regression test that fails before the fix.

