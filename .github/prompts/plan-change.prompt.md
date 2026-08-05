---
name: plan-change
description: Inspect Manga Reader and create a risk-aware implementation plan.
agent: solution-architect
tools: ["read", "search"]
---

Analyze the requested change using the repository as the source of truth. Produce the goal and assumptions, current architecture involved, affected files and contracts, sequenced implementation plan, test and build commands, and security/data/migration/deployment/rollback risks. Pay special attention to API type drift, filesystem safety, existing SQLite databases, reading progress, and the unauthenticated deployment boundary.

