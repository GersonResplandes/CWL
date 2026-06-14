# Contribuindo

Obrigado por querer melhorar a Central CWL. A ideia do projeto e ser simples de copiar, adaptar e evoluir sem prender o desenvolvedor a uma infraestrutura complicada.

## Como Comecar

1. Faca um fork do repositorio.
2. Crie uma branch com nome claro.
3. Instale as dependencias.
4. Copie `.env.example` para `.env`.
5. Rode o projeto localmente.

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

## Antes De Abrir Pull Request

Rode:

```powershell
npm test
npm run build
```

Confira tambem:

- A mudanca nao publica segredos.
- A mudanca nao quebra a arquitetura frontend -> backend -> Supercell API.
- A documentacao foi atualizada quando necessario.
- A mudanca respeita [SUPERCELL-COMPLIANCE.md](SUPERCELL-COMPLIANCE.md).

## Issues E Features

Use os templates de issue para:

- Relatar bugs.
- Sugerir uma feature.
- Propor nova regra de pontuacao.
- Pedir melhoria de tela, UX ou acessibilidade.

Ao pedir uma feature, explique o problema real do lider ou co-lider durante a CWL. Isso ajuda a manter o projeto focado.

## Padrao De Codigo

- Use TypeScript.
- Prefira funcoes pequenas e nomes diretos.
- Mantenha segredo e integracoes externas no servidor.
- Adicione testes para regras de negocio, pontuacao e sincronizacao quando a mudanca afetar comportamento.
- Evite refatoracoes grandes junto com ajustes pequenos de tela.

## Dados Reais

Nao inclua em issues, commits ou pull requests:

- Token da API da Supercell.
- Senhas ou hashes reais.
- Segredos do Apps Script.
- Cookies de sessao.
- Prints com dados privados que o cla nao queira expor.
