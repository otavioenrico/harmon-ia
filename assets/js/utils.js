// ============================================================================
// utils.js — helpers compartilhados: formatação, máscaras, toast, modal, CSV.
// Sem dependências externas.
// ============================================================================

// ----------------------------------------------------------------- moeda ----
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (n) => BRL.format(Number(n || 0));
// "1.234,56" ou "1234.56" -> número
export const parseMoney = (s) => {
  if (typeof s === 'number') return s;
  if (!s) return 0;
  return Number(String(s).replace(/\s|R\$/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')) || 0;
};

// ----------------------------------------------------------------- datas ----
export const todayISO = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
// Formata "YYYY-MM-DD" sem cair em fuso (não usa new Date(str)).
export const fmtDate = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
};
export const fmtDateTime = (iso) => {
  if (!iso) return '—';
  const dt = new Date(iso);
  return dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
export const daysSince = (iso) => {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  const then = new Date(y, m - 1, d);
  return Math.floor((Date.now() - then.getTime()) / 86400000);
};

// --------------------------------------------------------------- máscaras ---
export const maskPhone = (v) => {
  v = String(v || '').replace(/\D/g, '').slice(0, 11);
  if (v.length <= 10)
    return v.replace(/(\d{0,2})(\d{0,4})(\d{0,4})/, (_, a, b, c) =>
      [a && `(${a}`, a.length === 2 ? ') ' : '', b, c && `-${c}`].filter(Boolean).join(''));
  return v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
};
export const maskCPF = (v) =>
  String(v || '').replace(/\D/g, '').slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
// liga uma máscara a um <input>
export const bindMask = (input, fn) => {
  if (!input) return;
  input.addEventListener('input', () => { input.value = fn(input.value); });
};
export const onlyDigits = (v) => String(v || '').replace(/\D/g, '');

// --------------------------------------------------------------- diversos ---
export const debounce = (fn, ms = 300) => {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};
export const initials = (name) =>
  (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const waLink = (phone, msg) =>
  `https://wa.me/55${onlyDigits(phone)}?text=${encodeURIComponent(msg || '')}`;

// ------------------------------------------------------------------ ícones --
// Iconoir-style: SVGs inline, self-hosted (sem CDN — coerente com o projeto).
// icon(name) -> string SVG (stroke = currentColor, herda cor/tamanho do pai).
const ICON_PATHS = {
  home:     '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 8l12 8M8 16 20 8"/>',
  box:      '<path d="M3 8l9-4 9 4v8l-9 4-9-4V8Z"/><path d="M3 8l9 4 9-4M12 12v8"/>',
  users:    '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><path d="M16 5.5a3 3 0 0 1 0 5M21 20c0-2.3-1.3-4-3.5-4.6"/>',
  clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v2H9zM9 11h6M9 15h4"/>',
  wallet:   '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14h2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
  logout:   '<path d="M14 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2"/><path d="M9 12h11M17 9l3 3-3 3"/>',
  menu:     '<path d="M3 6h18M3 12h18M3 18h18"/>',
  panel:    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  tool:     '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z"/>',
  trash:    '<path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/>',
  plug:     '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4"/>',
  left:     '<path d="M15 6l-6 6 6 6"/>',
  right:    '<path d="M9 6l6 6-6 6"/>',
  check:    '<path d="M5 12l4 4 10-11"/>',
  warning:  '<path d="M12 3 2 20h20L12 3ZM12 9v6M12 18h.01"/>',
  whatsapp: '<path d="M4 20l1.4-4A8 8 0 1 1 9 19.6L4 20Z"/><path d="M9 10c.5 2 2 3.5 4 4l1.2-1.4 2 .8v2c-3.5.5-7-3-6.5-6.5l2 .3.3 1.8Z"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  search:   '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  bell:     '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0"/>',
  x:        '<path d="M6 6l12 12M18 6 6 18"/>',
  sparkle:  '<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6Z"/>',
  download: '<path d="M12 3v12M8 11l4 4 4-4M5 21h14"/>',
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;

// cria elemento a partir de HTML string
export const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

// ---------------------------------------------------------------- motion ----
// saída animada: adiciona .closing (keyframes reversos no CSS) e chama done()
// no fim da animação. Curto-circuito com prefers-reduced-motion + fallback de
// timeout caso animationend nunca dispare.
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)');
function animateOut(el, done) {
  if (REDUCED.matches) return done();
  let called = false;
  const fin = () => { if (!called) { called = true; done(); } };
  el.classList.add('closing');
  el.addEventListener('animationend', fin, { once: true });
  setTimeout(fin, 250);
}

// ----------------------------------------------------------------- toast ----
export function toast(message, type = 'success') {
  let box = document.querySelector('.toasts');
  if (!box) { box = h('<div class="toasts"></div>'); document.body.appendChild(box); }
  while (box.children.length >= 3) box.firstElementChild.remove();
  const t = h(`<div class="toast toast--${type}">${esc(message)}</div>`);
  box.appendChild(t);
  setTimeout(() => animateOut(t, () => t.remove()), 4000);
}

// ----------------------------------------------------------------- modal ----
// foco: trap de Tab dentro do container + restauração ao fechar (a11y)
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function wireFocus(container, preferred) {
  const prev = document.activeElement;
  (preferred?.querySelector(FOCUSABLE) || container.querySelector(FOCUSABLE) || container).focus();
  const onTab = (e) => {
    if (e.key !== 'Tab') return;
    const els = [...container.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  };
  return { onTab, restore: () => { if (prev?.isConnected) prev.focus(); } };
}

// openModal({title, body(HTMLElement|string), footer, wide, onClose}) ->
// {overlay, close, body}. ESC e clique fora fecham; Tab fica preso no modal e
// o foco volta ao elemento de origem ao fechar.
export function openModal({ title = '', body = '', footer = '', wide = false, onClose } = {}) {
  const overlay = h(`<div class="modal-overlay"></div>`);
  const modal = h(`
    <div class="modal ${wide ? 'modal--wide' : ''}" role="dialog" aria-modal="true" tabindex="-1">
      <div class="modal__head">
        <div class="modal__title">${esc(title)}</div>
        <button class="modal__close" aria-label="Fechar">×</button>
      </div>
      <div class="modal__body"></div>
      ${footer ? `<div class="modal__foot"></div>` : ''}
    </div>`);
  const bodyEl = modal.querySelector('.modal__body');
  if (body instanceof Node) bodyEl.appendChild(body); else bodyEl.innerHTML = body;
  if (footer) {
    const f = modal.querySelector('.modal__foot');
    if (footer instanceof Node) f.appendChild(footer); else f.innerHTML = footer;
  }
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  // foco inicial no corpo (1º campo), senão rodapé/fechar
  const focus = wireFocus(modal, bodyEl);

  // item 16: sem confirmação de "descartar alterações" — fecha direto.
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    animateOut(overlay, () => { overlay.remove(); focus.restore(); onClose?.(); });
  };
  // keydown no overlay (não no document): com o foco preso dentro, só o modal
  // do topo recebe ESC — modais empilhados (ex.: confirmação) não fecham juntos.
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); else focus.onTab(e); });
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  modal.querySelector('.modal__close').addEventListener('click', () => close());
  return { overlay, modal, body: bodyEl, close, markClean: () => {} };
}

