// ============================================================================
// api/google-refresh.js — Vercel Serverless Function (Node).
// Troca o google_refresh_token do usuário por um access_token fresco (~1h) do
// Google. O provider_token do OAuth NÃO pode ser renovado pelo frontend estático
// (precisa do client_secret), por isso isto vive no servidor.
//
// Sem dependências: usa só `fetch` global. Lê o refresh_token via PostgREST com
// o PRÓPRIO JWT do usuário, então a RLS devolve apenas a linha dele e o token
// nunca trafega pelo browser.
//
// Env vars na Vercel: SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET.
// ============================================================================
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET)
    return res.status(500).json({ error: 'server_misconfigured' });

  const jwt = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return res.status(401).json({ error: 'missing_token' });

  // Lê o refresh_token do próprio usuário (RLS via JWT).
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/user_settings?select=google_refresh_token`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` } });
  if (!r.ok) return res.status(401).json({ error: 'unauthorized' });
  const rows = await r.json();
  const refresh = rows?.[0]?.google_refresh_token;
  if (!refresh) return res.status(409).json({ error: 'no_refresh_token' }); // reconectar Google

  // Troca refresh_token -> access_token no Google.
  const g = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refresh,
      grant_type: 'refresh_token',
    }),
  });
  const tok = await g.json();
  if (!g.ok) return res.status(502).json({ error: 'google_refused', detail: tok.error });

  // no-store: token sensível, nunca cachear.
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ access_token: tok.access_token, expires_in: tok.expires_in });
}
