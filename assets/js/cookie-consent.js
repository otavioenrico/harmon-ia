// cookie-consent.js — banner de consentimento vanilla, sem lib.
// Guarda a escolha em localStorage; nunca reaparece depois de decidido.
const KEY = 'harmonia-cookie-consent'; // 'all' | 'essential'

// ponytail: no-op até a Fase 4 ligar analytics de verdade — só documenta o gancho
window.onCookieConsent = window.onCookieConsent || function () {};

const banner = document.getElementById('cookie-banner');
if (banner) {
  const stored = localStorage.getItem(KEY);
  if (stored) {
    window.onCookieConsent(stored);
  } else {
    banner.classList.add('is-open');
  }

  const decide = (value) => {
    localStorage.setItem(KEY, value);
    banner.classList.remove('is-open');
    window.onCookieConsent(value);
  };
  banner.querySelector('[data-cookie-accept]').addEventListener('click', () => decide('all'));
  banner.querySelector('[data-cookie-reject]').addEventListener('click', () => decide('essential'));
}
