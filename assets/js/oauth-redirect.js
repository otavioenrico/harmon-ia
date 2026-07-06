// Retorno do OAuth do Google cai na raiz (redirectTo = "/", evita
// reconfigurar Redirect URLs no Supabase). Dependendo do flow do Supabase,
// o retorno vem na QUERY (?code=…, PKCE) OU no FRAGMENTO (#access_token=…,
// implicit). Antes só checávamos ?code=, então o retorno em #access_token=
// não era encaminhado e a sessão nunca se completava — a usuária ficava
// presa nesta home. Agora repassa qualquer um dos dois pra entrar.html,
// que tem o cliente Supabase e finaliza a sessão.
if (/[?&]code=/.test(location.search) ||
    /(access_token|error)=/.test(location.hash)) {
  location.replace('/entrar.html' + location.search + location.hash);
}
