---
name: fastify-api
description: Implement stable Manga Reader Fastify and SQLite APIs with validation, bounded access, error mapping, frontend contract alignment, and Node tests.
argument-hint: "[endpoint or backend behavior]"
---

# Manga Reader Fastify API

1. Inspect the route, service, schema, frontend API types, tests, and deployment behavior.
2. Define request, response, status, and error contracts.
3. Validate params, query strings, bodies, paths, and external values.
4. Use parameterized SQL, bounded queries, and transactions for atomic changes.
5. Preserve compatibility with existing SQLite databases and document migration behavior.
6. Avoid exposing paths, keys, stack traces, or database internals.
7. Test through `buildApp` and Fastify injection with a temporary database.
8. Run `npm test` and `npm run build` from `backend/`.

Use [the endpoint checklist](./templates/endpoint-checklist.md).

