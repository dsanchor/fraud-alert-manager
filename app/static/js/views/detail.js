/* Detail view */
import { el, clear, statusBadge, detailField, detailBadgeField, detailListField } from '../dom.js';
import { getAlert, deleteAlert } from '../api.js';
import { state } from '../state.js';
import { navigate } from '../router.js';
import { showToast, confirmDialog, setAppBusy } from '../ui.js';

const main = document.getElementById('main');

export async function renderDetail({ id }) {
  setAppBusy(true);
  clear(main);
  // Loading indicator
  const loadingEl = el('p', { class: 'text-muted', style: 'padding:2rem 0' });
  loadingEl.textContent = 'Loading alert…';
  const spinner = el('span', { class: 'spinner', 'aria-hidden': 'true', style: 'margin-right:8px' });
  loadingEl.prepend(spinner);
  main.appendChild(loadingEl);

  try {
    const alert = await getAlert(decodeURIComponent(id));
    state.current = alert;
    renderAlertDetail(alert);
  } catch (err) {
    clear(main);
    if (err.status === 404) {
      render404(id);
    } else {
      renderDetailError(err, id);
    }
  } finally {
    setAppBusy(false);
  }
}

function render404(id) {
  const wrap = el('div', { class: 'empty-state' });
  const icon = el('div', { class: 'empty-icon', 'aria-hidden': 'true' });
  icon.textContent = '🔍';
  const title = el('div', { class: 'empty-title' });
  title.textContent = 'Alert not found';
  const desc = el('div', { class: 'empty-desc' });
  desc.textContent = `No alert with ID "${decodeURIComponent(id)}" exists.`;
  const back = el('a', { href: '#/alerts', class: 'btn btn-secondary' });
  back.textContent = '← Back to Alerts';
  wrap.appendChild(icon);
  wrap.appendChild(title);
  wrap.appendChild(desc);
  wrap.appendChild(back);
  main.appendChild(wrap);
}

function renderDetailError(err, id) {
  const banner = el('div', { class: 'error-banner', role: 'alert' });
  const icon = el('span', { class: 'error-banner-icon', 'aria-hidden': 'true' });
  icon.textContent = '✕';
  banner.appendChild(icon);
  const body = el('div', { class: 'error-banner-body' });
  const title = el('div', { class: 'error-banner-title' });
  title.textContent = 'Failed to load alert';
  body.appendChild(title);
  const msg = el('p');
  msg.textContent = err.message;
  body.appendChild(msg);
  const actions = el('div', { style: 'display:flex;gap:8px;margin-top:12px' });
  const retryBtn = el('button', { class: 'btn btn-secondary' });
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', () => renderDetail({ id }));
  const backBtn = el('a', { href: '#/alerts', class: 'btn btn-ghost' });
  backBtn.textContent = '← Back';
  actions.appendChild(retryBtn);
  actions.appendChild(backBtn);
  body.appendChild(actions);
  banner.appendChild(body);
  main.appendChild(banner);
}