// ---------------------------------------------------------------- drawer ----
// painel lateral reaproveitando .modal-overlay (backdrop) + .drawer. ESC e
// clique-fora fecham; mesmo trap/restauração de foco do modal.
export function openDrawer(bodyEl) {
  const overlay = h(`<div class="modal-overlay"></div>`);
  const aside = h(`<aside class="drawer" role="dialog" aria-modal="true" tabindex="-1"></aside>`);
  aside.appendChild(bodyEl);
  overlay.appendChild(aside);
  document.body.appendChild(overlay);
  const focus = wireFocus(aside);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    animateOut(overlay, () => { overlay.remove(); focus.restore(); });
  };
  overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); else focus.onTab(e); });
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  return { close };
}

// --------------------------------------------------------- confirmação ------
// confirmDialog({title, message, confirmLabel, cancelLabel, danger}) ->
// Promise<boolean>. Substitui o confirm() nativo com a identidade do app.
// O foco inicial cai no botão seguro ("Voltar") — confirmar exige intenção.
export function confirmDialog({ title = 'Confirmar', message = '', confirmLabel = 'Confirmar', cancelLabel = 'Voltar', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const answer = (v) => { if (!answered) { answered = true; resolve(v); } };
    const foot = h(`<div style="display:contents">
      <button class="btn btn--ghost" data-no>${esc(cancelLabel)}</button>
      <button class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-yes>${esc(confirmLabel)}</button>
    </div>`);
    const m = openModal({ title, body: `<p style="margin:0">${esc(message)}</p>`, footer: foot, onClose: () => answer(false) });
    const no = foot.querySelector('[data-no]');
    no.focus(); // foco no botão seguro — confirmar exige intenção
    no.onclick = () => m.close();
    foot.querySelector('[data-yes]').onclick = () => { answer(true); m.close(); };
  });
}

