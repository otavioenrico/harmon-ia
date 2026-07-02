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
  configuracoes: { title: 'Configurações',  icon: 'tool' },
};
// item 2: Configurações não é uma opção de navegação como as demais — mora no
// mini-menu do rodapé (renderUserFooter), então sai do nav mas continua em
// ROUTES pro router (#configuracoes) resolver normalmente.
const ORDER = Object.keys(ROUTES).filter((k) => k !== 'configuracoes');

const $ = (id) => document.getElementById(id);
const navEl = $('nav'), rootEl = $('module-root'), actionsEl = $('header-actions'), titleEl = $('header-title');

let session, settings;
let closeDrawer = () => {};   // wireChrome() preenche; usado no menu do rodapé (mobile)
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
  pop.querySelector('[data-go]').addEventListener('click', () => { closePop(); closeDrawer(); navigate('configuracoes'); });
  pop.querySelector('[data-logout]').addEventListener('click', () => signOut());
  document.addEventListener('click', (e) => { if (!footer.contains(e.target)) closePop(); });
}

function wireChrome() {
  const brand = document.querySelector('.brand-mark');
  if (brand) brand.innerHTML = icon('sparkle');
  const collapse = $('collapse');
  collapse.innerHTML = icon('panel');

  // Desktop: colapsa a sidebar (rail de ícones). Mobile (≤900px): a sidebar é um
  // drawer sobreposto — o botão abre/fecha com scrim; navegar fecha.
  const shell = $('shell');
  const mobile = window.matchMedia('(max-width: 900px)');
  let scrim = null;
  const syncAria = () => collapse.setAttribute('aria-expanded',
    String(mobile.matches ? shell.classList.contains('sidebar-open')
                          : !shell.classList.contains('collapsed')));
  closeDrawer = () => { shell.classList.remove('sidebar-open'); scrim?.remove(); scrim = null; syncAria(); };
  collapse.addEventListener('click', () => {
    if (!mobile.matches) { shell.classList.toggle('collapsed'); return syncAria(); }
    if (shell.classList.toggle('sidebar-open')) {
      scrim = document.createElement('div');
      scrim.className = 'scrim';
      scrim.addEventListener('click', closeDrawer);
      document.body.appendChild(scrim);
      syncAria();
    } else closeDrawer();
  });
  navEl.addEventListener('click', () => { if (mobile.matches) closeDrawer(); });
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
