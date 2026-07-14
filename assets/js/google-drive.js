// ============================================================================
// google-drive.js — sobe arquivos para o Google Drive do usuário (Drive API v3).
// Usado no backup manual ("Fazer backup no Drive agora"). ESPELHO/cofre: cria
// arquivos do app; nada volta pro Supabase. Escopo drive.file (só arquivos do
// app), token compartilhado do google-cal.js. O backup automático semanal roda
// no servidor (worker/index.js), não aqui.
// ============================================================================
import { accessToken, NeedsReconnect } from './google-cal.js';

const DRIVE = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

export class NeedsScope extends Error {
  constructor() { super('Reconecte sua conta Google e autorize o Google Drive.'); this.code = 'no_drive_scope'; }
}

async function jget(url) {
  const t = await accessToken();
  const r = await fetch(url, { headers: { Authorization: `Bearer ${t}` } });
  if (r.status === 403) throw new NeedsScope();
  if (!r.ok) throw new Error(`Drive ${r.status}`);
  return r.json();
}

// acha a pasta pelo nome (drive.file só lista arquivos do app) ou cria.
async function findOrCreateFolder(name) {
  const q = encodeURIComponent(`name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const found = await jget(`${DRIVE}/files?q=${q}&spaces=drive&fields=files(id)`);
  if (found.files?.length) return found.files[0].id;
  const t = await accessToken();
  const r = await fetch(`${DRIVE}/files?fields=id`, {
    method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (r.status === 403) throw new NeedsScope();
  if (!r.ok) throw new Error(`Drive ${r.status}`);
  return (await r.json()).id;
}

// sobe um objeto como arquivo .json dentro da pasta (multipart: metadados + mídia).
export async function uploadJSON(folderName, filename, obj) {
  const folderId = await findOrCreateFolder(folderName);
  const meta = { name: filename, parents: [folderId], mimeType: 'application/json' };
  const boundary = 'harmon' + Math.random().toString(16).slice(2);
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(obj)}\r\n` +
    `--${boundary}--`;
  const t = await accessToken();
  const r = await fetch(UPLOAD, {
    method: 'POST',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (r.status === 403) throw new NeedsScope();
  if (!r.ok) throw new Error(`Drive ${r.status}`);
  return r.json();
}

export { NeedsReconnect };