// ------------------------------------------------------ guard anti-duplo ----
// guard(fn) -> versão de fn que ignora chamadas enquanto a anterior não
// terminar (proteção de duplo clique em ações diretas; forms já usam busy()).
export const guard = (fn) => {
  let running = false;
  return async (...a) => {
    if (running) return;
    running = true;
    try { return await fn(...a); } finally { running = false; }
  };
};

// -------------------------------------------------------- autocomplete -----
// item 15: seleção de cliente por busca (nome ou telefone). Componente único —
// Agendamento e Histórico usam o mesmo. Devolve { el, value() } onde value() é
// o id selecionado (ou ''). Mesma lógica p/ qualquer lista {id,name,phone}.
export function clientAutocomplete(clients, selectedId = '') {
  const wrap = h(`<div class="autocomplete">
    <input class="input" type="text" placeholder="Buscar cliente…" autocomplete="off">
    <input type="hidden">
    <div class="autocomplete__list" hidden></div>
  </div>`);
  const [input, hidden, list] = wrap.children;
  let active = -1, matches = [];
  const pick = (c) => { hidden.value = c ? c.id : ''; input.value = c ? c.name : ''; };
  const cur = clients.find((c) => c.id === selectedId);
  if (cur) pick(cur);
  const render = () => {
    const q = input.value.trim().toLowerCase();
    matches = (!q ? clients.slice(0, 8)
      : clients.filter((c) => (c.name || '').toLowerCase().includes(q)
          || onlyDigits(c.phone).includes(onlyDigits(q))).slice(0, 8));
    list.innerHTML = matches.map((c, i) =>
      `<div class="autocomplete__item${i === active ? ' active' : ''}" data-i="${i}">${esc(c.name)}${c.phone ? `<div class="sub">${esc(c.phone)}</div>` : ''}</div>`
    ).join('') || `<div class="autocomplete__item faint">Nenhum cliente</div>`;
    list.hidden = false;
  };
  input.addEventListener('focus', render);
  input.addEventListener('input', () => { hidden.value = ''; active = -1; render(); });
  const scrollActive = () => list.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
  input.addEventListener('keydown', (e) => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, matches.length - 1); render(); scrollActive(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); render(); scrollActive(); e.preventDefault(); }
    else if (e.key === 'Enter' && matches[active]) { pick(matches[active]); list.hidden = true; e.preventDefault(); }
    else if (e.key === 'Escape') { list.hidden = true; }
  });
  list.addEventListener('mousedown', (e) => {
    const it = e.target.closest('[data-i]'); if (!it) return;
    pick(matches[+it.dataset.i]); list.hidden = true;
  });
  document.addEventListener('mousedown', (e) => { if (!wrap.contains(e.target)) list.hidden = true; });
  return { el: wrap, value: () => hidden.value };
}

// --------------------------------------------------------------- skeleton ---
export const skeletonRows = (cols, rows = 5) =>
  Array.from({ length: rows }, () =>
    `<tr>${Array.from({ length: cols }, () => '<td><div class="skeleton"></div></td>').join('')}</tr>`
  ).join('');

// ------------------------------------------------------------ estado vazio --
// componente único de empty state (era duplicado em historico/clientes e
// improvisado inline nos demais módulos). extraHTML: CTA opcional (botão etc.).
export const emptyBox = (iconHTML, msg, extraHTML = '') =>
  `<div class="empty">${iconHTML ? `<div class="icon">${iconHTML}</div>` : ''}<p>${esc(msg)}</p>${extraHTML}</div>`;

// ------------------------------------------------------------- download/CSV -
export function download(filename, content, mime = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// matriz -> CSV com BOM (UTF-8) compatível com Google Sheets / Excel no Mac
export function toCSV(rows) {
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
}

// estado de botão "Salvando..."
export function busy(btn, on, label = 'Salvando…') {
  if (!btn) return;
  if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; btn.disabled = true; }
  else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
}
