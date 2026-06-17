# Configuração do Apps Script

1. Crie um projeto em [script.google.com](https://script.google.com/).
2. Copie `Code.gs` e `Spreadsheet.gs` para o projeto.
3. Em **Configurações do projeto > Propriedades do script**, crie:

```text
APPS_SCRIPT_SECRET=um-segredo-longo-e-aleatorio
```

4. Execute manualmente no editor:

```javascript
setupYear(2026)
```

Isso cria as abas mensais base:

```text
CWL_2026_01
CWL_2026_02
...
CWL_2026_12
```

Quando a Supercell retornar uma temporada com dia, como na CWL extra de junho de 2026, o sistema cria a aba sob demanda:

```text
CWL_2026_06_16
```

5. Autorize o acesso ao Google Sheets.
6. Publique como **Aplicativo da Web**:
   - Executar como: você.
   - Quem pode acessar: qualquer pessoa.
7. Copie a URL `/exec` para `APPS_SCRIPT_URL` na Render.
8. Use o mesmo segredo em `APPS_SCRIPT_SECRET` na Render.

O acesso público ao Web App não expõe a planilha. As operações exigem o segredo compartilhado.
