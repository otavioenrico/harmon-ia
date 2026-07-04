// ============================================================================
// home.js — Início (item 1): visão geral do dia. Rota padrão do app. Painel de
// leitura: saudação, 3 mini-cards do mês, próximos agendamentos e, no painel
// direito, estoque crítico + clientes para retorno. Reaproveita a lógica que já
// existe (isLow do estoque, último proc. da Reativação). Tudo calculado ao abrir
// a tela — não há cron no projeto. RLS isola por usuário.
// ============================================================================
import { supabase } from './supabase.js';
import { profile } from './auth.js';
import { listEvents, NeedsReconnect } from './google-cal.js';
import { money, fmtDate, daysSince, esc, waLink, icon, guard, toast } from './utils.js';

const isLow = (i) => i.active !== false && Number(i.quantity || 0) <= Number(i.min_quantity || 0);
const evStart = (e) => new Date(e.start?.dateTime || `${e.start?.date}T00:00:00`);
const hhmm = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

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

  const [cli, fin, stk, proc, dis] = await Promise.all([
    supabase.from('clients').select('id, name, phone, created_at, active'),
    supabase.from('financial_entries').select('amount, type, paid, paid_at'),
    supabase.from('stock_items').select('name, quantity, min_quantity, unit, active'),
    supabase.from('procedures').select('date, status, client_id, service_id, google_event_id, clients(name), services(name)'),
    supabase.from('return_dismissals').select('client_id, service_id, months, dismissed_at'),
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

  // horário/duração vêm do Google Calendar (procedures.date não tem hora). Se a
  // conta Google não estiver conectada, cai de volta pra só mostrar a data.
  const eventByGid = new Map();
  const withGid = upcoming.filter((p) => p.google_event_id);
  if (withGid.length) {
    try {
      const min = new Date();
      const lastDate = withGid.reduce((m, p) => (p.date > m ? p.date : m), withGid[0].date);
      const max = new Date(Math.max(new Date(`${lastDate}T00:00:00`).getTime() + 86400000, min.getTime() + 30 * 86400000));
      for (const e of await listEvents(min, max)) eventByGid.set(e.id, e);
    } catch (err) { if (!(err instanceof NeedsReconnect)) console.error(err); }
  }
  // item 3.2: data e duração viram colunas separadas da tabela
  const whenLabel = (p) => {
    const ev = p.google_event_id && eventByGid.get(p.google_event_id);
    if (!ev?.start?.dateTime) return fmtDate(p.date);
    return `${fmtDate(p.date)} às ${hhmm(evStart(ev))}`;
  };
  const durLabel = (p) => {
    const ev = p.google_event_id && eventByGid.get(p.google_event_id);
    if (!ev?.start?.dateTime || !ev.end?.dateTime) return '—';
    return `${Math.round((new Date(ev.end.dateTime) - evStart(ev)) / 60000)} minutos`;
  };

  // ---- clientes para retorno (item 3.3): mesma lógica de Histórico > Retornos —
  // por cliente+serviço, marcos de 1/3/6/12 meses com dismissal por marco em
  // return_dismissals. Sem seletor aqui: mostra o MENOR marco vencido e ainda
  // não dispensado desde o último procedimento daquele serviço.
  const MARCOS = [1, 3, 6, 12];               // mês ≈ 30 dias (mesmo teto do Histórico)
  const lastCS = new Map();
  for (const p of procs) {
    if (p.status !== 'completed' || !p.client_id || !p.service_id || !p.date) continue;
    const k = `${p.client_id}|${p.service_id}`;
    const cur = lastCS.get(k);
    if (!cur || p.date > cur.date) lastCS.set(k, {
      client_id: p.client_id, service_id: p.service_id, date: p.date, service: p.services?.name });
  }
  const dismissed = new Map((dis.data || []).map((d) => [`${d.client_id}|${d.service_id}|${d.months}`, d.dismissed_at]));
  const activeClients = new Map(clients.filter((c) => c.active !== false).map((c) => [c.id, c]));
  const retornos = [...lastCS.values()].map((r) => {
    const c = activeClients.get(r.client_id);
    if (!c) return null;
    const days = daysSince(r.date);
    const marco = MARCOS.find((m) => days >= m * 30 &&
      (dismissed.get(`${r.client_id}|${r.service_id}|${m}`) || '').slice(0, 10) < r.date);
    return marco ? { ...r, name: c.name, phone: c.phone, _days: days, _marco: marco } : null;
  }).filter(Boolean).sort((a, b) => b._days - a._days).slice(0, 6);

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
        <div class="hero__title">Olá, ${esc(name)} ${icon('sparkle')}</div>
      </div>
      <div class="hero__actions">
        <button class="btn btn--primary" id="go-agenda">${icon('plus')} Novo agendamento</button>
        <button class="btn btn--secondary" id="go-calendario">${icon('calendar')} <span class="full-label">Ver calendário</span><span class="short-label">Calendário</span></button>
        <button class="btn btn--secondary" id="go-cliente">${icon('users')} <span class="full-label">Novo cliente</span><span class="short-label">+ Cliente</span></button>
        <button class="btn btn--secondary" id="go-produto">${icon('box')} <span class="full-label">Novo produto</span><span class="short-label">+ Produto</span></button>
        <button class="btn btn--secondary" id="go-lancamento">${icon('wallet')} <span class="full-label">Novo lançamento</span><span class="short-label">+ Lançamento</span></button>
      </div>
    </div>

    <div class="mini-cards">
      ${miniCard('users', 'var(--color-mauve-100)', 'Novos clientes no mês', novos)}
      ${miniCard('wallet', 'var(--color-mauve-100)', 'Recebido no mês', money(receita))}
      ${miniCard('wallet', 'var(--color-mauve-100)', 'Despesas no mês', money(despesas))}
    </div>

    <div class="panel">
      <div class="panel__title">Próximos agendamentos</div>
      ${upcoming.length ? `
        <table class="data">
          <thead><tr><th>Cliente</th><th>Procedimento</th><th>Duração</th><th>Data</th></tr></thead>
          <tbody>${upcoming.map((p) => `
            <tr>
              <td>${esc(p.clients?.name || 'Cliente')}</td>
              <td data-th="Procedimento">${esc(p.services?.name || 'Procedimento')}</td>
              <td class="nowrap" data-th="Duração">${durLabel(p)}</td>
              <td class="nowrap muted" data-th="Data">${whenLabel(p)}</td>
            </tr>`).join('')}</tbody>
        </table>`
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
      ${retornos.length ? retornos.map((r) => `
        <div class="panel__row" data-cli="${r.client_id}" data-svc="${r.service_id}" data-m="${r._marco}">
          <span class="grow">${esc(r.name)}
            <div class="sub">${esc(r.service || '—')} · ${r._marco} ${r._marco === 1 ? 'mês' : 'meses'} · há ${r._days} dias</div></span>
          ${r.phone ? `<a class="btn btn--secondary btn--sm" target="_blank" rel="noopener"
            href="${waLink(r.phone, `Oi ${esc(r.name.split(' ')[0])}! Que tal agendar seu retorno? 💛`)}">${icon('whatsapp')}</a>` : ''}
          <button class="btn btn--icon btn--ghost" data-ok title="Concluir — volta a avisar no próximo marco">${icon('check')}</button>
        </div>`).join('')
        : '<p class="faint">Nenhum retorno pendente.</p>'}
    </div>`;

  // ✓ grava o dismissal do marco mostrado (mesmo upsert de Histórico > Retornos)
  aside.querySelectorAll('[data-ok]').forEach((b) => b.onclick = guard(async () => {
    const rowEl = b.closest('.panel__row');
    const { error } = await supabase.from('return_dismissals').upsert({
      user_id: ctx.session.user.id, client_id: rowEl.dataset.cli,
      service_id: rowEl.dataset.svc, months: Number(rowEl.dataset.m),
      dismissed_at: new Date().toISOString(),
    }, { onConflict: 'user_id,client_id,service_id,months' });
    if (error) { console.error(error); return toast('Erro ao concluir.', 'error'); }
    rowEl.remove();
    toast('Marcado como contatado.');
  }));

  root.querySelector('#go-agenda')?.addEventListener('click', () => {
    sessionStorage.setItem('intent:novoAgendamento', '1'); ctx.navigate('agenda');
  });
  root.querySelector('#go-calendario')?.addEventListener('click', () => {
    sessionStorage.setItem('intent:agendaCalendario', '1'); ctx.navigate('agenda');
  });
  root.querySelector('#go-cliente')?.addEventListener('click', () => {
    sessionStorage.setItem('intent:novoCliente', '1'); ctx.navigate('clientes');
  });
  root.querySelector('#go-produto')?.addEventListener('click', () => {
    sessionStorage.setItem('intent:novoProduto', '1'); ctx.navigate('estoque');
  });
  root.querySelector('#go-lancamento')?.addEventListener('click', () => {
    sessionStorage.setItem('intent:novoLancamento', '1'); ctx.navigate('financeiro');
  });
  aside.querySelector('#go-estoque')?.addEventListener('click', () => ctx.navigate('estoque'));

  heroActionsScroll(root.querySelector('.hero__actions'));
}

// faixa de ações da hero: fade nas bordas só quando estoura o card + scroll por clicar-e-arrastar
function heroActionsScroll(el) {
  if (!el) return;
  const syncFade = () => el.classList.toggle('is-overflowing', el.scrollWidth > el.clientWidth + 1);
  syncFade();
  window.addEventListener('resize', syncFade);
  let dragging = false, startX = 0, startScroll = 0;
  el.addEventListener('pointerdown', (e) => {
    dragging = true; startX = e.clientX; startScroll = el.scrollLeft;
    el.setPointerCapture(e.pointerId); el.classList.add('is-dragging');
  });
  el.addEventListener('pointermove', (e) => {
    if (dragging) el.scrollLeft = startScroll - (e.clientX - startX);
  });
  const stopDrag = () => { dragging = false; el.classList.remove('is-dragging'); };
  el.addEventListener('pointerup', stopDrag);
  el.addEventListener('pointercancel', stopDrag);
}
