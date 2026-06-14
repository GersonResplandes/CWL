# Politica De Privacidade

Ultima atualizacao: 14 de junho de 2026.

Esta politica explica como uma instalacao da Central CWL pode tratar dados. O projeto e open source; portanto, cada pessoa, cla ou organizacao que publicar sua propria instancia e responsavel por revisar este texto, informar seus dados de contato e cumprir as leis aplicaveis.

## Aviso Sobre A Supercell

Este projeto usa dados obtidos pela API oficial de Clash of Clans, mas nao e afiliado, patrocinado, aprovado ou endossado pela Supercell. O uso de dados, nomes, marcas, imagens ou assets relacionados aos jogos deve respeitar a [Fan Content Policy](https://supercell.com/en/fan-content-policy/), os [Termos de Servico](https://supercell.com/en/terms-of-service/) e a [Politica de Privacidade](https://supercell.com/en/privacy-policy/) da Supercell.

## Dados Que O Sistema Pode Processar

A Central CWL pode processar:

- Tag do cla configurado para a instalacao.
- Nome, tag, CV, patente, liga, trofeus, doacoes, conquistas, herois, tropas e dados publicos retornados pela API oficial.
- Dados da CWL ativa retornados pela API: rodadas, guerras, participantes, ataques, defesas, estrelas, destruicao e estado das guerras.
- Ajustes manuais feitos pelo lider, quando a instalacao permitir isso.
- Historico salvo no Google Sheets configurado pelo operador da instalacao.
- Cookie de sessao usado para manter o login administrativo.
- Logs tecnicos do servidor, como rota acessada, status da resposta e horario.

O sistema nao deve solicitar senha da conta Supercell ID, email pessoal do jogador, codigo de verificacao, credenciais do jogo ou qualquer dado necessario para assumir uma conta.

## Finalidade Do Uso

Os dados sao usados para:

- Exibir o elenco atual do cla.
- Sincronizar e analisar a CWL ativa.
- Guardar historico operacional da CWL em Google Sheets.
- Apoiar decisoes de lideranca, desempenho e organizacao interna do cla.
- Proteger o acesso administrativo do painel.

## Onde Os Dados Ficam

A arquitetura padrao usa:

- Frontend na Vercel.
- Backend na Render.
- Historico no Google Sheets por Apps Script.
- API oficial de Clash of Clans como fonte de dados do jogo.

O backend nao deve gravar banco de dados permanente por padrao. O historico operacional fica na planilha conectada pelo Apps Script. Dados temporarios tambem podem existir no navegador e nos logs da hospedagem.

## Compartilhamento Com Terceiros

Dependendo da implantacao, dados podem passar por:

- Supercell, como provedora da API oficial.
- Google, por Google Sheets e Apps Script.
- Render, como hospedagem do backend.
- Vercel, como hospedagem do frontend.
- GitHub, quando issues, pull requests ou discussoes forem abertos publicamente.

Nao vendemos dados, nao usamos dados para publicidade e nao compartilhamos dados para perfilamento comercial.

## Cookies E Sessao

O sistema usa cookie de sessao para autenticar o acesso administrativo. Em producao, a configuracao esperada e `HttpOnly`, `Secure` e `SameSite=None`, para reduzir risco de acesso indevido pelo navegador.

O botao de sair deve encerrar a sessao no servidor e limpar cookies locais relacionados ao sistema.

## Retencao E Exclusao

Como projeto open source, a retencao depende da instancia publicada:

- Historico em Google Sheets permanece ate o operador apagar linhas, abas ou planilhas.
- Logs seguem as regras da hospedagem usada.
- Dados no navegador podem ser apagados limpando dados do site.

O operador da instalacao deve oferecer um meio de contato para pedidos de correcao ou exclusao quando a instancia for usada por terceiros.

## Seguranca

Segredos devem ficar somente no backend ou nas propriedades protegidas do Apps Script:

- `COC_API_TOKEN`
- `APP_PASSWORD_HASH`
- `SESSION_SECRET`
- `APPS_SCRIPT_SECRET`

Nunca coloque esses valores no frontend, no GitHub, em prints publicos, em issues ou em pull requests.

## Menores De Idade

Este projeto e uma ferramenta administrativa para lideranca de clas. Evite registrar dados pessoais em campos manuais, especialmente informacoes sobre idade, identidade real, contato privado, escola, endereco ou qualquer detalhe sensivel de jogadores.

## Contato

Quem publicar uma instancia propria deve preencher:

```text
Responsavel:
Email de contato:
URL da instancia:
URL do repositorio/fork:
```

Para vulnerabilidades de seguranca no codigo aberto, siga [SECURITY.md](SECURITY.md).
