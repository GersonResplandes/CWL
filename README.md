# Central CWL

Sistema para consulta dos membros do clã, sincronização oficial, pontuação e histórico da Clan War League.

## Arquitetura

```text
Frontend React/Vite -> Vercel
Backend Fastify     -> Render Web Service
Persistência        -> Apps Script + Google Sheets
```

O projeto usa um único repositório e um único `package.json`.

## Desenvolvimento local

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Endereços:

```text
Frontend: http://localhost:5173
API:      http://localhost:3000
```

O Vite encaminha `/api` para o Fastify durante o desenvolvimento.

## Variáveis do backend

```text
COC_API_TOKEN
ALLOWED_CLAN_TAG
APP_PASSWORD_HASH
SESSION_SECRET
FRONTEND_ORIGIN
APPS_SCRIPT_URL
APPS_SCRIPT_SECRET
PORT
```

Para gerar um hash de senha:

```powershell
npm run password -- "SUA SENHA"
```

## Comandos

```text
npm run dev         frontend e backend
npm run dev:web     somente Vite
npm run dev:api     somente Fastify
npm run build       builds completos
npm run build:web   build da Vercel
npm run build:api   build da Render
npm test            testes automatizados
```

## Vercel

- Importe o mesmo repositório.
- Build command: `npm run build:web`
- Output directory: `dist/web`
- Configure `VITE_API_URL` com a URL pública da Render.

## Render

O arquivo `render.yaml` cria o Web Service da API.

Configure:

- Token da Supercell.
- Tag autorizada.
- Hash da senha.
- URL exata do frontend em `FRONTEND_ORIGIN`.
- URL e segredo do Apps Script.

Cadastre na chave da Supercell todas as faixas mostradas pela Render em **Connect > Outbound**.

## Google Sheets

As instruções ficam em [apps-script/README.md](apps-script/README.md).

O Apps Script cria:

- Uma planilha por ano.
- Uma aba para cada CWL.
- Abas mensais no formato `CWL_AAAA_MM`.

## Segurança

- O token da Supercell existe somente na Render.
- O segredo do Apps Script existe somente na Render e no `PropertiesService`.
- O frontend nunca recebe segredos.
- Cookies de produção usam `Secure`, `HttpOnly` e `SameSite=None`.
