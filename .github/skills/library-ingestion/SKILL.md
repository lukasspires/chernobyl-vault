---
name: library-ingestion
description: Modify Manga Reader filesystem scanning, CBZ/CBR/PDF parsing, image folders, covers, page extraction, and reconciliation without risking source files or database integrity.
argument-hint: "[scanner, parser, or format change]"
---

# Safe manga library ingestion

1. Inspect scanner, parser, reader routes, cache paths, schema, and existing fixtures.
2. Define roots, formats, identity, grouping, ordering, page-count, and failure semantics.
3. Treat all paths and archive members as untrusted; validate containment after resolution.
4. Never mutate source library files or use the user's library in tests.
5. Preserve idempotency and do not reconcile deletions beneath missing or failed roots.
6. Bound file/archive/image sizes, page indexes, concurrency, memory, and execution time.
7. Isolate corrupt content and return accurate added, updated, removed, failed, and missing counts.
8. Test repeated scans, corrupt files, vanished files, missing roots, nested folders, natural order, and cleanup with synthetic temporary fixtures.
9. Run backend tests and build.

Use [the ingestion checklist](./templates/ingestion-checklist.md).

