# Fase 1 — Biblioteca pessoal e acesso remoto

## Objetivo

Permitir que cada usuário instale sua própria cópia do Chernobyl Vault a partir do GitHub, mantenha uma biblioteca local independente e acesse essa instalação pelo celular, inclusive em redes 4G e 5G.

Nesta fase, cada instalação é monousuário. Banco de dados, arquivos, progresso, histórico, favoritos e downloads pertencem exclusivamente ao responsável por aquela instalação.

```text
Usuário A -> instalação A -> banco A -> biblioteca A
Usuário B -> instalação B -> banco B -> biblioteca B
```

Não há sincronização nem compartilhamento entre instalações.

## Escopo

- Distribuir o projeto pelo GitHub.
- Permitir instalação independente com Docker.
- Manter a biblioteca original montada como somente leitura.
- Armazenar banco, capas, cache e downloads localmente em `data/`.
- Permitir acesso remoto por Tailscale ou Cloudflare.
- Preservar pesquisa e downloads de fontes compatíveis.
- Não criar contas internas no Chernobyl Vault nesta fase.

## Fora do escopo

- Contas internas e perfis de usuário.
- Uma instalação atendendo várias pessoas.
- Bibliotecas compartilhadas.
- Sincronização entre computadores.
- Abertura direta da porta `3000` na internet.
- Contorno de login, CAPTCHA, paywall ou DRM em fontes externas.

## Instalação local

### Requisitos

- Git ou uma versão compactada publicada no GitHub.
- Docker Desktop e Docker Compose.
- Uma pasta local contendo arquivos compatíveis.

### Preparação

1. Clonar ou baixar o repositório.
2. Copiar `.env.example` para `.env`.
3. Informar o caminho da biblioteca:

```env
LIBRARY_PATH=C:\Mangas
```

4. Iniciar a aplicação:

```powershell
docker compose up -d --build
```

5. Abrir `http://localhost:3000`.
6. Confirmar `http://localhost:3000/api/health`.
7. Abrir **Configurações**, conferir o caminho e reescanear a biblioteca.

O retorno esperado do endpoint de saúde é:

```json
{"ok":true}
```

## Opção A — Tailscale

### Quando escolher

Escolher Tailscale quando somente o proprietário, ou poucos dispositivos confiáveis, precisarem acessar a instalação. É a alternativa recomendada para esta fase porque não exige domínio nem autenticação dentro do Chernobyl Vault.

### Funcionamento

```text
Celular autorizado
       |
       | rede privada Tailscale
       v
Computador do usuário:3000
```

### Implantação

1. Instalar Tailscale no computador que executa o Chernobyl Vault.
2. Instalar Tailscale no celular.
3. Autenticar os dois dispositivos na mesma `tailnet`.
4. Manter o Chernobyl Vault em execução.
5. Abrir no celular o IP Tailscale do computador:

```text
http://100.x.y.z:3000
```

6. Se MagicDNS estiver habilitado, usar o nome do dispositivo:

```text
http://nome-do-computador:3000
```

7. Opcionalmente, usar Tailscale Serve para oferecer HTTPS privado:

```powershell
tailscale serve --bg 3000
tailscale serve status
```

### Autenticação

Não é necessário implementar login no Chernobyl Vault. O controle de identidade e de dispositivos é feito pelo Tailscale.

### Cuidados

- Não habilitar Tailscale Funnel.
- Remover dispositivos antigos ou perdidos da `tailnet`.
- Não compartilhar a conta principal.
- Usar regras de acesso se outras pessoas forem adicionadas à rede.

## Opção B — Cloudflare Tunnel e Access

### Quando escolher

Escolher Cloudflare quando o usuário quiser um endereço HTTPS acessível em qualquer navegador, sem instalar VPN no celular. Essa opção exige um domínio administrado pela Cloudflare e autenticação externa.

### Funcionamento

```text
Navegador
   |
   | HTTPS e Cloudflare Access
   v
Cloudflare Tunnel
   |
   | conexão de saída
   v
Chernobyl Vault em localhost:3000
```

### Implantação

1. Adicionar o domínio à Cloudflare.
2. Criar uma organização no Cloudflare Zero Trust.
3. Criar um túnel permanente para o computador.
4. Instalar `cloudflared` como serviço.
5. Criar um hostname, por exemplo:

```text
vault.exemplo.com -> http://localhost:3000
```

6. Criar uma aplicação `Self-hosted` no Cloudflare Access.
7. Criar uma política que autorize somente o e-mail do proprietário.
8. Usar Cloudflare Identity ou código temporário por e-mail como método de entrada.
9. Testar o endereço usando 4G ou 5G.

### Isolamento da origem

Antes de considerar essa opção pronta, a publicação Docker deve aceitar conexões apenas do próprio computador:

```yaml
ports:
  - "127.0.0.1:3000:3001"
```

Essa alteração pode ser fornecida por um arquivo Compose específico para Cloudflare. Ela impede acesso direto pela rede local e evita que alguém contorne o Cloudflare Access.

### Autenticação

Não é necessário criar login interno. O Cloudflare Access autentica o proprietário antes de encaminhar as requisições ao aplicativo.

### Cuidados

- Nunca publicar o hostname sem uma política `Allow` restrita.
- Não usar Quick Tunnel em produção.
- Não encaminhar a porta `3000` no roteador.
- Proteger a conta Cloudflare com autenticação multifator.
- Guardar o token do túnel fora do repositório e dos logs.

## Comparação

| Critério | Tailscale | Cloudflare Tunnel + Access |
|---|---|---|
| Domínio próprio | Não | Sim |
| Aplicativo no celular | Sim | Não |
| Login interno no Vault | Não | Não |
| Autenticação externa | Conta/dispositivo Tailscale | Cloudflare Access |
| HTTPS amigável | Opcional com Serve | Sim |
| Melhor uso | Acesso pessoal simples | Acesso por navegador e domínio |
| Porta aberta no roteador | Não | Não |

## Downloads e responsabilidade

A existência de downloads não exige login interno porque há somente um proprietário por instalação. O acesso remoto, entretanto, deve ser protegido para impedir que terceiros iniciem downloads ou alterem configurações.

Cada usuário deve baixar ou importar apenas conteúdo para o qual tenha autorização. O aplicativo não deve contornar login, CAPTCHA, paywall ou DRM.

## Critérios de conclusão

- A instalação pode ser criada a partir do repositório público.
- A biblioteca original permanece somente leitura.
- Banco e downloads de uma instalação não são compartilhados com outras.
- O aplicativo funciona localmente em `localhost:3000`.
- Uma das opções remotas foi configurada e documentada.
- O celular acessa a instalação usando 4G ou 5G.
- A porta `3000` não está encaminhada publicamente no roteador.
- Uma pessoa não autorizada não consegue acessar a aplicação.
- Backup e restauração de `data/` foram testados.

## Entregáveis sugeridos

- Guia de instalação para Windows.
- Arquivo Compose opcional para Cloudflare.
- Checklist de Tailscale.
- Procedimento de atualização da instalação.
- Procedimento de backup e restauração de `data/`.
- Release versionada para usuários que não desejem clonar o código-fonte.
