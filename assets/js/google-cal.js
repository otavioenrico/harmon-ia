// ============================================================================
// google-cal.js — acesso ao Google Calendar a partir do frontend.
// Pega um access_token fresco via /api/google-refresh (cacheado em memória até
// ~1min antes de expirar) e faz as chamadas da Calendar API v3 no calendário
// 'primary'. A agenda é a fonte da verdade — aqui não há gravação no Postgres.
// ============================================================================
import { supabase } from './supabase.js';

const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

let cached = null; // { token, exp }

// Erro especial: usuário sem refresh_token salvo (precisa reconectar o Google).
export class NeedsReconnect extends Error {
  constructor() { super('Conecte sua conta Google novamente para usar a Agenda.'); this.code = 'no_refresh_token'; }
}

async function token() {
  if (cached && cached.exp > Date.now()) return cached.token;
  const { data } = await supabase.auth.getSession();
  const jwt = data?.session?.access_token;
  if (!jwt) throw new Error('Sessão expirada.');
  const r = await fetch('/api/google-refresh', { method: 'POST', headers: { Authorization: `Bearer ${jwt}` } });
  if (r.status === 409) throw new NeedsReconnect();
  if (!r.ok) throw new Error('Não foi possível autenticar no Google Calendar.');
  const { access_token, expires_in } = await r.json();
  cached = { token: access_token, exp: Date.now() + (Number(expires_in || 3600) - 60) * 1000 };
  return access_token;
}

// Access token fresco compartilhado com outros módulos Google (People/Drive/
// Sheets). Reaproveita o mesmo cache em memória.
export async function accessToken() { return token(); }

async function call(url, opts = {}) {
  const t = await token();
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...opts.headers } });
  if (r.status === 401) { cached = null; throw new Error('Sessão do Google expirada. Tente de novo.'); }
  if (!r.ok) throw new Error(`Google Calendar respondeu ${r.status}.`);
  return r.status === 204 ? null : r.json();
}

// Lista eventos entre dois instantes (Date). singleEvents expande recorrências.
export async function listEvents(timeMin, timeMax) {
  const qs = new URLSearchParams({
    timeMin: timeMin.toISOString(), timeMax: timeMax.toISOString(),
    singleEvents: 'true', orderBy: 'startTime', maxResults: '250',
  });
  const data = await call(`${API}?${qs}`);
  return data.items || [];
}

// start/end: Date. Cria evento com horário (não dia inteiro).
export async function createEvent({ summary, description, start, end }) {
  return call(API, {
    method: 'POST',
    body: JSON.stringify({
      summary, description,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    }),
  });
}

// Atualiza um evento existente. PATCH (merge) — manda só os campos enviados.
export async function updateEvent(id, { summary, description, start, end }) {
  const patch = {};
  if (summary !== undefined) patch.summary = summary;
  if (description !== undefined) patch.description = description;
  if (start) patch.start = { dateTime: start.toISOString() };
  if (end) patch.end = { dateTime: end.toISOString() };
  return call(`${API}/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

export async function deleteEvent(id) {
  return call(`${API}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
