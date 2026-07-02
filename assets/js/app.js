// ============================================================================
// app.js — shell: guarda de sessão, tema, sidebar, roteador por hash.
// Cada módulo exporta `render(root, ctx)`. ctx = { session, settings, actions,
// navigate, setBadge }.
// ============================================================================
import { supabase } from './supabase.js';
import { requireSession, profile, signOut } from './auth.js';
import { toast, initials, esc, icon, h, openDrawer } from './utils.js';

const ROUTES = {
  home:          { title: 'Início',         icon: 'home' },
  agenda:        { title: 'Agenda',         icon: 'calendar' },
  servicos:      { title: 'Serviços',       icon: 'scissors' },
  estoque:       { title: 'Estoque',        icon: 'box' },
  clientes:      { title: 'Clientes',       icon: 'users' },
  historico:     { title: 'Histórico',      icon: 'clipboard' },
  financeiro:    { title: 'Fluxo de Caixa', icon: 'wallet' },
  configuracoes: { title: 'Configurações',  icon: 'tool' },
};
// item 2: Configurações não é uma opção de navegação como as demais — mora no
// mini-menu do rodapé (renderUserFooter), então sai do nav mas continua em
// ROUTES pro router (#configuracoes) resolver normalmente.
const ORDER = Object.keys(ROUTES).filter((k) => k !== 'configuracoes');

// mobile (≤900px): 4 rotas fixas na tabbar; o resto vai pro sheet "Mais"
const MOBILE_TABS = ['home', 'agenda', 'clientes', 'financeiro'];
const TAB_LABELS = { home: 'Início', agenda: 'Agenda', clientes: 'Clientes', financeiro: 'Caixa' };

const $ = (id) => document.getElementById(id);
const navEl = $('nav'), rootEl = $('module-root'), actionsEl = $('header-actions'), titleEl = $('header-title');

let session, settings;
const moduleCache = {};

