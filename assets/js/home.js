// ============================================================================
// home.js — Início (item 1): visão geral do dia. Rota padrão do app. Painel de
// leitura: saudação, 3 mini-cards do mês, próximos agendamentos e, no painel
// direito, estoque crítico + clientes para retorno. Reaproveita a lógica que já
// existe (isLow do estoque, último proc. da Reativação). Tudo calculado ao abrir
// a tela — não há cron no projeto. RLS isola por usuário.
// ============================================================================
import { supabase } from './supabase.js';
import { profile } from './auth.js';
import { money, fmtDate, daysSince, esc, waLink, icon } from './utils.js';

const isLow = (i) => i.active !== false && Number(i.quantity || 0) <= Number(i.min_quantity || 0);
const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
};

export async function render(root, ctx) {
  const name = (profile(ctx.session).name || '').split(' ')[0] || 'por aqui';
  const month = new Date().toISOString().slice(0, 7);   // YYYY-MM
  const today = new Date().toLocaleDateString('en-CA');

  // skeleton com a forma do layout final (hero + 3 minis + painel + aside):
  // a troca por conteúdo real não "pula" — cada bloco já ocupa o próprio lugar
  const skMini = `<div class="mini">
    <div class="skeleton" style="width:40px;height:40px;border-radius:50%"></div>
    <div class="skeleton" style="width:70%;margin-top:12px"></div>
    <div class="skeleton" style="width:45%;margin-top:8px;height:18px"></div>
  </div>`;
  const skPanel = (rows) => `<div class="panel">
    <div class="skeleton" style="width:45%"></div>
    ${`<div class="skeleton" style="margin-top:16px"></div>`.repeat(rows)}
  </div>`;
  root.innerHTML = `<div class="home-grid">
    <div class="home-main">
      <div class="skeleton" style="height:148px;border-radius:var(--radius-xl)"></div>
      <div class="mini-cards">${skMini.repeat(3)}</div>
      ${skPanel(4)}
    </div>
    <div class="home-aside">${skPanel(3)}${skPanel(3)}</div>
  </div>`;
  const main = root.querySelector('.home-main');
  const aside = root.querySelector('.home-aside');

  const [cli, fin, stk, proc] = await Promise.all([
    supabase.from('clients').select('id, name, phone, created_at, active'),
    supabase.from('financial_entries').select('amount, type, paid, paid_at'),
    supabase.from('stock_items').select('name, quantity, min_quantity, unit, active'),
    supabase.from('procedures').select('date, status, client_id, clients(name), services(name)'),
  ]);
  if (cli.error || fin.error || stk.error || proc.error) {
    console.error(cli.error || fin.error || stk.error || proc.error);
    main.innerHTML = `<div class="empty"><div class="icon">${icon('warning')}</div><p>Não foi possível carregar o painel.</p></div>`;
    return;
  }

  const clients = cli.data || [], entries = fin.data || [], stock = stk.data || [], procs = proc.data || [];

  // ---- métricas do mês -------------------------------------------------------
  const novos = clients.filter((c) => (c.created_at || '').slice(0, 7) === month).length;
  let receita = 0, despesas = 0;
  for (const e of entries) {
    if (!e.paid || (e.paid_at || '').slice(0, 7) !== month) continue;   // regime de caixa
    if (e.type === 'income') receita += Number(e.amount) || 0;
    else despesas += Number(e.amount) || 0;
  }

  // ---- próximos agendamentos (procedures scheduled, hoje em diante) ----------
  const upcoming = procs
    .filter((p) => p.status === 'scheduled' && p.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);

  // ---- clientes para retorno (último proc. realizado há 60+ dias) ------------
  const last = new Map();
  for (const p of procs) {
    if (p.status !== 'completed' || !p.client_id || !p.date) continue;
    if (!last.has(p.client_id) || p.date > last.get(p.client_id)) last.set(p.client_id, p.date);
  }
  const retornos = clients
    .filter((c) => c.active !== false)
    .map((c) => ({ ...c, _last: last.get(c.id) || null, _days: daysSince(last.get(c.id)) }))
    .filter((c) => c._last && c._days >= 60)
    .sort((a, b) => b._days - a._days)
    .slice(0, 6);

  const lowItems = stock.filter(isLow);

  // ---- render ----------------------------------------------------------------
  const miniCard = (ic, tint, label, value) => `
    <div class="mini">
      <div class="mini__icon" style="background:${tint}">${icon(ic)}</div>
      <div class="mini__label">${label}</div>
      <div class="mini__value">${value}</div>
    </div>`;

  main.innerHTML = `
    <div class="hero">
      <div>
        <div class="hero__label">${greeting()}</div>
        <div class="hero__title">Olá, ${esc(name)} ${icon('sparkle')}</div>
        <div class="hero__sub">${upcoming.length
          ? `${upcoming.length} agendamento${upcoming.length > 1 ? 's' : ''} pela frente.`
          : 'Nenhum agendamento futuro no momento.'}</div>
      </div>
      <button class="btn btn--primary btn--pill" id="go-agenda">${icon('plus')} Agendar</button>
    </div>

    <div class="mini-cards">
      ${miniCard('users', 'var(--color-mauve-100)', 'Novos clientes no mês', novos)}
      ${miniCard('wallet', 'var(--color-mauve-100)', 'Recebido no mês', money(receita))}
      ${miniCard('wallet', 'var(--color-mauve-100)', 'Despesas no mês', money(despesas))}
    </div>

    <div class="panel">
      <div class="panel__title">Próximos agendamentos</div>
      ${upcoming.length ? upcoming.map((p) => `
        <div class="panel__row">
          <span class="grow">${esc(p.clients?.name || 'Cliente')}
            <div class="sub">${esc(p.services?.name || 'Procedimento')}</div></span>
          <span class="nowrap muted">${fmtDate(p.date)}</span>
        </div>`).join('')
        : '<p class="faint">Nada agendado. Use “Agendar” para criar.</p>'}
    </div>`;

  aside.innerHTML = `
    <div class="panel">
      <div class="panel__title">${icon('box')} Estoque crítico</div>
      ${lowItems.length ? lowItems.slice(0, 8).map((i) => `
        <div class="panel__row">
          <span class="grow">${esc(i.name)}</span>
          <span class="badge badge--warning">${Number(i.quantity)} ${esc(i.unit || '')}</span>
        </div>`).join('') + (lowItems.length > 8 ? `<div class="panel__row faint">+${lowItems.length - 8} itens</div>` : '')
        : '<p class="faint">Estoque em dia.</p>'}
      ${lowItems.length ? '<button class="btn btn--ghost btn--sm mt-4" id="go-estoque">Ver estoque</button>' : ''}
    </div>

    <div class="panel">
      <div class="panel__title">${icon('bell')} Clientes para retorno</div>
      ${retornos.length ? retornos.map((c) => `
        <div class="panel__row">
          <span class="grow">${esc(c.name)}<div class="sub">há ${c._days} dias</div></span>
          ${c.phone ? `<a class="btn btn--secondary btn--sm" target="_blank" rel="noopener"
            href="${waLink(c.phone, `Oi ${esc(c.name.split(' ')[0])}! Que tal agendar seu retorno? 💛`)}">${icon('whatsapp')}</a>` : ''}
        </div>`).join('')
        : '<p class="faint">Ninguém parado há 60+ dias.</p>'}
    </div>`;

  root.querySelector('#go-agenda')?.addEventListener('click', () => ctx.navigate('agenda'));
  aside.querySelector('#go-estoque')?.addEventListener('click', () => ctx.navigate('estoque'));
}
