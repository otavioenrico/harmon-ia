# Plano de lote 2 — Aprimoramentos do app (rodar com Sonnet 5)

> **Como usar:** cole este arquivo inteiro como prompt no terminal (Claude Code,
> modelo Sonnet 5), na raiz do projeto Harmon IA. São 5 itens independentes;
> podem ser aplicados de uma vez. Ao final, rode a verificação de cada um.
> Stack: HTML + CSS + JS vanilla (sem build), Supabase, Google Calendar.
> Idioma do código/comentários: PT-BR. Não introduzir framework nem etapa de build.

---

## Item 1 — Comprimir/redimensionar foto do produto antes do upload

**Arquivo:** `assets/js/estoque.js`

**Objetivo:** ao anexar foto no cadastro de produto, gerar automaticamente um
thumbnail **80×80 px, quadrado, WebP (qualidade ~0.8)** e subir só ele ao bucket
`uploads` do Supabase — nunca o original. Isso reduz o peso no Storage.

**Regras de imagem:**
- Saída sempre **80×80 quadrado**.
- Imagem retangular → **encaixar inteira (contain)** centralizada e **preencher
  as sobras com branco** (`#ffffff`). Não recortar (nada de cover).
- Formato `image/webp`, qualidade `0.8`.
- Aplicar **somente** ao campo `name="photo"` (`accept="image/*"`). O campo
  `name="nf"` (nota fiscal) pode ser PDF — **não mexer nele**.

**Implementação:**
1. Criar helper (topo do arquivo ou perto de `uploadFile`):

   ```js
   // gera thumbnail 80x80 webp, contain + fundo branco, a partir de um File de imagem
   async function compressPhoto(file) {
     if (!file || !file.type.startsWith('image/')) return file;
     const bmp = await createImageBitmap(file);
     const S = 80;
     const canvas = document.createElement('canvas');
     canvas.width = S; canvas.height = S;
     const cx = canvas.getContext('2d');
     cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, S, S);
     const scale = Math.min(S / bmp.width, S / bmp.height); // contain
     const w = bmp.width * scale, h = bmp.height * scale;
     cx.drawImage(bmp, (S - w) / 2, (S - h) / 2, w, h);
     bmp.close?.();
     const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.8));
     if (!blob) return file; // fallback: se o browser falhar no webp, sobe o original
     return new File([blob], (file.name.replace(/\.[^.]+$/, '') || 'foto') + '.webp',
       { type: 'image/webp' });
   }
   ```

2. No `form.onsubmit`, antes do upload da foto, trocar o File pelo comprimido.
   Hoje (linha ~445 e ~458):

   ```js
   const photo = form.querySelector('[name="photo"]').files[0];
   ...
   if (photo) { payload.photo_url = await uploadFile(uid, photo); uploaded.push(payload.photo_url); }
   ```

   Passar a:

   ```js
   let photo = form.querySelector('[name="photo"]').files[0];
   if (photo) photo = await compressPhoto(photo);
   ...
   if (photo) { payload.photo_url = await uploadFile(uid, photo); uploaded.push(payload.photo_url); }
   ```

**Verificação:**
- Cadastrar produto com JPG/PNG grande e com um retângulo → confere no bucket que
  o arquivo salvo é `.webp`, ~80×80, poucos KB, com faixas brancas nos lados.
- NF em PDF continua subindo normal.
- Sem erro no console; rollback de upload órfão segue funcionando.

---

## Item 2 — Toggle Receita/Despesa: hug, não esticado

**Arquivo:** `assets/css/components.css`

**Sintoma:** no "Novo lançamento" (Fluxo de caixa), o segmented control
Receita/Despesa ocupa a largura toda em vez de encolher ao conteúdo.

**Causa raiz:** `.segmented` é `display:inline-flex`, mas fica dentro de `.field`
(que é `display:flex; flex-direction:column`, logo `align-items:stretch` por
padrão). No eixo cruzado de uma coluna flex, o filho é esticado à largura total.

**Correção:** adicionar `align-self: flex-start;` (ou equivalente) à `.segmented`
para que hug em pais column-flex, sem afetar as barras de abas (que ficam em
containers row e continuam com `overflow-x:auto`).

```css
.segmented {
  display: inline-flex; align-self: flex-start; max-width: 100%; gap: 2px; padding: 3px;
  background: var(--surface-2); border-radius: var(--radius-pill);
  overflow-x: auto; scrollbar-width: none;
}
```

