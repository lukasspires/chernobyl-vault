# Chernobyl Vault review checklist

- Backend: `npm test`, `npm run build`, and `dist/db/schema.sql`
- Frontend: `npm test` and `npm run build`
- API request/response type alignment
- SQLite compatibility and transaction safety
- Read-only library and path containment
- Missing-root and corrupt-file behavior
- Resource bounds and cleanup
- No secrets, database files, cache, or library content added
- Compose validation and container build when affected
- LAN/VPN-only deployment assumption remains explicit

