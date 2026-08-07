# Política de segurança

## Versões suportadas

A branch `main` e a versão estável mais recente recebem correções de segurança.

## Relato responsável

Não abra uma issue pública para vulnerabilidades. Use **Security → Report a vulnerability** no GitHub para criar um relatório privado com:

- descrição e impacto;
- passos mínimos para reprodução;
- versão ou commit afetado;
- sugestão de correção, se disponível.

O mantenedor confirmará o recebimento e coordenará a divulgação depois que uma correção estiver disponível.

## Modelo de segurança

O Chernobyl Vault não possui autenticação. Uma instalação deve permanecer restrita a uma LAN confiável ou VPN. Caminhos, arquivos, URLs remotas, metadados e conteúdo de arquivos são entradas não confiáveis e devem ser tratados como tal.

Nunca envie bancos SQLite, `.env`, chaves de API, caminhos pessoais, histórico de leitura ou conteúdo da biblioteca em um relatório.
