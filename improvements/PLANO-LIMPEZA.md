# Prompt de execução — "Organizar a casa" (Harmon IA)

> Cole este prompt numa sessão do **Claude Sonnet 5** dentro do projeto Harmon IA.
> Ele foi arquitetado no Opus. Tudo é reversível via git — mas siga a ordem.

---

## Contexto

CRM para saúde estética, web app **sem build** (HTML + CSS + JS vanilla),
Supabase e Google Calendar. Vamos fazer uma limpeza e reorganização do repositório.
Diagnóstico já feito: os arquivos abaixo **não são referenciados por nenhum HTML
ou JS** — são documentos de trabalho já executados. Confirme isso você mesmo antes
de apagar (Fase 3).

## Decisões já tomadas pelo dono

1. **Docs de trabalho concluídos → apagar de vez** (recuperáveis pelo git).
2. **`assets/img/hero-banner.png` (9,4M) → manter local** (é a fonte editável do
   `.webp`; já é gitignored, não pesa no git). NÃO apagar.
3. **Versionamento → semântico (v1.0.0)** no HISTORICO.

---

## Fase 0 — Checkpoint (obrigatório, primeiro)

```bash
git add -A && git commit -m "checkpoint: estado pré-limpeza"
```

Se houver algo não versionado importante, pare e avise antes de prosseguir.

## Fase 1 — Diagnóstico documentado

Liste e classifique cada arquivo do repositório em: `manter`, `consolidar-e-apagar`,
`apagar`. Apresente a tabela ao dono e **espere aprovação** antes da Fase 3.

Classificação de partida (confirme):

**Consolidar-e-apagar** (extrair resumo → HISTORICO, depois deletar):
- Pasta `improvements/` inteira (14 `.md`, 2 `.html`, 4 imagens incl. `visual.png` 1,4M)
- `PLANO.html`
- `PLANO-LANDING.md`
- `LAUNCH-LANDING.md`

**Manter:**
- `HISTORICO.md` (é o log/changelog canônico)
- `README.md`, `SETUP.md` (⚠️ verifique sobreposição entre os dois; se `SETUP.md`
  for redundante com o `README.md`, funda no README e apague o SETUP — senão mantenha)
- `CREDENCIAIS.md` (gitignored, local)
- Todo o código: `*.html` do app (index, app, entrar, planos, sobre), `api/`,
  `assets/`, `db/`, `.claude/`, `.agents/`, configs
- `pages/` está vazia → pode remover a pasta

## Fase 2 — Consolidar histórico no HISTORICO.md

Para cada arquivo de `improvements/` e cada plano concluído, extraia um resumo de
**2 a 4 linhas**: o que foi feito, data (use a data de modificação do arquivo ou a
citada no conteúdo), e o resultado. Anexe ao `HISTORICO.md` como as etapas que
faltam, mantendo a ordem cronológica e o estilo existente (`## Etapa N — título`).

No **topo** do `HISTORICO.md`, adicione:

1. Um bloco **Versão atual** (ex.: `**Versão atual:** v1.x.0`).
2. Uma **tabela de versões** mapeando as etapas existentes para versionamento
   semântico (v1.0.0 = fundação/primeira release funcional; MINOR para features,
   PATCH para correções). Deduza os saltos a partir do conteúdo de cada etapa.

Não invente fatos: se um arquivo não deixar claro o que foi feito, resuma
conservadoramente ou pergunte.

## Fase 3 — Limpeza (só após aprovação da Fase 1)

```bash
# apagar docs de trabalho concluídos
git rm -r improvements/
git rm PLANO.html PLANO-LANDING.md LAUNCH-LANDING.md
rmdir pages 2>/dev/null || true
```

NÃO apague `assets/img/hero-banner.png` (decisão do dono: manter local).

## Fase 4 — Verificação

1. Confirme que nenhum arquivo apagado era referenciado:
   ```bash
   grep -rniE 'improvements|PLANO\.html|PLANO-LANDING|LAUNCH-LANDING' \
     --include=*.html --include=*.js . || echo "OK: sem referências"
   ```
2. Abra `index.html` e `app.html` e cheque que carregam sem erro de asset faltando.
3. Meça o ganho: `du -sh .` antes/depois e reporte.
4. Gere o diff resumido (`git status` + `git diff --stat`) para o dono revisar
   **antes** de commitar a limpeza.
5. Commit final: `git commit -m "limpeza: consolida histórico em HISTORICO.md, remove docs de trabalho + versionamento vX.Y.Z"`

## Regras de segurança

- Nunca apague sem antes ter o resumo salvo no HISTORICO.
- Nunca toque em `assets/`, `db/`, `api/`, `*.js`, ou nos HTML do app.
- Em qualquer dúvida sobre se um arquivo é usado, **pergunte** em vez de apagar.
