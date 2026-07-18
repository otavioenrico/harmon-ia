// ============================================================================
// worker/index.js — Cloudflare Worker (assets estáticos + API + cron).
// Substitui as funções serverless do Vercel (api/google-refresh.js e
// api/backup.js). Um único Worker:
//   - fetch():      serve o site estático e responde /api/google-refresh
//   - scheduled():  roda o backup semanal (antes era o cron /api/backup)
//
// O backup agora roda pelo próprio agendador do Cloudflare (handler interno),
// NÃO fica exposto por HTTP — por isso não precisa mais de CRON_SECRET.
//
// Secrets (Workers → Settings → Variables and Secrets):
//   SUPABASE_URL (var pública), SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
// Opcionais (P0): TURNSTILE_SECRET (anti-bot da waitlist), RESEND_API_KEY +
//   NOTIFY_EMAIL (aviso interno de lead novo).
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/api/google-refresh') {
      return handleGoogleRefresh(request, env);
    }
    if (url.pathname === '/api/waitlist') {
      return handleWaitlist(request, env, ctx);
    }
    // qualquer outra rota: assets estáticos (com _headers/_redirects aplicados)
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runBackup(env));
  },
};

// ------------------------------------------------------- /api/google-refresh --
// Troca o google_refresh_token do usuário por um access_token fresco (~1h).
// Lê o refresh_token via PostgREST com o PRÓPRIO JWT do usuário (RLS devolve só
// a linha dele) — o token nunca trafega pelo browser.
async function handleGoogleRefresh(request, env) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const { SUPABASE_URL, SUPABASE_ANON_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET)
    return json({ error: 'server_misconfigured' }, 500);

  const jwt = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'missing_token' }, 401);

  const r = await fetch(`${SUPABASE_URL}/rest/v1/user_settings?select=google_refresh_token`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${jwt}` } });
  if (!r.ok) return json({ error: 'unauthorized' }, 401);
  const rows = await r.json();
  const refresh = rows?.[0]?.google_refresh_token;
  if (!refresh) return json({ error: 'no_refresh_token' }, 409); // reconectar Google

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
  if (!g.ok) return json({ error: 'google_refused', detail: tok.error }, 502);

  return json({ access_token: tok.access_token, expires_in: tok.expires_in }, 200,
    { 'Cache-Control': 'no-store' });
}

// ------------------------------------------------------------ /api/waitlist --
// Insere e-mail da lista de espera. O INSERT anônimo direto no banco foi
// removido (db/migration-p0-seguranca.sql): agora só o Worker escreve, depois
// de validar e-mail, honeypot e o token do Turnstile. Notifica o dono via
// Resend quando configurado.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function handleWaitlist(request, env, ctx) {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400); }

  if (body.company) return json({ ok: true }); // honeypot preenchido: finge sucesso pro bot

  const email = String(body.email || '').trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) return json({ error: 'bad_email' }, 400);
  const source = String(body.source || '').slice(0, 40) || null;

  // Turnstile: fail-closed quando configurado; sem TURNSTILE_SECRET ainda,
  // segue sem verificar (mesmo nível de proteção que o form tinha antes).
  if (env.TURNSTILE_SECRET) {
    const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: String(body.token || ''),
        remoteip: request.headers.get('CF-Connecting-IP') || '',
      }),
    }).then((r) => r.json()).catch(() => null);
    if (!v || !v.success) return json({ error: 'turnstile_failed' }, 403);
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'server_misconfigured' }, 500);

  const r = await fetch(`${SUPABASE_URL}/rest/v1/waitlist?on_conflict=email`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates',
    },
    body: JSON.stringify({ email, source }),
  });
  if (!r.ok) return json({ error: 'insert_failed' }, 502);

  // aviso interno de lead novo — best-effort, nunca segura a resposta
  if (env.RESEND_API_KEY && env.NOTIFY_EMAIL) {
    ctx.waitUntil(fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Harmon IA <onboarding@resend.dev>',
        to: [env.NOTIFY_EMAIL],
        subject: `Novo lead na waitlist: ${email}`,
        text: `E-mail: ${email}\nOrigem: ${source || '—'}\nQuando: ${new Date().toISOString()}`,
      }),
    }).catch(() => {}));
  }

  return json({ ok: true });
}

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj),
    { status, headers: { 'Content-Type': 'application/json', ...extra } });
}

// ---------------------------------------------------------- backup semanal ----
const KEEP = 12;
const FOLDER = 'Harmon IA Backups';
const TABLES = ['user_settings', 'services', 'clients', 'stock_items',
  'stock_transactions', 'procedures', 'procedure_materials', 'financial_entries'];

async function runBackup(env) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('backup: server_misconfigured'); return;
  }

  const svc = (path) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  });

  const ur = await svc('user_settings?select=user_id,google_refresh_token&backup_enabled=eq.true&google_refresh_token=not.is.null');
  if (!ur.ok) { console.error('backup: supabase_read_failed'); return; }
  const users = await ur.json();

  const today = new Date().toISOString().slice(0, 10);
  for (const u of users) {
    try {
      const token = await googleToken(u.google_refresh_token, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
      const dump = {};
      for (const t of TABLES) {
        const r = await svc(`${t}?user_id=eq.${u.user_id}&select=*`);
        const rows = r.ok ? await r.json() : [];
        dump[t] = rows.map((row) => { const { google_refresh_token, ...rest } = row; return rest; });
      }
      const folderId = await driveFolder(token);
      await driveUpload(token, folderId, `harmon-backup-${today}.json`, dump);
      await driveRetain(token, folderId, KEEP);
    } catch (e) {
      console.error('backup user', u.user_id, String((e && e.message) || e));
    }
  }
}

async function googleToken(refresh, id, secret) {
  const g = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: refresh, grant_type: 'refresh_token' }),
  });
  const tok = await g.json();
  if (!g.ok) throw new Error('google_refused:' + (tok.error || ''));
  return tok.access_token;
}

async function driveFolder(token) {
  const q = encodeURIComponent(`name='${FOLDER}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  if (d.files && d.files.length) return d.files[0].id;
  const c = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER, mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!c.ok) throw new Error('folder_failed');
  return (await c.json()).id;
}

async function driveUpload(token, folderId, filename, obj) {
  const meta = { name: filename, parents: [folderId], mimeType: 'application/json' };
  const boundary = 'harmon' + Math.random().toString(16).slice(2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(obj)}\r\n` +
    `--${boundary}--`;
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!r.ok) throw new Error('upload_failed:' + r.status);
  return r.json();
}

async function driveRetain(token, folderId, keep) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType='application/json'`);
  const order = encodeURIComponent('createdTime desc');
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=${order}&fields=files(id)&pageSize=100`,
    { headers: { Authorization: `Bearer ${token}` } });
  const d = await r.json();
  for (const f of (d.files || []).slice(keep)) {
    await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  }
}
