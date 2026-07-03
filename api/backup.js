// ============================================================================
// api/backup.js — Vercel Serverless + Cron (semanal). Para CADA usuária que
// LIGOU o backup (user_settings.backup_enabled), gera um JSON dos dados dela e
// sobe para o Google Drive DELA, mantendo os N mais recentes.
//
// Multi-tenant: lê com a SERVICE ROLE (contorna a RLS) e filtra por user_id, e
// usa o refresh_token de cada usuária para escrever no Drive dela. Protegido por
// CRON_SECRET (a Vercel envia Authorization: Bearer <CRON_SECRET> no cron).
//
// Env vars (Vercel): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID,
// GOOGLE_CLIENT_SECRET, CRON_SECRET.
// ============================================================================
const KEEP = 12;                       // quantos backups manter por usuária
const FOLDER = 'Harmon IA Backups';
const TABLES = ['user_settings', 'services', 'clients', 'stock_items',
  'stock_transactions', 'procedures', 'procedure_materials', 'financial_entries'];

export default async function handler(req, res) {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, CRON_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !CRON_SECRET)
    return res.status(500).json({ error: 'server_misconfigured' });

  // só o cron da Vercel (ou quem tiver o segredo) pode disparar
  if ((req.headers.authorization || '') !== `Bearer ${CRON_SECRET}`)
    return res.status(401).json({ error: 'unauthorized' });

  const svc = (path) => fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  });

  // usuárias com backup ligado e Google conectado
  const ur = await svc('user_settings?select=user_id,google_refresh_token&backup_enabled=eq.true&google_refresh_token=not.is.null');
  if (!ur.ok) return res.status(502).json({ error: 'supabase_read_failed' });
  const users = await ur.json();

  const today = new Date().toISOString().slice(0, 10);
  const results = [];
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
      results.push({ user: u.user_id, ok: true });
    } catch (e) {
      results.push({ user: u.user_id, ok: false, error: String(e && e.message || e) });
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ ran: results.length, results });
}

// ---- helpers (só `fetch` global, sem dependências) ----
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
