# Politica De Seguranca

## Versoes Suportadas

O projeto acompanha a branch `main`. Como e um projeto open source em evolucao, forks e deploys proprios devem manter suas dependencias atualizadas.

## Como Reportar Vulnerabilidades

Nao abra issue publica para falhas de seguranca.

Use uma destas opcoes:

- GitHub Security Advisories do repositorio, quando habilitado.
- Contato privado informado pelo mantenedor do fork.

Inclua:

- Descricao da falha.
- Passos para reproduzir.
- Impacto esperado.
- Versao, commit ou URL afetada.

## Segredos

Considere sensivel:

- `COC_API_TOKEN`
- `APP_PASSWORD_HASH`
- `SESSION_SECRET`
- `APPS_SCRIPT_SECRET`
- Cookies de sessao
- URLs privadas de planilhas quando elas nao forem publicas

Se um segredo for publicado por engano:

1. Revogue ou troque o segredo imediatamente.
2. Remova o segredo do historico quando necessario.
3. Revise logs e deploys.
4. Publique um novo deploy com os valores corretos.

## Boas Praticas Para Deploy

- Restrinja CORS ao dominio real do frontend.
- Mantenha cookies de producao com `HttpOnly`, `Secure` e `SameSite=None`.
- Nunca exponha token da Supercell no frontend.
- Use uma chave da Supercell separada para cada deploy importante.
- Cadastre na Supercell somente os IPs de saida da hospedagem do backend.
