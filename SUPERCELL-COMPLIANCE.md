# Conformidade Com Supercell

Este documento resume as regras praticas que o projeto deve seguir ao usar dados, nomes e contexto de Clash of Clans. Ele nao substitui aconselhamento juridico nem os documentos oficiais da Supercell.

Fontes oficiais:

- [Supercell Fan Content Policy](https://supercell.com/en/fan-content-policy/)
- [Supercell Terms of Service](https://supercell.com/en/terms-of-service/)
- [Supercell Privacy Policy](https://supercell.com/en/privacy-policy/)
- [Clash of Clans API](https://developer.clashofclans.com/)

## Aviso Obrigatorio

Quando o projeto usar assets, nomes ou contexto de Clash of Clans, mantenha um aviso visivel no README, na politica de privacidade e, quando fizer sentido, na propria interface:

```text
Este material e nao oficial e nao e endossado pela Supercell. Para mais informacoes, consulte a Fan Content Policy da Supercell: https://supercell.com/en/fan-content-policy/
```

## O Que O Projeto Pode Fazer

- Consumir a API oficial usando uma chave valida e privada.
- Exibir informacoes publicas de clas, jogadores e CWL retornadas pela API.
- Criar calculos, rankings e telas proprias sobre dados da CWL.
- Permitir forks e personalizacoes desde que cada instancia respeite as politicas aplicaveis.

## O Que O Projeto Nao Deve Fazer

- Fingir ser oficial, parceiro, afiliado ou aprovado pela Supercell.
- Solicitar credenciais da conta Supercell ID.
- Expor token da API no frontend.
- Publicar token, segredo de sessao, senha, hash real ou segredo do Apps Script no GitHub.
- Promover venda de contas, trapaças, bots, automacao nao autorizada, servidores privados ou vazamentos.
- Usar marcas, nomes, dominios, redes sociais ou logos de forma que pareca propriedade oficial da Supercell.
- Distribuir assets oficiais fora das condicoes permitidas pela Fan Content Policy.

## Regras Para Forks

Quem fizer fork deve:

- Criar sua propria chave da API no portal oficial.
- Configurar seu proprio IP permitido no token da API.
- Usar sua propria planilha e seu proprio Apps Script.
- Atualizar `PRIVACY.md` com o responsavel pela instancia.
- Revisar textos, imagens e dominio para nao sugerir endosso oficial.
- Remover dados reais antes de abrir issue, PR ou print publico.

## API Da Supercell

O token da API deve ser tratado como segredo. A arquitetura recomendada e:

```text
Navegador -> Backend proprio -> Clash of Clans API
```

O navegador nunca deve chamar a API da Supercell diretamente com o token do projeto.

## Dados De Jogadores

Mesmo quando a API retorna dados publicos do jogo, trate os dados com cuidado:

- Use apenas o necessario para a CWL.
- Evite comentarios pessoais nos ajustes manuais.
- Nao misture dados do jogo com dados reais de identidade.
- Dê ao operador uma forma simples de apagar historico da planilha.

## Revisao Antes De Publicar

Antes de publicar uma instancia:

- Confirme que `.env` nao foi commitado.
- Rode uma busca por tokens e segredos no repositorio.
- Verifique se o aviso de nao oficialidade aparece na documentacao.
- Revise imagens e textos da interface.
- Teste logout, cookies e configuracao de CORS.