// ------------------------------------------------------------------- boot ---
(async function boot() {
  session = await requireSession();
  if (!session) return; // requireSession já redirecionou

  // volta do consentimento Google (Agenda/Configurações): confirma o resultado
  if (sessionStorage.getItem('google:reconnecting')) {
    sessionStorage.removeItem('google:reconnecting');
    if (session.provider_token) toast('Google reconectado — agenda liberada.');
    else toast('A reconexão com o Google não foi concluída.', 'warning');
  }

  settings = await loadSettings();
  applyTheme(settings?.theme || 'light');
  applyAccent(settings?.accent || 'rose');
  renderUserFooter();
  buildNav();
  buildTabbar();
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

function applyAccent(accent) {
  document.documentElement.dataset.accent = accent || 'rose';
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

// item 1/2: rodapé é um único gatilho (avatar+nome+hamburger) que abre um
// mini-menu com Configurações/Sair — colapsado, só o avatar sobra (sem 2º
// elemento ao lado pra vazar do rail de 64px).
function renderUserFooter() {
  const p = profile(session);
  const footer = $('user-footer');
  footer.innerHTML = `
    <button class="user-menu__trigger" id="user-trigger" aria-haspopup="true" aria-expanded="false">
      <div class="avatar">${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : esc(initials(p.name))}</div>
      <div class="sidebar__user-info">
        <div class="name">${esc(p.name)}</div>
        <div class="email">${esc(p.email)}</div>
      </div>
      <span class="user-menu__icon">${icon('menu')}</span>
    </button>
    <div class="user-menu__pop" id="user-pop" hidden>
      <button type="button" data-go>${icon('tool')} Configurações</button>
      <button type="button" data-logout>${icon('logout')} Sair</button>
    </div>`;

  const trigger = $('user-trigger'), pop = $('user-pop');
  const closePop = () => { pop.hidden = true; trigger.setAttribute('aria-expanded', 'false'); };
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const wasHidden = pop.hidden;
    pop.hidden = !wasHidden;
    trigger.setAttribute('aria-expanded', String(wasHidden));
  });
  pop.querySelector('[data-go]').addEventListener('click', () => { closePop(); navigate('configuracoes'); });
  pop.querySelector('[data-logout]').addEventListener('click', () => signOut());
  document.addEventListener('click', (e) => { if (!footer.contains(e.target)) closePop(); });
}

// ----------------------------------------------------------- tabbar (mobile) -
// ≤900px a sidebar não existe (display:none) — a navegação é esta barra fixa
// no rodapé: Início/Agenda/Clientes/Caixa + "Mais" (sheet com o restante).
function buildTabbar() {
  const bar = $('tabbar');
  bar.hidden = false;
  bar.innerHTML = MOBILE_TABS.map((key) => `
    <button class="tabbar__item" data-route="${key}">
      ${icon(ROUTES[key].icon)}<span>${TAB_LABELS[key]}</span>
    </button>`).join('') + `
    <button class="tabbar__item" data-more aria-haspopup="true">
      ${icon('menu')}<span>Mais</span>
    </button>`;
  bar.querySelectorAll('[data-route]').forEach((b) =>
    b.addEventListener('click', () => navigate(b.dataset.route)));
  bar.querySelector('[data-more]').addEventListener('click', openMoreSheet);
}

function openMoreSheet() {
  const p = profile(session);
  const current = location.hash.slice(1) || 'home';
  const extras = [...ORDER.filter((k) => !MOBILE_TABS.includes(k)), 'configuracoes'];
  const body = h(`<div>
    <div class="flex" style="padding: var(--sp-2) 0 var(--sp-4)">
      <div class="avatar">${p.avatar ? `<img src="${esc(p.avatar)}" alt="">` : esc(initials(p.name))}</div>
      <div class="sidebar__user-info">
        <div class="name">${esc(p.name)}</div>
        <div class="email">${esc(p.email)}</div>
      </div>
    </div>
    ${extras.map((key) => `
      <button class="nav__item${key === current ? ' active' : ''}" data-go="${key}">
        <span class="nav__icon">${icon(ROUTES[key].icon)}</span><span class="label">${ROUTES[key].title}</span>
      </button>`).join('')}
    <button class="nav__item" data-logout>
      <span class="nav__icon">${icon('logout')}</span><span class="label">Sair</span>
    </button>
  </div>`);
  const sheet = openDrawer(body, { sheet: true });
  body.querySelectorAll('[data-go]').forEach((b) =>
    b.addEventListener('click', () => { sheet.close(); navigate(b.dataset.go); }));
  body.querySelector('[data-logout]').addEventListener('click', () => signOut());
}

function wireChrome() {
  const brand = document.querySelector('.brand-mark');
  if (brand) brand.innerHTML = icon('sparkle');
  const collapse = $('collapse');
  collapse.innerHTML = icon('panel');
  // Desktop: colapsa a sidebar (rail de ícones). ≤900px a sidebar (e este
  // botão) somem via CSS — a navegação mobile é a tabbar.
  const shell = $('shell');
  collapse.addEventListener('click', () => {
    shell.classList.toggle('collapsed');
    collapse.setAttribute('aria-expanded', String(!shell.classList.contains('collapsed')));
  });
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
  // tabbar: rota fixa acende a própria aba; rota do sheet acende o "Mais"
  $('tabbar').querySelectorAll('.tabbar__item').forEach((b) =>
    b.classList.toggle('active',
      b.dataset.route ? b.dataset.route === key : !MOBILE_TABS.includes(key)));
  titleEl.textContent = def.title;
  actionsEl.innerHTML = '';
  rootEl.innerHTML = '';

  // transição de rota: re-dispara o fade+rise do conteúdo (uma vez por navegação
  // — o skeleton entra animado e a troca por conteúdo real não re-anima)
  rootEl.classList.remove('module-enter');
  void rootEl.offsetWidth;
  rootEl.classList.add('module-enter');

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
