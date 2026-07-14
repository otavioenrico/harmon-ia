const STORAGE_KEY = 'harmon:lang';
const SUPPORTED = ['pt', 'en'];

let currentLang = 'pt';
let currentDict = {};

function resolveInitialLang() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (SUPPORTED.includes(saved)) return saved;
  return (navigator.language || '').startsWith('pt') ? 'pt' : 'en';
}

function applyLang(lang, dict) {
  currentLang = lang;
  currentDict = dict;
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const entry = dict[key];
    if (!entry) { console.warn(`[i18n] chave ausente: ${key}`); return; }
    el.textContent = entry[lang] ?? entry.pt;
  });

  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.getAttribute('data-i18n-attr').split(';').forEach((pair) => {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (!attr || !key) return;
      const entry = dict[key];
      if (!entry) { console.warn(`[i18n] chave ausente: ${key}`); return; }
      el.setAttribute(attr, entry[lang] ?? entry.pt);
    });
  });

  document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.getAttribute('data-lang-btn') === lang));
  });

  localStorage.setItem(STORAGE_KEY, lang);
}

function wireToggle(dict) {
  document.querySelectorAll('[data-lang-btn]').forEach((btn) => {
    btn.addEventListener('click', () => applyLang(btn.getAttribute('data-lang-btn'), dict));
  });
}

export function initI18n(dict) {
  const lang = resolveInitialLang();
  applyLang(lang, dict);
  wireToggle(dict);
}

// tradução p/ strings injetadas via JS (toasts, aria-label dinâmico etc.)
export function t(key) {
  const entry = currentDict[key];
  if (!entry) { console.warn(`[i18n] chave ausente: ${key}`); return key; }
  return entry[currentLang] ?? entry.pt;
}
