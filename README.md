# Manga Reader

Aplicação web privada para leitura de quadrinhos e mangás. Escaneia pastas locais ou de servidor, organiza a biblioteca e oferece um leitor fluido com progresso persistente.

## Funcionalidades

- Biblioteca com scan de CBZ, CBR, PDF e pastas de imagens
- Leitor fullscreen com zoom, modos de exibição e navegação por teclado/toque
- Progresso de leitura e histórico
- Favoritos, tags e busca
- Metadados via MyAnimeList e ComicVine (opcional)
- Catálogo MangaDex com filtros, seleção de idiomas e download de capítulos
- Importação por URL de leitores HTML/WordPress/Madara compatíveis
- Downloads retomáveis, modo de economia de dados e importação automática na biblioteca
- Modo escuro e direção de leitura LTR/RTL

## Privacidade

Esta aplicação **não possui autenticação**. Proteja o acesso mantendo-a apenas na rede local ou via VPN (Tailscale, WireGuard). Não exponha diretamente à internet pública.

## Requisitos

- Node.js 22+ (desenvolvimento)
- Docker e Docker Compose (produção)

## Desenvolvimento local

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

Acesse http://localhost:3000 — o frontend faz proxy da API para http://localhost:3001.

## Docker (recomendado)

1. Copie `.env.example` para `.env` e ajuste o caminho da biblioteca:

```bash
cp .env.example .env
```

2. Edite `.env`:

```env
LIBRARY_PATH=C:\Mangas
# ou no Linux: LIBRARY_PATH=/mnt/nas/comics
```

3. Inicie:

```bash
docker compose up -d --build
```

Acesse http://localhost:3000

## Primeiro uso

1. Abra **Configurações** e adicione os caminhos da biblioteca
2. Na **Biblioteca**, clique em **Reescanear**
3. Clique em uma série para ver capítulos e começar a ler

Para obter capítulos remotos, abra **Explorar**, pesquise no catálogo ou cole a URL de um leitor HTML compatível. Os arquivos são gravados em `data/downloads` e aparecem automaticamente na biblioteca ao final de cada capítulo.

Use somente conteúdo que você tem autorização para baixar. O aplicativo não contorna login, CAPTCHA, paywall ou DRM.

## Estrutura de pastas recomendada

```
Biblioteca/
├── One Piece/
│   ├── 001.cbz
│   ├── 002.cbz
│   └── ...
├── Berserk/
│   └── Vol 01/
│       ├── 001.png
│       └── ...
└── Spider-Man 001.cbr
```

Séries são agrupadas pela pasta de primeiro nível. Arquivos soltos na raiz viram séries individuais.

## Metadados (opcional)

- **MyAnimeList**: crie um app em https://myanimelist.net/apiconfig e configure o Client ID
- **ComicVine**: obtenha uma API key em https://comicvine.gamespot.com/api/

## Deploy em servidor (NAS/VPS)

Monte volumes no `docker-compose.yml`:

```yaml
volumes:
  - ./data:/app/data
  - /caminho/para/mangas:/library:ro
```

Configure os caminhos em Settings como `/library/NomeDaSerie`.

Para acesso remoto, use VPN — não abra a porta publicamente sem autenticação adicional.

## Formatos suportados

| Formato | Extensão |
|---------|----------|
| Comic Book ZIP | .cbz |
| Comic Book RAR | .cbr |
| PDF | .pdf |
| Pasta de imagens | .jpg, .png, .webp, .gif |

## Licença

Uso pessoal.
