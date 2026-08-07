# Como contribuir

Obrigado por contribuir com o Chernobyl Vault.

## Antes de começar

1. Procure uma issue existente ou abra uma proposta curta para mudanças relevantes.
2. Não inclua quadrinhos, bancos de dados, caminhos pessoais, credenciais ou conteúdo protegido.
3. Use Node.js 22 ou superior e preserve os lockfiles do npm.

## Desenvolvimento

- Backend: `cd backend && npm ci && npm test && npm run build`
- Frontend: `cd frontend && npm ci && npm test && npm run build`
- Infraestrutura: `docker compose config --quiet`

Use fixtures sintéticas e diretórios temporários nos testes. Nunca acesse ou altere a biblioteca real ou o diretório `data/`.

## Pull requests

- Crie uma branch focada e mantenha o PR pequeno o suficiente para revisão.
- Explique o problema, a solução, o impacto e os comandos de validação executados.
- Adicione testes de regressão para correções e cubra estados de erro relevantes.
- Mantenha contratos do backend e tipos de `frontend/src/api.ts` sincronizados.
- Aguarde o check `verify` e resolva todas as conversas antes do merge.

Ao contribuir, você concorda que sua contribuição será licenciada sob a AGPL-3.0.
