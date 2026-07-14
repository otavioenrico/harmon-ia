(function () {
  var saved = localStorage.getItem('harmon:lang');
  var lang = (saved === 'pt' || saved === 'en') ? saved : ((navigator.language || '').startsWith('pt') ? 'pt' : 'en');
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
})();
