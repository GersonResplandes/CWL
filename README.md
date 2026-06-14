# Central CWL

Central CWL e um painel open source para lideres e co-lideres de Clash of Clans acompanharem membros do cla, sincronizarem a Clan War League atual pela API oficial, registrarem historico em Google Sheets e analisarem desempenho de ataques, defesas e reservas.

> Este material e nao oficial e nao e endossado pela Supercell. Para mais informacoes, consulte a [Fan Content Policy da Supercell](https://supercell.com/en/fan-content-policy/).

## O Que O Projeto Faz

- Consulta membros do cla pela API oficial de Clash of Clans.
- Sincroniza a CWL ativa, incluindo grupo, rodadas, guerras, ataques, estrelas, destruicao, defesas e jogadores nao escalados.
- Salva historico em Google Sheets por meio de um Apps Script publicado como Web App.
- Mantem o token da Supercell e os segredos apenas no backend.
- Permite que qualquer desenvolvedor faca fork e adapte regras, telas, pontuacao e fluxo de implantacao.

## Arquitetura

```text
Frontend React/Vite -> Vercel
Backend Fastify     -> Render Web Service
Persistencia        -> Apps Script + Google Sheets
API oficial         -> Clash of Clans API
```

O projeto usa um unico repositorio e um unico `package.json`.

## Desenvolvimento Local

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

Enderecos locais:

```text
Frontend: http://localhost:5173
API:      http://localhost:3000
```

O Vite encaminha `/api` para o Fastify durante o desenvolvimento.

## Variaveis De Ambiente

Backend, usado na Render ou localmente:

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

Frontend, usado na Vercel:

```text
VITE_API_URL
```

Para gerar um hash de senha:

```powershell
npm run password -- "SUA SENHA"
```

Nunca publique `.env`, tokens da Supercell, segredos do Apps Script, hash real de senha ou cookies de sessao.

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

## Deploy

### Vercel

- Importe este repositorio.
- Build command: `npm run build:web`
- Output directory: `dist/web`
- Configure `VITE_API_URL` com a URL publica da API na Render.

### Render

O arquivo [render.yaml](render.yaml) cria o Web Service da API.

Configure:

- Token da Supercell.
- Tag autorizada do cla.
- Hash da senha.
- URL exata do frontend em `FRONTEND_ORIGIN`.
- URL e segredo do Apps Script.

Cadastre na chave da Supercell todas as faixas mostradas pela Render em **Connect > Outbound**.

### Google Sheets

As instrucoes ficam em [apps-script/README.md](apps-script/README.md).

O Apps Script cria:

- Uma planilha por ano.
- Uma aba para cada CWL.
- Abas mensais no formato `CWL_AAAA_MM`.

## Privacidade E Supercell

Leia:

- [PRIVACY.md](PRIVACY.md)
- [SUPERCELL-COMPLIANCE.md](SUPERCELL-COMPLIANCE.md)
- [SECURITY.md](SECURITY.md)

Cada pessoa que fizer fork ou publicar uma instancia propria deve revisar esses documentos, informar o responsavel pela implantacao e garantir que a propria configuracao respeita a [Fan Content Policy](https://supercell.com/en/fan-content-policy/), os [Termos de Servico](https://supercell.com/en/terms-of-service/) e a [Politica de Privacidade](https://supercell.com/en/privacy-policy/) da Supercell.

## Contribuindo

Issues, sugestoes e pull requests sao bem-vindos. Veja [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir uma mudanca.

Boas primeiras contribuicoes:

- Melhorar acessibilidade e responsividade.
- Criar novos cards para o dashboard.
- Escrever testes de regras de pontuacao.
- Melhorar documentacao de deploy.
- Propor integracoes opcionais sem expor segredos no frontend.

## Licenca

Distribuido sob a licenca MIT. Veja [LICENSE](LICENSE).
