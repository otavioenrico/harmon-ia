import common from '/assets/js/i18n/common.js';
import { initI18n } from '/assets/js/i18n.js';

const page = document.documentElement.dataset.i18nPage;
const dict = (await import(`/assets/js/i18n/${page}.js`)).default;

initI18n({ ...common, ...dict });
