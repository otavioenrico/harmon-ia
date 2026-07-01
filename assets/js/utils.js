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

// cria elemento a partir de HTML string
export const h = (html) => {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

// ----------------------------------------------------------------- toast ----
export function toast(message, type = 'success') {
  let box = document.querySelector('.toasts');
  if (!box) { box = h('<div class="toasts"></div>'); document.body.appendChild(box); }
  while (box.children.length >= 3) box.firstElementChild.remove();
  const t = h(`<div class="toast toast--${type}">${esc(message)}</div>`);
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 200); }, 4000);
}

// ----------------------------------------------------------------- modal ----
// openModal({title, body(HTMLElement|string), footer, wide}) -> {overlay, close, body}
// ESC e clique fora fecham; confirma se algum campo foi alterado.
export function openModal({ title = '', body = '', footer = '', wide = false } = {}) {
  let dirty = false;
  const overlay = h(`<div class="modal-overlay"></div>`);
  const modal = h(`
    <div class="modal ${wide ? 'modal--wide' : ''}">
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
  bodyEl.addEventListener('input', () => { dirty = true; });

  const close = (force = false) => {
    if (dirty && !force && !confirm('Descartar as alterações não salvas?')) return;
    document.removeEventListener('keydown', onKey);
    overlay.remove();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  modal.querySelector('.modal__close').addEventListener('click', () => close());
  return { overlay, modal, body: bodyEl, close, markClean: () => { dirty = false; } };
}

// ---------------------------------------------------------------- drawer ----
// painel lateral reaproveitando .modal-overlay (backdrop) + .drawer. ESC e
// clique-fora fecham. Recebe o conteúdo (HTMLElement) e devolve { close }.
export function openDrawer(bodyEl) {
  const overlay = h(`<div class="modal-overlay"></div>`);
  const aside = h(`<aside class="drawer"></aside>`);
  aside.appendChild(bodyEl);
  overlay.appendChild(aside);
  document.body.appendChild(overlay);
  const close = () => { document.removeEventListener('keydown', onKey); overlay.remove(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  return { close };
}

// --------------------------------------------------------------- skeleton ---
export const skeletonRows = (cols, rows = 5) =>
  Array.from({ length: rows }, () =>
    `<tr>${Array.from({ length: cols }, () => '<td><div class="skeleton"></div></td>').join('')}</tr>`
  ).join('');

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
