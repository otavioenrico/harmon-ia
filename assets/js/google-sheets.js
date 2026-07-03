// ============================================================================
// google-sheets.js — exporta dados do app para uma planilha NOVA no Google Drive
// (Sheets API v4). ESPELHO: cria um arquivo a cada exportação; não lê nem grava
// de volta no Supabase (a fonte da verdade). Usa o escopo drive.file (só arquivos
// criados pelo próprio app), reaproveitando o token do google-cal.js.
// ============================================================================
import { accessToken, NeedsReconnect } from './google-cal.js';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';

// Escopo de Drive/Sheets ainda não concedido (reconectar Google).
export class NeedsScope extends Error {
  constructor() { super('Reconecte sua conta Google e autorize o Google Drive/Sheets.'); this.code = 'no_sheets_scope'; }
}

async function call(url, opts = {}) {
  const t = await accessToken();
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...opts.headers } });
  if (r.status === 401) throw new Error('Sessão do Google expirada. Tente de novo.');
  if (r.status === 403) throw new NeedsScope();
  if (!r.ok) { const e = new Error(`Sheets API ${r.status}`); e.status = r.status; throw e; }
  return r.json();
}

// Cria uma planilha com uma aba, escreve as linhas e deixa o cabeçalho em negrito
// + colunas auto-ajustadas. header: string[]; rows: (string|number)[][].
// Devolve a URL do arquivo no Drive.
export async function createSheet({ title, tabTitle = 'Dados', header, rows }) {
  const created = await call(SHEETS, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: [{ properties: { title: tabTitle, gridProperties: { frozenRowCount: 1 } } }],
    }),
  });
  const id = created.spreadsheetId;
  const sheetId = created.sheets?.[0]?.properties?.sheetId ?? 0;

  // valores (USER_ENTERED: números entram como número, texto como texto)
  const range = encodeURIComponent(`'${tabTitle}'!A1`);
  await call(`${SHEETS}/${id}/values/${range}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({ values: [header, ...rows] }),
  });

  // formatação: cabeçalho em negrito + auto-resize das colunas
  await call(`${SHEETS}/${id}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ requests: [
      { repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true } } },
        fields: 'userEnteredFormat.textFormat.bold',
      } },
      { autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: header.length },
      } },
    ] }),
  });

  return created.spreadsheetUrl;
}

export { NeedsReconnect };
