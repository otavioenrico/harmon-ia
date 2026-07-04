# Spec — Padrão de listas: ações por linha + modo seleção + arquivar serviço

**Data:** 04/07/2026
**Contexto:** Harmon IA (HTML+CSS+JS vanilla, Supabase). Sem build.
**Escopo:** unificar a interação das listas. Cada linha ganha ações inline
(lápis = editar, lixeira = excluir); a seleção em massa deixa de ter checkbox
fixo e vira um "modo seleção" acionado por um botão no topo. Serviço passa a poder
ser "excluído" via arquivamento que preserva o histórico.

Módulos afetados: **Clientes, Serviços, Estoque, Histórico**. (Fluxo de Caixa já
tem checkboxes e o lápis; alinhar ao mesmo modo é opcional/futuro.)

---

## A. Padrão de dois modos (todas as listas)

### Modo normal (padrão)
- Sem checkbox no começo da linha.
- No fim de cada linha, ações inline: **lápis** (editar) e **lixeira** (excluir).
- Ícones padronizados: `icon('edit')` / `icon('trash')`, classe
  `btn btn--icon btn--ghost btn--sm`, com `title` e `aria-label`.

### Modo seleção
- Botão **"Selecionar"** na toolbar superior de cada módulo.
- Ao ativar: aparecem os **checkboxes** por linha, as **ações inline somem**, e
  **clicar na linha marca/desmarca**. A barra do topo mostra
  **"Excluir (N)"**, **"Selecionar todos"** e **"Cancelar"**.
- Reaproveita a lógica de bulk existente (`bulkBar`, `state.selected`, RPCs de
  exclusão em massa). O que muda é que ela fica **atrás do modo**, não sempre visível.
- Sair do modo (Cancelar ou após excluir) limpa `state.selected` e volta ao normal.

---

## B. Lápis (editar) — por módulo
- **Clientes** (`clientes.js`): clique na linha continua abrindo o **perfil**
  (`openProfile`); o **lápis** abre `openForm(ctx, c, load)` direto.
- **Serviços** (`servicos.js`): a linha **deixa de abrir a edição**; só o **lápis**
  edita (`openForm(ctx, service, load)`). Remover `clickable` da `<tr>` e o onclick
  de linha.
- **Estoque** (`estoque.js`): clique na linha continua abrindo o **drawer** do item
  (`openItem`); o **lápis** abre `openForm(ctx, it, load)` direto.
- **Histórico** (`historico.js`): hoje **não há edição** de registro. O lápis abre
  um **formulário de edição de procedimento** — ver Parte E (mais pesada).

Em Clientes/Estoque, tratar o clique no lápis **antes** da lógica da linha (checar
`e.target.closest('[data-edit-row]')` e `return`), pra não abrir perfil/drawer.

---

## C. Lixeira (excluir) — por módulo
Sempre com **diálogo de confirmação** (destrutivo), reusando o que já existe:
- **Clientes**: exclusão já existe (no perfil, `[data-del]`). Reusar a mesma RPC/fluxo.
- **Estoque**: exclusão já existe (confirm que avisa sobre fotos/movimentações).
- **Histórico**: `delete_procedures([id])` (confirm sobre lançamentos ligados e
  estoque não devolvido — já existe no bulk).
- **Serviços**: **arquivar** (ver Parte D) — serviço não é apagado de verdade.

No **modo seleção**, o "Excluir (N)" aplica a mesma ação do módulo a todos os
selecionados (delete em massa onde existe; arquivar em massa em Serviços).

---

## D. Arquivar serviço (novo)

### Objetivo
Permitir "excluir" um serviço: ele **some de toda a interface de serviços** (lista
e filtros Ativos/Inativos/Todos), mas os **procedimentos já feitos continuam
mostrando o serviço** (nome e cor) no histórico. Ex.: a profissional para de
oferecer harmonização facial, remove-a da lista, e os atendimentos passados seguem
registrados com "harmonização facial".

### Implementação
- **Schema (migração + `db/schema.sql`)**: adicionar `archived boolean not null
  default false` em `public.services` (ou `archived_at timestamptz`).
- **`servicos.js`**: todas as consultas da lista filtram `archived = false`; o
  serviço arquivado não aparece em nenhum filtro (nem "Inativos").
- **Selects de serviço para seleção** em `agenda.js` (~l.102, hoje `.eq('active',
  true)`) e `historico.js` (form): também excluir `archived = true`.
- **Leitura de histórico preservada**: telas que mostram o nome via **JOIN**
  (`procedures ... services(name,color)` em `historico.js`) continuam resolvendo o
  serviço arquivado, porque o JOIN não filtra por `archived` e a linha do serviço
  **continua existindo** (só escondida da UI de serviços). Nome e cor ficam intactos.
- **Ação da lixeira em Serviços**: `update services set archived = true` + confirm:
  "Excluir serviço? Ele sai da lista; procedimentos já feitos continuam no histórico
  com o serviço."
- **Simplicidade**: sempre arquivar (não hard-delete). O registro fica no banco só
  para o histórico resolver — invisível para a pessoa.

> Observação: o chip de cor no calendário (`agenda.js`) usa `state.services`
> (filtrado `active=true`), então serviço arquivado/inativo já não colore lá — mesma
> limitação de hoje para inativos. O nome no Histórico (via JOIN) fica preservado.

---

## E. Editar registro no Histórico (parte mais pesada — prompt à parte)
Hoje `historico.js` só cria (`register_procedure`) e conclui; não edita registros.
O lápis precisa de um **formulário de edição de procedimento** que:
- Pré-preenche a partir do registro (cliente, serviço, data, preço, materiais,
  forma, parcelas).
- No submit, chama a RPC certa por **status**: `update_completed_procedure`
  (realizado) ou `update_scheduled_procedure` (agendado). Cancelado não edita.
- Se o registro tiver `google_event_id`, refletir mudanças no evento (opcional).
Fazer com prompt e teste dedicados, como foi feito na Agenda.

---

## Verificação
- Lista em modo normal: sem checkbox; lápis e lixeira por linha funcionando.
- "Selecionar" no topo entra no modo: checkboxes aparecem, ações inline somem,
  clicar na linha marca; "Excluir (N)" apaga os selecionados; "Cancelar" volta.
- Clientes/Estoque: clique na linha abre perfil/drawer; lápis abre edição direta.
- Serviços: linha não edita; lápis edita; lixeira **arquiva** (some da lista e dos
  filtros), e um procedimento antigo daquele serviço **ainda mostra nome e cor** no
  Histórico.
- Excluir item único pede confirmação em todos os módulos.
- Histórico (parte E): lápis abre edição e salva pela RPC certa por status.
