// ============================================================================
// analytics.js — PostHog (product analytics) atrás do consent de cookies.
//
// Host: US Cloud (https://us.i.posthog.com / assets em us-assets.i.posthog.com).
// Se um dia migrar pro EU Cloud, troque as duas constantes de host abaixo E os
// domínios correspondentes na CSP (_headers): script-src + connect-src.
//
// Regras:
//   - Só carrega depois de window.onCookieConsent('all') — consent de analytics
//     (cookie-consent.js chama o hook no boot se já respondido e a cada escolha).
//   - POSTHOG_KEY em placeholder = não carrega NADA e não loga erro (guard
//     explícito). Troque pelo phc_... real quando o projeto PostHog existir.
//   - window.hrmTrack(evento, props) é sempre definido: vira no-op silencioso
//     enquanto o PostHog não estiver carregado (sem consent / sem chave).
//   - Único consumidor hoje: waitlist.js (importa e chama initAnalytics()).
// ============================================================================

const POSTHOG_KEY = 'POSTHOG_KEY'; // placeholder — substitua pela chave phc_...
const POSTHOG_HOST = 'https://us.i.posthog.com';
const POSTHOG_ASSETS = 'https://us-assets.i.posthog.com';

// Mesma chave usada por cookie-consent.js — fallback pra quando este módulo
// rodar DEPOIS do boot do banner (ordem dos <script> não é garantida em toda
// página) e o hook já tiver sido chamado sem a gente ouvindo.
const CONSENT_KEY = 'harmonia-cookie-consent';

let loadRequested = false;

function hasRealKey() {
  return typeof POSTHOG_KEY === 'string'
    && POSTHOG_KEY !== 'POSTHOG_KEY'
    && POSTHOG_KEY.length > 0;
}

// Versão legível do snippet oficial do PostHog: cria o stub (fila de chamadas),
// injeta /static/array.js do host de assets e enfileira o init. O array.js
// real processa a fila quando carrega.
function loadPostHog() {
  if (loadRequested || !hasRealKey()) return;
  loadRequested = true;
  if (window.posthog && window.posthog.__SV) return; // já inicializado por alguém

  const ph = (window.posthog = window.posthog || []);
  ph._i = [];
  ph.init = function (key, config, name) {
    const stub = (obj, method) => {
      obj[method] = function () {
        obj.push([method].concat(Array.prototype.slice.call(arguments)));
      };
    };
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.src = POSTHOG_ASSETS + '/static/array.js';
    document.head.appendChild(script);

    let instance = ph;
    if (name !== undefined) instance = ph[name] = [];
    instance.people = instance.people || [];
    // só os métodos que podem ser chamados antes do array.js carregar
    ['capture', 'identify', 'register', 'reset',
     'opt_in_capturing', 'opt_out_capturing'].forEach((m) => stub(instance, m));
    ph._i.push([key, config, name]);
  };
  ph.__SV = 1;

  ph.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    autocapture: false,             // só eventos explícitos (hrmTrack) + pageview
    disable_session_recording: true, // replay fora do escopo — manter CSP enxuta
  });
}

// Sempre definido; nunca lança. Sem PostHog carregado = no-op silencioso.
window.hrmTrack = function (event, props) {
  try {
    const ph = window.posthog;
    if (ph && typeof ph.capture === 'function') ph.capture(event, props || {});
  } catch (_) { /* analytics nunca pode quebrar o fluxo da página */ }
};

export function initAnalytics() {
  if (!hasRealKey()) return; // placeholder: zero rede, zero erro no console

  // pendura no hook PRESERVANDO callback anterior — outros scripts podem usar
  // o mesmo gancho de consent.
  const prev = window.onCookieConsent;
  window.onCookieConsent = function (value) {
    if (typeof prev === 'function') prev(value);
    if (value === 'all') loadPostHog();
  };

  // consent já respondido antes de a gente ouvir o hook (ordem de scripts)
  try {
    if (localStorage.getItem(CONSENT_KEY) === 'all') loadPostHog();
  } catch (_) { /* localStorage indisponível (ex.: modo privado antigo) */ }
}
