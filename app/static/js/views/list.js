/* Alert list / dashboard view */
import { el, clear, statusBadge, txt } from '../dom.js';
import { listAlerts, deleteAlert } from '../api.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { showToast, confirmDialog, setAppBusy } from '../ui.js';

const main = document.getElementById('main');

export async function renderList() {
  setAppBusy(true);
  renderLoading();
  try {
    const data = await listAlerts({ limit: state.limit, offset: state.offset });
    state.alerts = data.items;
    state.total = data.total;
    state.status = 'idle';
    renderDashboard();
  } catch (err) {
    state.status = 'error';
    state.error = err;
    renderError(err);
  } finally {
    setAppBusy(false);
  }
}

function renderLoading() {
  clear(main);
  const header = el('div', { class: 'page-header' });
  const titleBlock = el('div', { class: 'page-header-title' });
  const h1 = el('h1');
  h1.textContent = 'Fraud Alerts';
  titleBlock.appendChild(h1);
  header.appendChild(titleBlock);
  main.appendChild(header);

  // Skeleton metrics
  const metrics = el('div', { class: 'metrics-grid', 'aria-hidden': 'true' });
  for (let i = 0; i < 4; i++) {
    const card = el('div', { class: 'metric-card' });
    card.appendChild(el('div', { class: 'skeleton', style: 'height:12px;width:60%;margin-bottom:8px' }));
    card.appendChild(el('div', { class: 'skeleton', style: 'height:32px;width:40%' }));
    metrics.appendChild(card);
  }
  main.appendChild(metrics);

  // Skeleton rows
  const wrap = el('div', { class: 'card' });
  for (let i = 0; i < 5; i++) {
    const row = el('div', { class: 'skeleton-row', style: 'padding:12px 0;border-bottom:1px solid var(--color-border)' });
    row.appendChild(el('div', { class: 'skeleton', style: 'height:14px;width:85%' }));
    row.appendChild(el('div', { class: 'skeleton', style: 'height:12px;width:50%' }));
    wrap.appendChild(row);
  }
  main.appendChild(wrap);
}

function renderError(err) {
  clear(main);
  const banner = el('div', { class: 'error-banner', role: 'alert' });
  const icon = el('span', { class: 'error-banner-icon', 'aria-hidden': 'true' });
  icon.textContent = '✕';
  banner.appendChild(icon);
  const body = el('div', { class: 'error-banner-body' });
  const title = el('div', { class: 'error-banner-title' });
  title.textContent = 'Failed to load alerts';
  body.appendChild(title);
  const msg = el('p');
  msg.textContent = err.message || 'Unknown error';
  body.appendChild(msg);
  const retryBtn = el('button', { class: 'btn btn-secondary', style: 'margin-top:12px' });
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', renderList);
  body.appendChild(retryBtn);
  banner.appendChild(body);
  main.appendChild(banner);
}

function renderDashboard() {
  clear(main);

  // Page header
  const header = el('div', { class: 'page-header' });
  const titleBlock = el('div', { class: 'page-header-title' });
  const h1 = el('h1');
  h1.textContent = 'Fraud Alerts';
  const subtitle = el('p', { class: 'text-muted' });
  subtitle.textContent = `${state.total} alert${state.total !== 1 ? 's' : ''} total`;
  titleBlock.appendChild(h1);
  titleBlock.appendChild(subtitle);
  const actions = el('div', { class: 'page-actions' });
  const newBtn = el('a', { href: '#/alerts/new', class: 'btn btn-primary' });
  newBtn.textContent = '+ New Alert';
  actions.appendChild(newBtn);
  header.appendChild(titleBlock);
  header.appendChild(actions);
  main.appendChild(header);

  // Metrics
  const alerts = state.alerts;
  const counts = computeMetrics(alerts);
  const metrics = el('div', { class: 'metrics-grid', 'aria-label': 'Summary metrics' });
  metrics.appendChild(metricCard('Total', state.total));
  metrics.appendChild(metricCard('Non-Compliant', counts.nonCompliant));
  metrics.appendChild(metricCard('Escalate', counts.escalate));
  metrics.appendChild(metricCard('High Priority', counts.high));
  main.appendChild(metrics);

  if (alerts.length === 0) {
    main.appendChild(renderEmpty());
    return;
  }

  // Table (desktop)
  const tableWrap = el('div', { class: 'card alert-table-wrap' });
  const table = buildTable(alerts);
  tableWrap.appendChild(table);
  main.appendChild(tableWrap);

  // Cards (mobile)
  const cards = el('div', { class: 'alert-cards', 'aria-label': 'Alert list' });
  for (const alert of alerts) {
    cards.appendChild(buildAlertCard(alert));
  }
  main.appendChild(cards);

  // Pagination
  if (state.total > state.limit || state.offset > 0) {
    main.appendChild(buildPagination());
  }
}