**Verificação:**
- "Novo lançamento": toggle encolhe ao tamanho de "Receita | Despesa".
- Continuam OK: abas do Fluxo de Caixa (topo), filtro de Serviços (Ativos/Inativos/Todos),
  toggles de período da Agenda (Mês/Semana/Dia) e o scroll das 5 abas no mobile.

---

## Item 3 — Botões da hero (Home): faixa com scroll horizontal + fade nas bordas

**Arquivos:** `assets/css/components.css` (e `assets/js/home.js` se adotar drag)

**Sintoma:** em telas médias, `.hero__actions` (`+ Cliente`, `+ Produto`,
`+ Lançamento`, etc.) estão em `flex-wrap:nowrap` e **vazam para fora do card**.

**Comportamento desejado:** os botões viram uma **faixa contida no card, com
scroll horizontal**, **fade de baixa opacidade nas bordas** indicando que há mais
ao lado, navegável por scroll lateral e por **clicar-e-arrastar**. Nunca podem
sair do bloco.

**Reaproveitar:** já existe padrão pronto e aprovado — o item **2 do
`APRIMORAMENTOS-PENDENTES.md`** ("Carrossel de segmentos: fade de opacidade nas
bordas", status concluído). Use a MESMA técnica de fade (`mask-image` com
gradiente) e o mesmo handler de drag da landing, para consistência.

**Implementação (referência):**
- `.hero__actions`: `flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none;`
  e esconder scrollbar webkit. Botões: `flex: 0 0 auto;` (não encolher).
- Fade nas bordas com `mask-image: linear-gradient(90deg, transparent 0, #000 16px,
  #000 calc(100% - 16px), transparent 100%)` — aplicando o fade só quando há
  overflow (mesma lógica do carrossel de segmentos).
- Drag opcional em `home.js`: reutilizar o mesmo listener de pointer-drag do
  carrossel da landing.
- **Revisar** o override mobile atual (`@media (max-width:600px) .hero__actions
  { display:grid; grid-template-columns:1fr 1fr; }`, linhas ~504-509): a
  referência do Otávio é a **faixa em linha única com fade**, então a faixa com
  scroll passa a ser o padrão. Manter o grid 2×2 só se ficar melhor em telas bem
  estreitas (≤480px) — senão, remover para não conflitar.

**Verificação:**
- Reduzir a largura da janela até faltar espaço → botões ficam DENTRO do card,
  com fade na direita e scroll/drag revelando os demais. Nada vaza do bloco.
- Testar em 1200px, 900px, 600px e 375px.

---

## Item 4 — Cores do serviço: paleta ampliada (estilo Google), sem Hex

**Arquivos:** `assets/js/servicos.js` (principal). Referência de accent:
`assets/js/configuracoes.js` (`ACCENTS`) e `assets/css/accent.css`.

**Objetivo:**
- **Remover** o campo Hex (`#sw-hex`) do color picker do serviço.
- Substituir o array `COLORS` (hoje 8 tons) por uma **paleta fixa de ~24 cores
  inspirada no Google Calendar, com leve ajuste de tom** (não idêntica ao Google).
  Organizar em 3 linhas (quentes / verdes-azuis / neutros-frios), como na
  referência que o Otávio enviou.
- **Cor padrão ao criar um serviço novo = a cor de destaque (accent) que a pessoa
  usa no app.** Ao editar, usar `svc.color`.

**Implementação:**
1. Trocar a constante:

   ```js
   // paleta inspirada no Google Calendar, com tons levemente ajustados (não idênticos)
   const PALETTE = [ /* ~24 hexes em 3 linhas: quentes, verdes/azuis, neutros/frios */ ];
   ```

2. Descobrir o accent atual (hex). O accent é um id (`rose/sand/sky/lilac/mint/
   neutral`) em `ctx.settings.accent`; o hex tom-500 vem do CSS. Ler direto:

   ```js
   const accentHex = getComputedStyle(document.documentElement)
     .getPropertyValue('--accent').trim() || PALETTE[0];
   const color = svc?.color || accentHex; // default = accent do app
   ```

3. Render dos swatches SEM o input hex. Garantir que o `color` default sempre
   apareça selecionado: se `color` não estiver exatamente na `PALETTE`,
   **prepender** esse hex como primeiro swatch (rotulado "Padrão") para ser
   selecionável e já selecionado.

   ```js
   const swatches = PALETTE.includes(color) ? PALETTE : [color, ...PALETTE];
   // ...
   <div class="swatches" id="sw">
     ${swatches.map((c) => `<span class="swatch ${c === color ? 'selected' : ''}"
        data-c="${c}" style="background:${c}" role="button" aria-label="${c}"></span>`).join('')}
   </div>
   ```

