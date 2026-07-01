// ============================================================================
// app.js — shell: guarda de sessão, tema, sidebar, roteador por hash.
// Cada módulo exporta `render(root, ctx)`. ctx = { session, settings, actions,
// navigate, setBadge }.
// ============================================================================
import { supabase } from './supabase.js';
import { requireSession, profile, signOut } from './auth.js';
import { toast, initials, esc } from './utils.js';

const ROUTES = {
  agenda:        { title: 'Agenda',         icon: '📅' },
  servicos:      { title: 'Serviços',       icon: '✂️' },
  estoque:       { title: 'Estoque',        icon: '📦' },
  clientes:      { title: 'Clientes',       icon: '👥' },
  historico:     { title: 'Histórico',      icon: '📋' },
  financeiro:    { title: 'Fluxo de Caixa', icon: '💰' },
  configuracoes: { title: 'Configurações',  icon: '⚙️' },
};
const ORDER = Object.keys(ROUTES);

const $ = (id) => document.getElementById(id);
const navEl = $('nav'), rootEl = $('module-root'), actionsEl = $('header-actions'), titleEl = $('header-title');

let session, settings;
const moduleCache = {};

// ------------------------------------------------------------------- boot ---
(async function boot() {
  session = await requireSession();
  if (!session) return; // requireSession já redirecionou

  settings = await loadSettings();
  applyTheme(settings?.theme || 'light');
  renderUserFooter();
  buildNav();
  wireChrome();
  refreshStockBadge();

  window.addEventListener('hashchange', route);
  route();
})();

async function loadSettings() {
  const { data } = await supabase.from('user_settings').select('*').eq('user_id', session.user.id).maybeSingle();
  return data || { theme: 'light' };
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'dark' ? 'dark' : '';
}

// ponytail: contagem de itens em falta no load; o módulo Estoque reatualiza ao mexer.
async function refreshStockBadge() {
  const { data } = await supabase.from('stock_items').select('quantity, min_quantity, active');
  if (!data) return;
  setBadge('estoque', data.filter((i) => i.active !== false && Number(i.quantity || 0) <= Number(i.min_quantity || 0)).length);
}

// ----------------------------------------------------------------- sidebar --
function buildNav() {
  navEl.innerHTML = ORDER.map((key) => `
    <button class="nav__item" data-route="${key}">
      <span class="nav__icon">${ROUTES[key].icon}</span>
      <span class="label">${ROUTES[key].title}</span>
      <span class="nav__badge" data-badge="${key}" hidden></span>
    </button>`).join('');
  navEl.querySelectorAll('.nav__item').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.route)));
}

function renderUserFooter() {
  const p = profile(session);
  $('user-footer').innerHTML = `
    <div class="avatar">${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : esc(initials(p.name))}</div>
    <div class="sidebar__user-info">
      <div class="name">${esc(p.name)}</div>
      <div class="email">${esc(p.email)}</div>
    </div>
    <button class="btn btn--icon btn--ghost" id="logout" title="Sair">⎋</button>`;
  $('logout').addEventListener('click', () => signOut());
}

function wireChrome() {
  $('collapse').addEventListener('click', () => $('shell').classList.toggle('collapsed'));
}

// ----------------------------------------------------------------- router ---
const navigate = (key) => { location.hash = key; };

function setBadge(key, n) {
  const el = navEl.querySelector(`[data-badge="${key}"]`);
  if (!el) return;
  if (n > 0) { el.textContent = n; el.hidden = false; } else { el.hidden = true; }
}

async function route() {
  const key = (location.hash.slice(1) || 'agenda');
  const def = ROUTES[key] || ROUTES.agenda;

  navEl.querySelectorAll('.nav__item').forEach((b) =>
    b.classList.toggle('active', b.dataset.route === key));
  titleEl.textContent = def.title;
  actionsEl.innerHTML = '';
  rootEl.innerHTML = '';

  const ctx = { session, settings, actions: actionsEl, navigate, setBadge };
  try {
    const mod = moduleCache[key] || (moduleCache[key] = await import(`./${key}.js`));
    await mod.render(rootEl, ctx);
  } catch (e) {
    console.error(e);
    rootEl.innerHTML = `<div class="empty"><div class="icon">⚠️</div>
      <p>Não foi possível carregar este módulo.</p>
      <p class="hint">${esc(e.message || '')}</p></div>`;
  }
}

// disponível para módulos que rodam fora do ctx (ex.: contagem de reativação)
window.Harmon = { setBadge, navigate };
