# Fase 2 — Biblioteca privada compartilhada

## Objetivo

Criar uma instalação central do Chernobyl Vault na qual o proprietário e pessoas convidadas possam acessar uma biblioteca privada, adicionar novos títulos e manter dados de leitura individuais.

Esta fase é diferente da instalação pessoal: várias pessoas usarão o mesmo servidor e o aplicativo deverá reconhecer e autorizar cada usuário.

```text
Proprietário --+
Editor --------+--> biblioteca compartilhada
Leitor --------+
```

## Dependência da fase anterior

A distribuição monousuário continuará disponível. A biblioteca compartilhada será um modo adicional de implantação e não deve obrigar usuários individuais a criar contas internas.

## Escopo

- Autenticação individual.
- Convites controlados pelo proprietário.
- Biblioteca compartilhada por associação de membros.
- Papéis e permissões.
- Progresso, histórico e favoritos por usuário.
- Pesquisa e solicitação de novos títulos.
- Downloads vinculados à biblioteca e ao solicitante.
- Limites, auditoria e administração.

## Modelo de autorização

### Papéis

| Papel | Ler | Adicionar títulos | Cancelar próprio download | Remover títulos | Gerenciar membros |
|---|---:|---:|---:|---:|---:|
| Proprietário | Sim | Sim | Sim | Sim | Sim |
| Editor | Sim | Sim | Sim | Não por padrão | Não |
| Leitor | Sim | Não | Não | Não | Não |

O proprietário mantém controle exclusivo sobre membros, configurações globais, caminhos, cotas e exclusões definitivas.

## Modelo de dados proposto

### Identidade e bibliotecas

```text
users
- id
- external_subject
- email
- display_name
- system_role
- created_at

libraries
- id
- name
- kind: personal | shared
- owner_user_id
- created_at

library_members
- library_id
- user_id
- role: owner | editor | viewer
- joined_at
```

### Conteúdo

Cada série pertence a uma biblioteca:

```text
series
- library_id
```

Os capítulos continuam relacionados à série. O caminho físico nunca deve ser retornado ao navegador.

### Dados pessoais de leitura

```text
reading_progress
- user_id
- chapter_id
- page
- updated_at

favorites
- user_id
- series_id
- created_at

history
- user_id
- chapter_id
- page
- read_at
```

As restrições únicas devem considerar o usuário, como `(user_id, chapter_id)` e `(user_id, series_id)`.

### Auditoria e convites

```text
invitations
- id
- library_id
- email
- role
- token_hash
- expires_at
- accepted_at
- invited_by_user_id

audit_events
- id
- library_id
- actor_user_id
- action
- target_type
- target_id
- created_at
```

Tokens de convite devem ser armazenados somente como hash e possuir validade curta.

## Autenticação

Cloudflare Access pode continuar protegendo o domínio, mas o backend também precisa reconhecer a identidade e aplicar autorização por usuário.

O backend deve:

1. Validar criptograficamente o token de identidade recebido.
2. Conferir emissor, audiência, assinatura e validade.
3. Associar o identificador externo a um registro em `users`.
4. Carregar as bibliotecas das quais o usuário é membro.
5. Aplicar autorização em cada recurso solicitado.

Não se deve confiar apenas em um cabeçalho de e-mail. A origem precisa permanecer inacessível fora do túnel.

## Migração do banco existente

A migração deve ser compatível com instalações existentes:

1. Criar o usuário proprietário.
2. Criar uma biblioteca pertencente a ele.
3. Associar todas as séries atuais a essa biblioteca.
4. Associar progresso, favoritos e histórico atuais ao proprietário.
5. Preservar IDs, caminhos e arquivos existentes.
6. Executar as mudanças dentro de transações.
7. Registrar a versão da migração.
8. Manter backup restaurável antes da atualização.

`CREATE TABLE IF NOT EXISTS` isoladamente não é suficiente para alterar as tabelas atuais.

## Isolamento no backend

Toda rota deve derivar o usuário da sessão validada. IDs fornecidos pelo navegador são dados não confiáveis.