4. No handler do `#sw`, remover as referências a `hex`/`#sw-hex`. Manter só a
   seleção do swatch (`chosen = s.dataset.c`). No submit, `color: chosen` fica igual.

**Verificação:**
- Novo serviço abre com o swatch da cor de destaque já selecionado.
- Paleta mostra ~24 cores; não há mais campo Hex.
- Editar serviço mantém a cor salva selecionada. Salvar persiste em `services.color`.

---

## Item 5 — Calendário: evento herda a cor do serviço + texto preto/branco por contraste

**Arquivos:** `assets/js/agenda.js` (principal), `assets/js/utils.js` (helper de
contraste), `assets/css/components.css` (ajuste do `.ag-chip`).

**Objetivo:** no calendário (mês e lista), cada agendamento aparece com a **cor do
serviço** correspondente (ex.: retorno azul → bloco azul). A **cor do texto** é
automaticamente **preto ou branco**, a que mais contrasta com o fundo (luminância).
Eventos do Google sem procedimento vinculado mantêm o `--accent` atual.

**Implementação:**
1. `utils.js` — helper de contraste (exportar):

   ```js
   // retorna '#000' ou '#fff', o que mais contrasta com a cor de fundo (hex #rgb/#rrggbb)
   export function textOn(bg) {
     const h = (bg || '').replace('#', '');
     const f = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
     const r = parseInt(f.slice(0,2),16)/255, g = parseInt(f.slice(2,4),16)/255, b = parseInt(f.slice(4,6),16)/255;
     const lin = (c) => (c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4));
     const L = 0.2126*lin(r) + 0.7152*lin(g) + 0.0722*lin(b);
     return L > 0.5 ? '#000' : '#fff';
   }
   ```

2. `agenda.js` — trazer a cor do serviço no load (linha ~99):

   ```js
   supabase.from('services').select('id,name,duration_min,default_price,color').eq('active', true).order('name'),
   ```

   e montar um mapa `id → color`:

   ```js
   const svcColor = new Map(state.services.map((s) => [s.id, s.color]));
   ```
   (colocar num escopo acessível às funções de render; ou recalcular a partir de
   `state.services` dentro delas.)

3. Chip do mês (`renderMonth`, linha ~240) — aplicar cor quando houver procedimento
   vinculado (via `state.procByEvent.get(e.id)` → `service_id` → `svcColor`):

   ```js
   ${evs.slice(0, 3).map((e) => {
     const proc = state.procByEvent.get(e.id);
     const c = proc && svcColor.get(proc.service_id);
     const style = c ? ` style="background:${c};color:${textOn(c)}"` : '';
     return `<span class="ag-chip" data-ev="${esc(e.id)}"${style}>${e.start?.dateTime ? hhmm(evStart(e)) + ' ' : ''}${esc(e.summary || '·')}</span>`;
   }).join('')}
   ```

4. Lista (`rowHTML`, linha ~216) — dar cor à faixa também (ex.: borda/dot à
   esquerda com a cor do serviço, usando `proc`/`svcColor` já disponíveis).

5. `.ag-chip` no CSS usa `var(--accent)`/`var(--accent-text)` como default — manter,
   pois o inline `style` só entra quando há cor de serviço. Ok.

**Caveat:** a query carrega só serviços ativos; procedimento de serviço inativo cai
no default. Se quiser cor sempre, buscar `color` de todos os serviços (sem
`.eq('active', true)`) num mapa à parte. Opcional.

**Verificação:**
- Um serviço com cor azul → evento correspondente aparece azul no mês e na lista.
- Cor de texto legível em fundos claros (preto) e escuros (branco).
- Evento do Google sem procedimento → segue com a cor de destaque padrão.

---

## Verificação final (rodar depois dos 5)
- Abrir o app localmente e testar cada tela: Estoque (foto), Fluxo de caixa
  (toggle), Home (faixa de botões), Serviços (paleta), Agenda (cores).
- Console sem erros. Nenhuma etapa de build introduzida.
- Testar responsivo em ~1200 / 900 / 600 / 375 px.
- (Item 6 — importar produto do Mercado Livre — está adiado no
  `APRIMORAMENTOS-PENDENTES.md`, PARTE 4. NÃO implementar agora.)