function renderAlertDetail(alert) {
  clear(main);

  // Page header
  const header = el('div', { class: 'page-header' });
  const titleBlock = el('div', { class: 'page-header-title' });
  const h1 = el('h1', { class: 'mono' });
  h1.textContent = alert.transaction_id;
  const sub = el('p', { class: 'text-muted', style: 'font-size:0.82rem' });
  sub.textContent = `ID: ${alert.id}`;
  titleBlock.appendChild(h1);
  titleBlock.appendChild(sub);
  header.appendChild(titleBlock);

  const actions = el('div', { class: 'page-actions' });
  const backBtn = el('a', { href: '#/alerts', class: 'btn btn-ghost' });
  backBtn.textContent = '← Back';
  const editBtn = el('a', { href: `#/alerts/${encodeURIComponent(alert.id)}/edit`, class: 'btn btn-secondary' });
  editBtn.textContent = 'Edit';
  const delBtn = el('button', { class: 'btn btn-danger' });
  delBtn.textContent = 'Delete';
  delBtn.addEventListener('click', () => handleDelete(alert));
  actions.appendChild(backBtn);
  actions.appendChild(editBtn);
  actions.appendChild(delBtn);
  header.appendChild(actions);
  main.appendChild(header);

  // Server metadata strip
  const meta = el('div', { class: 'card card-sm', style: 'margin-bottom:20px' });
  const metaRow = el('div', { class: 'meta-row' });
  appendMeta(metaRow, 'ID', alert.id, true);
  appendMeta(metaRow, 'Version', alert.version);
  appendMeta(metaRow, 'Created', new Date(alert.created_at).toLocaleString());
  appendMeta(metaRow, 'Updated', new Date(alert.updated_at).toLocaleString());
  meta.appendChild(metaRow);
  main.appendChild(meta);

  // Detail sections grid
  const grid = el('div', { class: 'detail-grid' });

  // Transaction information
  const txSection = detailSection('Transaction Information');
  const txFields = el('div', { class: 'detail-fields' });
  const ti = alert.transaction_information;
  txFields.appendChild(detailField('Originator', ti?.originator_name));
  txFields.appendChild(detailField('Origin Account', ti?.origin_account, true));
  txFields.appendChild(detailField('Bank (Origin)', ti?.bank_origin, true));
  txFields.appendChild(detailField('Beneficiary', ti?.beneficiary_name));
  txFields.appendChild(detailField('Destination Account', ti?.destination_account, true));
  txFields.appendChild(detailField('Bank (Destination)', ti?.bank_destination, true));
  const amtEl = el('div', { class: 'detail-field' });
  amtEl.appendChild(el('span', { class: 'detail-field-label' }, 'Amount'));
  const amtVal = el('span', { class: 'detail-field-value' });
  amtVal.textContent = ti?.amount != null ? `${ti.amount.toLocaleString()} ${ti.currency ?? ''}` : '—';
  amtEl.appendChild(amtVal);
  txFields.appendChild(amtEl);
  txSection.appendChild(txFields);
  grid.appendChild(txSection);

  // Overall compliance
  const compSection = detailSection('Overall Compliance');
  const compFields = el('div', { class: 'detail-fields' });
  const oc = alert.overall_compliance;
  compFields.appendChild(detailBadgeField('Status', oc?.overall_status));
  compFields.appendChild(detailField('Non-Compliant Rules', oc?.non_compliant_rule_count));
  compFields.appendChild(detailField('Potential Gap Rules', oc?.potential_gap_rule_count));
  compFields.appendChild(detailField('Insufficient Data', oc?.insufficient_data_rule_count));
  compFields.appendChild(detailField('Not Applicable', oc?.not_applicable_rule_count));
  compFields.appendChild(detailField('Compliant Rules', oc?.compliant_rule_count));
  compSection.appendChild(compFields);
  grid.appendChild(compSection);

  // Investigation priority
  const priSection = detailSection('Investigation Priority');
  const priFields = el('div', { class: 'detail-fields' });
  const ip = alert.decision_support?.investigation_priority;
  priFields.appendChild(detailBadgeField('Priority Band', ip?.priority_band));
  priFields.appendChild(detailField('Score', ip?.score));
  priFields.appendChild(detailField('Raw Score', ip?.raw_score));
  priFields.appendChild(detailField('Maximum Score', ip?.maximum_score));
  priFields.appendChild(detailField('Base Historical Context Score', ip?.base_historical_context_score));
  priFields.appendChild(detailField('Potential Gap Points', ip?.potential_gap_points));
  priFields.appendChild(detailField('Insufficient Data Points', ip?.insufficient_data_points));
  priFields.appendChild(detailField('Non-Compliance Points', ip?.non_compliance_points));
  priSection.appendChild(priFields);
  grid.appendChild(priSection);

  // Calculation inputs
  const calcSection = detailSection('Calculation Inputs');
  const calcFields = el('div', { class: 'detail-fields' });
  const ci = alert.decision_support?.calculation_inputs;
  calcFields.appendChild(detailField('Version', alert.decision_support?.calculation_version));
  calcFields.appendChild(detailField('Highest Historical Context Level', ci?.highest_historical_context_level));
  calcFields.appendChild(detailField('Non-Compliant Rule Count', ci?.non_compliant_rule_count));
  calcFields.appendChild(detailField('Potential Gap Rule Count', ci?.potential_gap_rule_count));
  calcFields.appendChild(detailField('Insufficient Data Rule Count', ci?.insufficient_data_rule_count));
  calcFields.appendChild(detailField('Not Applicable Rule Count', ci?.not_applicable_rule_count));
  calcFields.appendChild(detailField('Compliant Rule Count', ci?.compliant_rule_count));
  calcSection.appendChild(calcFields);
  grid.appendChild(calcSection);

  // Workflow classification — full width
  const wfSection = detailSection('Workflow Classification');
  wfSection.classList.add('full-width');
  const wfFields = el('div', { class: 'detail-fields' });
  const wc = alert.decision_support?.workflow_classification;
  wfFields.appendChild(detailBadgeField('Final Verdict', wc?.final_verdict));
  wfFields.appendChild(detailField('Matched Rule ID', wc?.matched_rule_id, true));
  wfFields.appendChild(detailField('Meaning', wc?.meaning));
  wfFields.appendChild(detailField('Is Legal Conclusion', wc?.is_legal_conclusion != null ? String(wc.is_legal_conclusion) : '—'));
  wfFields.appendChild(detailField('Establishes Money Laundering', wc?.establishes_money_laundering != null ? String(wc.establishes_money_laundering) : '—'));
  wfFields.appendChild(detailListField('Rationale', wc?.rationale));
  wfSection.appendChild(wfFields);
  grid.appendChild(wfSection);

  // Regulatory interpretation — full width
  const regSection = detailSection('Regulatory Interpretation');
  regSection.classList.add('full-width');
  const regFields = el('div', { class: 'detail-fields' });
  const ri = alert.regulatory_interpretation;
  regFields.appendChild(detailField('Summary', ri?.summary));
  regFields.appendChild(detailField('Regulatory Relevance', ri?.regulatory_relevance));
  regFields.appendChild(detailListField('Key Findings', ri?.key_findings));
  regSection.appendChild(regFields);
  grid.appendChild(regSection);

  main.appendChild(grid);
}

function detailSection(title) {
  const section = el('div', { class: 'detail-section' });
  const header = el('div', { class: 'detail-section-header' });
  header.textContent = title;
  section.appendChild(header);
  return section;
}

function appendMeta(row, label, value, mono = false) {
  const item = el('div', { class: 'detail-field', style: 'min-width:160px' });
  const lbl = el('span', { class: 'detail-field-label' });
  lbl.textContent = label;
  const val = el('span', { class: `detail-field-value${mono ? ' mono' : ''}`, style: 'font-size:0.82rem' });
  val.textContent = String(value ?? '—');
  item.appendChild(lbl);
  item.appendChild(val);
  row.appendChild(item);
}

async function handleDelete(alert) {
  const confirmed = await confirmDialog(
    `Delete alert "${alert.transaction_id}" (${alert.id.slice(0, 8)}…)? This cannot be undone.`
  );
  if (!confirmed) return;
  try {
    await deleteAlert(alert.id);
    showToast('Alert deleted.', 'success');
    navigate('#/alerts');
  } catch (err) {
    showToast(`Delete failed: ${err.message}`, 'error');
  }
}
