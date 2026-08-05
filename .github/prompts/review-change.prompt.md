---
name: review-change
description: Review a Manga Reader change for correctness, security, data safety, compatibility, and missing tests.
agent: code-review
---

Review the current diff or requested files and run safe repository checks when useful. Report verified actionable findings ordered by severity with locations, impact, reasoning, and corrections. Check library immutability, path/archive safety, SQLite compatibility, scan idempotency, progress correctness, API contract alignment, resource bounds, secrets, container assets, and test coverage. Do not report formatter-only style issues.