function computeMetrics(alerts) {
  let nonCompliant = 0, escalate = 0, high = 0;
  for (const a of alerts) {
    if (a.overall_compliance?.overall_status?.toUpperCase().includes('NON_COMP')) nonCompliant++;
    if (a.decision_support?.workflow_classification?.final_verdict?.toUpperCase() === 'ESCALATE') escalate++;
    if (a.decision_support?.investigation_priority?.priority_band?.toUpperCase() === 'HIGH') high++;
  }
  return { nonCompliant, escalate, high };
}

function metricCard(label, value) {
  const card = el('div', { class: 'metric-card' });
  const lbl = el('div', { class: 'metric-label' });
  lbl.textContent = label;
  const val = el('div', { class: 'metric-value' });
  val.textContent = String(value);
  card.appendChild(lbl);
  card.appendChild(val);
  return card;
}

function renderEmpty() {
  const empty = el('div', { class: 'empty-state' });
  const icon = el('div', { class: 'empty-icon', 'aria-hidden': 'true' });
  icon.textContent = '🔍';
  const title = el('div', { class: 'empty-title' });
  title.textContent = 'No fraud alerts yet';
  const desc = el('div', { class: 'empty-desc' });
  desc.textContent = 'Create your first alert to get started.';
  const btn = el('a', { href: '#/alerts/new', class: 'btn btn-primary' });
  btn.textContent = '+ Create Alert';
  empty.appendChild(icon);
  empty.appendChild(title);
  empty.appendChild(desc);
  empty.appendChild(btn);
  return empty;
}

function buildTable(alerts) {
  const table = el('table', { class: 'alert-table', 'aria-label': 'Fraud alerts' });
  const thead = el('thead');
  const hrow = el('tr');
  for (const h of ['Transaction ID', 'Parties', 'Amount', 'Compliance', 'Priority', 'Verdict', 'Updated', 'Actions']) {
    const th = el('th');
    th.textContent = h;
    hrow.appendChild(th);
  }
  thead.appendChild(hrow);
  table.appendChild(thead);

  const tbody = el('tbody');
  for (const alert of alerts) {
    tbody.appendChild(buildTableRow(alert));
  }
  table.appendChild(tbody);
  return table;
}

function buildTableRow(alert) {
  const tr = el('tr');

  // Transaction ID
  const tdId = el('td');
  const idSpan = el('span', { class: 'mono' });
  idSpan.textContent = alert.transaction_id;
  tdId.appendChild(idSpan);
  tr.appendChild(tdId);

  // Parties
  const tdParties = el('td');
  const origName = el('div');
  origName.textContent = alert.transaction_information?.originator_name ?? '—';
  const arrow = el('div', { class: 'text-muted', style: 'font-size:0.75rem' });
  arrow.textContent = '→ ' + (alert.transaction_information?.beneficiary_name ?? '—');
  tdParties.appendChild(origName);
  tdParties.appendChild(arrow);
  tr.appendChild(tdParties);

  // Amount
  const tdAmt = el('td');
  const amt = alert.transaction_information?.amount;
  const cur = alert.transaction_information?.currency ?? '';
  tdAmt.textContent = amt != null ? `${amt.toLocaleString()} ${cur}` : '—';
  tr.appendChild(tdAmt);

  // Compliance
  const tdComp = el('td');
  tdComp.appendChild(statusBadge(alert.overall_compliance?.overall_status));
  tr.appendChild(tdComp);

  // Priority
  const tdPri = el('td');
  tdPri.appendChild(statusBadge(alert.decision_support?.investigation_priority?.priority_band));
  tr.appendChild(tdPri);

  // Verdict
  const tdVerdict = el('td');
  tdVerdict.appendChild(statusBadge(alert.decision_support?.workflow_classification?.final_verdict));
  tr.appendChild(tdVerdict);

  // Updated
  const tdUpd = el('td', { class: 'text-muted', style: 'font-size:0.82rem;white-space:nowrap' });
  tdUpd.textContent = alert.updated_at ? new Date(alert.updated_at).toLocaleString() : '—';
  tr.appendChild(tdUpd);

  // Actions
  const tdAct = el('td', { class: 'col-actions' });
  const viewBtn = el('a', { href: `#/alerts/${encodeURIComponent(alert.id)}`, class: 'btn btn-ghost btn-sm' });
  viewBtn.textContent = 'View';
  const editBtn = el('a', { href: `#/alerts/${encodeURIComponent(alert.id)}/edit`, class: 'btn btn-ghost btn-sm' });
  editBtn.textContent = 'Edit';
  const delBtn = el('button', { class: 'btn btn-ghost btn-sm', style: 'color:var(--color-danger)' });
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => handleDelete(alert));
  tdAct.appendChild(viewBtn);
  tdAct.appendChild(editBtn);
  tdAct.appendChild(delBtn);
  tr.appendChild(tdAct);

  return tr;
}

