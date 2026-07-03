// ============================================================================
// google-people.js — espelha clientes no Google Contatos (People API v1).
// ESPELHO: o Supabase é a fonte da verdade; aqui só empurramos cópias (nada
// volta do Google para o banco). Mesmo padrão do google-cal.js — token fresco
// via /api/google-refresh, reaproveitando o cache exportado por google-cal.js.
// clients.google_contact_id guarda o resourceName ("people/c123…").
// ============================================================================
import { accessToken, NeedsReconnect } from './google-cal.js';

const BASE = 'https://people.googleapis.com/v1';
// campos que gravamos/atualizamos no contato.
const FIELDS = 'names,phoneNumbers,emailAddresses,addresses,birthdays,biographies';

// Escopo de Contatos ainda não concedido (usuário precisa reconectar o Google).
export class NeedsScope extends Error {
  constructor() { super('Reconecte sua conta Google e autorize o acesso aos Contatos.'); this.code = 'no_contacts_scope'; }
}

async function call(url, opts = {}) {
  const t = await accessToken();
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...opts.headers } });
  if (r.status === 401) throw new Error('Sessão do Google expirada. Tente de novo.');
  if (r.status === 403) throw new NeedsScope();               // faltou o escopo contacts
  if (!r.ok) { const e = new Error(`People API ${r.status}`); e.status = r.status; throw e; }
  return r.status === 204 ? null : r.json();
}

// client (linha do Supabase) -> corpo do "person". Só inclui o que existe.
function personBody(c) {
  const body = { names: [{ givenName: c.name || 'Cliente' }] };
  if (c.phone) body.phoneNumbers = [{ value: c.phone, type: 'mobile' }];
  if (c.email) body.emailAddresses = [{ value: c.email }];
  const street = [c.address_street, c.address_number].filter(Boolean).join(', ');
  if (street || c.address_city || c.address_zip) body.addresses = [{
    streetAddress: street || undefined,
    extendedAddress: c.address_complement || undefined,
    city: c.address_city || undefined,
    region: c.address_state || undefined,
    postalCode: c.address_zip || undefined,
    country: 'Brasil',
  }];
  if (c.birthdate) {
    const [y, m, d] = String(c.birthdate).split('-').map(Number);
    if (y && m && d) body.birthdays = [{ date: { year: y, month: m, day: d } }];
  }
  if (c.notes) body.biographies = [{ value: c.notes, contentType: 'TEXT_PLAIN' }];
  return body;
}

async function createContact(c) {
  const p = await call(`${BASE}/people:createContact`, { method: 'POST', body: JSON.stringify(personBody(c)) });
  return p.resourceName;                                       // "people/c123…"
}

async function updateContact(resourceName, c) {
  // updateContact exige o etag atual do contato — busca antes de gravar.
  const cur = await call(`${BASE}/${resourceName}?personFields=metadata`);
  const body = { ...personBody(c), etag: cur.etag };
  const url = `${BASE}/${resourceName}:updateContact?updatePersonFields=${encodeURIComponent(FIELDS)}`;
  const p = await call(url, { method: 'PATCH', body: JSON.stringify(body) });
  return p.resourceName;
}

// Cria ou atualiza; devolve o resourceName p/ salvar em clients.google_contact_id.
// Se o resourceName guardado sumiu no Google (404/400), recria do zero.
export async function upsertContact(client) {
  if (!client.google_contact_id) return createContact(client);
  try { return await updateContact(client.google_contact_id, client); }
  catch (e) {
    if (e.status === 404 || e.status === 400) return createContact(client);
    throw e;
  }
}

export async function deleteContact(resourceName) {
  if (!resourceName) return;
  try { await call(`${BASE}/${resourceName}:deleteContact`, { method: 'DELETE' }); }
  catch (e) { if (e.status !== 404) throw e; }                 // já não existe = ok
}

export { NeedsReconnect };