As verificações devem cobrir:

- listagem e pesquisa da biblioteca;
- detalhes, capas e metadados;
- capítulos, páginas, imagens e PDFs;
- favoritos, histórico e progresso;
- tags e configurações;
- scanner e caminhos locais;
- pesquisa remota;
- criação, acompanhamento e cancelamento de downloads;
- convites e membros.

Uma pessoa não pode acessar conteúdo de outra biblioteca alterando um ID ou URL.

## Fluxo para adicionar títulos

1. Proprietário ou editor seleciona a biblioteca compartilhada.
2. Pesquisa um título no catálogo ou informa uma URL compatível.
3. Seleciona idioma e capítulos.
4. O sistema mostra origem, destino e tamanho estimado quando disponível.
5. O usuário confirma a solicitação.
6. O servidor cria um trabalho associado ao usuário e à biblioteca.
7. O download ocorre em um diretório controlado pelo servidor.
8. Após validação, o scanner importa o conteúdo para a biblioteca correta.
9. Todos os membros passam a enxergar o título.
10. O evento é registrado na auditoria.

## Armazenamento

Estrutura sugerida para dados gerenciados pelo aplicativo:

```text
data/
|-- chernobyl-vault.db
|-- libraries/
|   |-- shared-1/
|   `-- personal-1/
|-- cache/
`-- downloads/
    |-- shared-1/
    `-- personal-1/
```

Bibliotecas externas continuam montadas como somente leitura. Usuários remotos nunca escolhem caminhos absolutos no servidor.

## Limites operacionais

- Cota máxima de armazenamento por biblioteca.
- Limite de downloads ativos por usuário e por servidor.
- Limite de capítulos por solicitação.
- Detecção de títulos e capítulos duplicados.
- Cancelamento pelo solicitante ou proprietário.
- Falhas isoladas sem corromper trabalhos concluídos.
- Arquivos temporários com gravação atômica.
- Retenção controlada de logs, sem caminhos privados ou segredos.

## Interface prevista

- Tela de entrada e estado da sessão.
- Seletor de biblioteca.
- Página de membros e convites para o proprietário.
- Identificação visual do papel atual.
- Fila de downloads com nome do solicitante.
- Histórico de adições e falhas.
- Configurações administrativas separadas das preferências pessoais.
- Mensagens claras quando uma ação não for permitida.

## Etapas de implementação

1. Definir identidade, sessão e modelo de ameaças.
2. Criar migrações de usuários, bibliotecas e membros.
3. Migrar os dados existentes para o proprietário.
4. Aplicar autorização a todas as rotas e arquivos.
5. Separar progresso, histórico e favoritos por usuário.
6. Implementar seletor de biblioteca.
7. Implementar papéis e convites.
8. Tornar downloads e scanner conscientes da biblioteca.
9. Adicionar cotas e auditoria.
10. Executar testes de isolamento e implantação remota.

## Critérios de conclusão

- Somente convidados conseguem entrar.
- Cada membro possui uma identidade individual.
- Progresso, histórico e favoritos não se misturam.
- Leitores não conseguem iniciar downloads ou alterar configurações.
- Editores conseguem adicionar títulos apenas às bibliotecas autorizadas.
- Somente o proprietário gerencia membros e exclusões definitivas.
- Alterar IDs nas URLs não permite acesso a outra biblioteca.
- Downloads são atribuídos ao solicitante e aparecem na biblioteca correta.
- Arquivos originais permanecem somente leitura.
- Migrações preservam instalações existentes e podem ser restauradas por backup.
- Testes de backend, frontend, build, schema e container são aprovados.

## Riscos a resolver antes da implantação

- Autorização incompleta em rotas de imagens ou arquivos.
- Confiança indevida em cabeçalhos de proxy.
- Exposição direta da origem fora do túnel.
- Downloads consumindo todo o disco.
- Um scanner removendo registros de uma biblioteca indisponível.
- Vazamento de caminhos locais em respostas ou logs.
- Convites reutilizáveis ou sem expiração.
- Operações administrativas disponíveis para editores ou leitores.