function buildAlertCard(alert) {
  const card = el('div', { class: 'alert-card' });

  const top = el('div', { class: 'alert-card-top' });
  const titleEl = el('strong', { class: 'mono' });
  titleEl.textContent = alert.transaction_id;
  const badges = el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap' });
  badges.appendChild(statusBadge(alert.overall_compliance?.overall_status));
  badges.appendChild(statusBadge(alert.decision_support?.investigation_priority?.priority_band));
  top.appendChild(titleEl);
  top.appendChild(badges);
  card.appendChild(top);

  const meta = el('div', { class: 'alert-card-meta' });
  const parties = el('span');
  parties.textContent = `${alert.transaction_information?.originator_name ?? '?'} → ${alert.transaction_information?.beneficiary_name ?? '?'}`;
  const amt = el('span');
  const amtVal = alert.transaction_information?.amount;
  const cur = alert.transaction_information?.currency ?? '';
  amt.textContent = amtVal != null ? `${amtVal.toLocaleString()} ${cur}` : '—';
  const verdict = el('span');
  verdict.textContent = 'Verdict: ';
  verdict.appendChild(statusBadge(alert.decision_support?.workflow_classification?.final_verdict));
  meta.appendChild(parties);
  meta.appendChild(amt);
  meta.appendChild(verdict);
  card.appendChild(meta);

  const actionsEl = el('div', { class: 'alert-card-actions' });
  const viewBtn = el('a', { href: `#/alerts/${encodeURIComponent(alert.id)}`, class: 'btn btn-secondary btn-sm' });
  viewBtn.textContent = 'View';
  const editBtn = el('a', { href: `#/alerts/${encodeURIComponent(alert.id)}/edit`, class: 'btn btn-ghost btn-sm' });
  editBtn.textContent = 'Edit';
  const delBtn = el('button', { class: 'btn btn-ghost btn-sm', style: 'color:var(--color-danger)' });
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => handleDelete(alert));
  actionsEl.appendChild(viewBtn);
  actionsEl.appendChild(editBtn);
  actionsEl.appendChild(delBtn);
  card.appendChild(actionsEl);

  return card;
}

function buildPagination() {
  const wrap = el('div', { class: 'pagination' });
  const start = state.offset + 1;
  const end = Math.min(state.offset + state.limit, state.total);
  const info = el('span', { class: 'pagination-info' });
  info.textContent = `Showing ${start}–${end} of ${state.total}`;
  wrap.appendChild(info);

  const controls = el('div', { class: 'pagination-controls' });

  // Page size selector
  const pageSizeLabel = el('label', { for: 'page-size', class: 'sr-only' });
  pageSizeLabel.textContent = 'Items per page';
  const pageSizeSelect = el('select', { id: 'page-size', class: 'btn btn-secondary btn-sm' });
  for (const size of [25, 50, 100]) {
    const opt = el('option');
    opt.value = String(size);
    opt.textContent = String(size) + ' per page';
    if (size === state.limit) opt.selected = true;
    pageSizeSelect.appendChild(opt);
  }
  pageSizeSelect.addEventListener('change', () => {
    state.limit = Number(pageSizeSelect.value);
    state.offset = 0;
    renderList();
  });
  controls.appendChild(pageSizeLabel);
  controls.appendChild(pageSizeSelect);

  const prevBtn = el('button', { class: 'btn btn-secondary btn-sm' });
  prevBtn.textContent = '← Previous';
  if (state.offset === 0) prevBtn.disabled = true;
  prevBtn.addEventListener('click', () => {
    state.offset = Math.max(0, state.offset - state.limit);
    renderList();
  });

  const nextBtn = el('button', { class: 'btn btn-secondary btn-sm' });
  nextBtn.textContent = 'Next →';
  if (state.offset + state.limit >= state.total) nextBtn.disabled = true;
  nextBtn.addEventListener('click', () => {
    state.offset += state.limit;
    renderList();
  });

  controls.appendChild(prevBtn);
  controls.appendChild(nextBtn);
  wrap.appendChild(controls);
  return wrap;
}

async function handleDelete(alert) {
  const confirmed = await confirmDialog(
    `Delete alert "${alert.transaction_id}" (${alert.id.slice(0, 8)}…)? This cannot be undone.`
  );
  if (!confirmed) return;
  try {
    await deleteAlert(alert.id);
    showToast('Alert deleted.', 'success');
    state.offset = Math.max(0, state.offset);
    await renderList();
  } catch (err) {
    showToast(`Delete failed: ${err.message}`, 'error');
  }
}
