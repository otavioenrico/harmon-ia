// ============================================================================
// app.js — shell: guarda de sessão, tema, sidebar, roteador por hash.
// Cada módulo exporta `render(root, ctx)`. ctx = { session, settings, actions,
// navigate, setBadge }.
// ============================================================================
import { supabase } from './supabase.js';
import { requireSession, profile, signOut } from './auth.js';
import { toast, initials, esc, icon } from './utils.js';

const ROUTES = {
  home:          { title: 'Início',         icon: 'home' },
  agenda:        { title: 'Agenda',         icon: 'calendar' },
  servicos:      { title: 'Serviços',       icon: 'scissors' },
  estoque:       { title: 'Estoque',        icon: 'box' },
  clientes:      { title: 'Clientes',       icon: 'users' },
  historico:     { title: 'Histórico',      icon: 'clipboard' },
  financeiro:    { title: 'Fluxo de Caixa', icon: 'wallet' },
  configuracoes: { title: 'Configurações',  icon: 'settings' },
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

// ----------------------------------------------------------------- sidebar --
// item 4: sem bolinhas de aviso no menu — a Home cobre estoque crítico / retornos.
function buildNav() {
  navEl.innerHTML = ORDER.map((key) => `
    <button class="nav__item" data-route="${key}">
      <span class="nav__icon">${icon(ROUTES[key].icon)}</span>
      <span class="label">${ROUTES[key].title}</span>
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
    <button class="btn btn--icon btn--ghost" id="logout" title="Sair">${icon('logout')}</button>`;
  $('logout').addEventListener('click', () => signOut());
}

function wireChrome() {
  const brand = document.querySelector('.brand-mark');
  if (brand) brand.innerHTML = icon('sparkle');
  const collapse = $('collapse');
  collapse.innerHTML = icon('menu');
  collapse.addEventListener('click', () => $('shell').classList.toggle('collapsed'));
}

// ----------------------------------------------------------------- router ---
const navigate = (key) => { location.hash = key; };

// item 4: badges do nav foram removidas; stub mantido p/ compat dos módulos.
function setBadge() {}

async function route() {
  const key = (location.hash.slice(1) || 'home');
  const def = ROUTES[key] || ROUTES.home;

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
    rootEl.innerHTML = `<div class="empty"><div class="icon">${icon('warning')}</div>
      <p>Não foi possível carregar este módulo.</p>
      <p class="hint">${esc(e.message || '')}</p></div>`;
  }
}

// disponível para módulos que rodam fora do ctx (ex.: contagem de reativação)
window.Harmon = { setBadge, navigate };
