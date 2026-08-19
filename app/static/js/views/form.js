/* Create / Edit form view */
import { el, clear, txt } from '../dom.js';
import { getAlert, createAlert, replaceAlert } from '../api.js';
import { state, stripServerFields, deepClone } from '../state.js';
import { navigate } from '../router.js';
import { showToast, setAppBusy } from '../ui.js';
import { map422Errors, ApiError } from '../api.js';

const main = document.getElementById('main');

/* ------------------------------------------------------------------ */
/* Sample draft for "Load example" — derived from canonical fixture    */
/* ------------------------------------------------------------------ */
const SAMPLE_DRAFT = {
  transaction_id: 'TX-EXAMPLE-001',
  transaction_information: {
    originator_name: 'James Carter',
    origin_account: '83D4B1F30',
    bank_origin: '0121',
    beneficiary_name: 'Emily Foster',
    destination_account: '818CCA030',
    bank_destination: '29196',
    amount: 15000,
    currency: 'EUR',
  },
  overall_compliance: {
    overall_status: 'NON_COMPLIANT',
    non_compliant_rule_count: 3,
    potential_gap_rule_count: 1,
    insufficient_data_rule_count: 2,
    not_applicable_rule_count: 4,
    compliant_rule_count: 10,
  },
  decision_support: {
    calculation_version: 'v2.1.0',
    calculation_inputs: {
      highest_historical_context_level: 2,
      non_compliant_rule_count: 3,
      potential_gap_rule_count: 1,
      insufficient_data_rule_count: 2,
      not_applicable_rule_count: 4,
      compliant_rule_count: 10,
    },
    investigation_priority: {
      base_historical_context_score: 0.5,
      potential_gap_points: 1.0,
      insufficient_data_points: 0.5,
      non_compliance_points: 3.0,
      raw_score: 5.0,
      score: 4.5,
      maximum_score: 10.0,
      priority_band: 'HIGH',
    },
    workflow_classification: {
      final_verdict: 'ESCALATE',
      matched_rule_id: 'RULE-007',
      rationale: [
        'Multiple non-compliant rules detected',
        'Historical context indicates elevated risk',
      ],
      meaning: 'Case requires immediate escalation to senior compliance officer',
      is_legal_conclusion: false,
      establishes_money_laundering: false,
    },
  },
  regulatory_interpretation: {
    summary: 'Assessment indicates significant compliance gaps requiring immediate attention',
    key_findings: [
      'Transaction pattern deviates from established baseline',
      'Three rules flagged as non-compliant under AML directives',
      'Insufficient data for two risk indicators',
    ],
    regulatory_relevance: 'Subject to AMLD5 Article 18 enhanced due diligence requirements',
  },
};

/* ------------------------------------------------------------------ */
/* Entry points                                                         */
/* ------------------------------------------------------------------ */
export async function renderCreate() {
  state.draft = deepClone(SAMPLE_DRAFT);
  state.draft.transaction_id = '';
  // Clear sample transaction info
  for (const k of Object.keys(state.draft.transaction_information)) {
    state.draft.transaction_information[k] = k === 'amount' ? 0 : '';
  }
  buildFormView({ isEdit: false });
}

export async function renderEdit({ id }) {
  setAppBusy(true);
  clear(main);
  const loadingEl = el('p', { class: 'text-muted', style: 'padding:2rem 0' });
  loadingEl.textContent = 'Loading alert…';
  const spinner = el('span', { class: 'spinner', 'aria-hidden': 'true', style: 'margin-right:8px' });
  loadingEl.prepend(spinner);
  main.appendChild(loadingEl);

  try {
    const alert = await getAlert(decodeURIComponent(id));
    state.current = alert;
    state.draft = stripServerFields(deepClone(alert));
    buildFormView({ isEdit: true, alertId: alert.id });
  } catch (err) {
    clear(main);
    const banner = el('div', { class: 'error-banner', role: 'alert' });
    const icon = el('span', { class: 'error-banner-icon', 'aria-hidden': 'true' });
    icon.textContent = '✕';
    banner.appendChild(icon);
    const body = el('div', { class: 'error-banner-body' });
    const title = el('div', { class: 'error-banner-title' });
    title.textContent = 'Failed to load alert for editing';
    body.appendChild(title);
    const msg = el('p');
    msg.textContent = err.message;
    body.appendChild(msg);
    const back = el('a', { href: '#/alerts', class: 'btn btn-secondary', style: 'margin-top:12px' });
    back.textContent = '← Back';
    body.appendChild(back);
    banner.appendChild(body);
    main.appendChild(banner);
  } finally {
    setAppBusy(false);
  }
}

/* ------------------------------------------------------------------ */
/* Form builder                                                         */
/* ------------------------------------------------------------------ */
function buildFormView({ isEdit, alertId }) {
  clear(main);

  const header = el('div', { class: 'page-header' });
  const titleBlock = el('div', { class: 'page-header-title' });
  const h1 = el('h1');
  h1.textContent = isEdit ? 'Edit Alert' : 'New Alert';
  if (isEdit && state.current) {
    const sub = el('p', { class: 'text-muted mono', style: 'font-size:0.82rem' });
    sub.textContent = state.current.transaction_id;
    titleBlock.appendChild(sub);
  }
  titleBlock.prepend(h1);
  header.appendChild(titleBlock);

  const actions = el('div', { class: 'page-actions' });
  const backLink = el('a', {
    href: isEdit ? `#/alerts/${encodeURIComponent(alertId)}` : '#/alerts',
    class: 'btn btn-ghost',
  });
  backLink.textContent = '← Cancel';
  actions.appendChild(backLink);
  header.appendChild(actions);
  main.appendChild(header);

  const formWrap = el('div', { class: 'form-wrap' });

  // --- Tabs ---
  const tabBar = el('div', { class: 'form-tabs', role: 'tablist', 'aria-label': 'Form editor tabs' });
  const structuredTab = buildTab('structured-tab', 'structured-panel', 'Structured Form', true);
  const jsonTab = buildTab('json-tab', 'json-panel', 'Advanced (JSON)', false);
  tabBar.appendChild(structuredTab);
  tabBar.appendChild(jsonTab);
  formWrap.appendChild(tabBar);

  // --- Structured panel ---
  const structuredPanel = el('div', { id: 'structured-panel', class: 'form-panel', role: 'tabpanel', 'aria-labelledby': 'structured-tab', 'aria-hidden': 'false' });

  // Each section
  structuredPanel.appendChild(buildTransactionSection());
  structuredPanel.appendChild(buildComplianceSection());
  structuredPanel.appendChild(buildDecisionSupportSection());
  structuredPanel.appendChild(buildRegulatorySection());
  formWrap.appendChild(structuredPanel);

  // --- JSON panel ---
  const jsonPanel = el('div', { id: 'json-panel', class: 'form-panel', role: 'tabpanel', 'aria-labelledby': 'json-tab', 'aria-hidden': 'true' });
  const jsonWrap = el('div', { class: 'json-editor-wrap' });
  const jsonLabel = el('label', { for: 'json-editor', class: 'sr-only' });
  jsonLabel.textContent = 'JSON editor';
  const jsonTextarea = el('textarea', { id: 'json-editor', 'aria-label': 'JSON editor', 'aria-describedby': 'json-error', rows: '35' });
  jsonTextarea.value = JSON.stringify(state.draft, null, 2);
  const jsonError = el('div', { id: 'json-error', class: 'json-error', role: 'alert', 'aria-live': 'polite' });
  jsonWrap.appendChild(jsonLabel);
  jsonWrap.appendChild(jsonTextarea);
  jsonWrap.appendChild(jsonError);
  jsonPanel.appendChild(jsonWrap);

  // Load example button in json panel
  const loadExBtn = el('button', { class: 'btn btn-ghost btn-sm', style: 'margin-top:10px' });
  loadExBtn.textContent = 'Load Example';
  loadExBtn.addEventListener('click', () => {
    state.draft = deepClone(SAMPLE_DRAFT);
    jsonTextarea.value = JSON.stringify(state.draft, null, 2);
    jsonError.textContent = '';
    syncJsonToDraft(jsonTextarea, jsonError);
    syncDraftToStructured(structuredPanel);
  });
  jsonPanel.appendChild(loadExBtn);

  formWrap.appendChild(jsonPanel);

  // --- Global field errors region ---
  const globalErrors = el('div', { id: 'global-form-errors', role: 'alert', 'aria-live': 'assertive', style: 'margin-bottom:16px' });
  formWrap.insertBefore(globalErrors, tabBar.nextSibling);

  // --- Action bar ---
  const actBar = el('div', { class: 'form-actions-bar' });
  const saveBtn = el('button', { class: 'btn btn-primary', id: 'form-save-btn' });
  saveBtn.textContent = isEdit ? 'Save Changes' : 'Create Alert';
  const cancelBtn2 = el('a', {
    href: isEdit ? `#/alerts/${encodeURIComponent(alertId)}` : '#/alerts',
    class: 'btn btn-secondary',
  });
  cancelBtn2.textContent = 'Cancel';
  if (!isEdit) {
    const exampleBtn = el('button', { class: 'btn btn-ghost', type: 'button' });
    exampleBtn.textContent = 'Load Example';
    exampleBtn.addEventListener('click', () => {
      state.draft = deepClone(SAMPLE_DRAFT);
      syncDraftToStructured(structuredPanel);
      jsonTextarea.value = JSON.stringify(state.draft, null, 2);
    });
    actBar.appendChild(exampleBtn);
  }
  actBar.appendChild(cancelBtn2);
  actBar.appendChild(saveBtn);
  formWrap.appendChild(actBar);

  main.appendChild(formWrap);

  // --- Tab switching logic ---
  structuredTab.addEventListener('click', () => {
    // Sync JSON → draft first
    const currentPanel = document.getElementById('json-panel');
    if (currentPanel.getAttribute('aria-hidden') === 'false') {
      const ok = syncJsonToDraft(jsonTextarea, jsonError);
      if (!ok) return; // block switch on invalid JSON
      syncDraftToStructured(structuredPanel);
    }
    setActiveTab('structured-tab', 'json-tab', 'structured-panel', 'json-panel');
  });
  jsonTab.addEventListener('click', () => {
    // Sync structured → draft first
    syncStructuredToDraft(structuredPanel);
    jsonTextarea.value = JSON.stringify(state.draft, null, 2);
    jsonError.textContent = '';
    setActiveTab('json-tab', 'structured-tab', 'json-panel', 'structured-panel');
  });

  // --- Save ---
  saveBtn.addEventListener('click', () => handleSave({ isEdit, alertId, structuredPanel, jsonPanel, jsonTextarea, jsonError, globalErrors, saveBtn }));
}

function buildTab(id, panelId, label, active) {
  const btn = el('button', {
    id,
    class: 'form-tab',
    role: 'tab',
    'aria-controls': panelId,
    'aria-selected': active ? 'true' : 'false',
    type: 'button',
  });
  btn.textContent = label;
  return btn;
}

function setActiveTab(activeId, inactiveId, activePanelId, inactivePanelId) {
  document.getElementById(activeId).setAttribute('aria-selected', 'true');
  document.getElementById(inactiveId).setAttribute('aria-selected', 'false');
  document.getElementById(activePanelId).setAttribute('aria-hidden', 'false');
  document.getElementById(inactivePanelId).setAttribute('aria-hidden', 'true');
}

/* ------------------------------------------------------------------ */
/* Section builders                                                     */
/* ------------------------------------------------------------------ */
function buildTransactionSection() {
  const section = buildSection('transaction-section', 'Transaction');
  const body = section.querySelector('.form-section-body');

  body.appendChild(buildField('transaction_id', 'Transaction ID', 'text', state.draft.transaction_id, 'Root transaction identifier'));

  const ti = state.draft.transaction_information;
  const row1 = el('div', { class: 'form-row form-row-2' });
  row1.appendChild(buildField('ti_originator_name', 'Originator Name', 'text', ti?.originator_name ?? ''));
  row1.appendChild(buildField('ti_beneficiary_name', 'Beneficiary Name', 'text', ti?.beneficiary_name ?? ''));
  body.appendChild(row1);

  const row2 = el('div', { class: 'form-row form-row-3' });
  row2.appendChild(buildField('ti_origin_account', 'Origin Account', 'text', ti?.origin_account ?? '', 'Preserve leading zeroes'));
  row2.appendChild(buildField('ti_bank_origin', 'Bank (Origin)', 'text', ti?.bank_origin ?? '', 'Bank code — keep as text'));
  row2.appendChild(buildField('ti_destination_account', 'Destination Account', 'text', ti?.destination_account ?? '', 'Preserve leading zeroes'));
  body.appendChild(row2);

  const row3 = el('div', { class: 'form-row form-row-3' });
  row3.appendChild(buildField('ti_bank_destination', 'Bank (Destination)', 'text', ti?.bank_destination ?? '', 'Bank code — keep as text'));
  row3.appendChild(buildField('ti_amount', 'Amount', 'number', ti?.amount ?? '', undefined, { step: 'any', min: '0' }));
  row3.appendChild(buildField('ti_currency', 'Currency', 'text', ti?.currency ?? '', 'e.g. EUR, USD'));
  body.appendChild(row3);

  return section;
}

function buildComplianceSection() {
  const section = buildSection('compliance-section', 'Overall Compliance');
  const body = section.querySelector('.form-section-body');
  const oc = state.draft.overall_compliance;

  const row1 = el('div', { class: 'form-row' });
  row1.appendChild(buildField('oc_overall_status', 'Overall Status', 'text', oc?.overall_status ?? '', 'e.g. NON_COMPLIANT, COMPLIANT'));
  body.appendChild(row1);

  const row2 = el('div', { class: 'form-row form-row-3' });
  row2.appendChild(buildField('oc_non_compliant_rule_count', 'Non-Compliant Rules', 'number', oc?.non_compliant_rule_count ?? 0, undefined, { min: '0', step: '1' }));
  row2.appendChild(buildField('oc_potential_gap_rule_count', 'Potential Gap Rules', 'number', oc?.potential_gap_rule_count ?? 0, undefined, { min: '0', step: '1' }));
  row2.appendChild(buildField('oc_insufficient_data_rule_count', 'Insufficient Data Rules', 'number', oc?.insufficient_data_rule_count ?? 0, undefined, { min: '0', step: '1' }));
  body.appendChild(row2);

  const row3 = el('div', { class: 'form-row form-row-2' });
  row3.appendChild(buildField('oc_not_applicable_rule_count', 'Not Applicable Rules', 'number', oc?.not_applicable_rule_count ?? 0, undefined, { min: '0', step: '1' }));
  row3.appendChild(buildField('oc_compliant_rule_count', 'Compliant Rules', 'number', oc?.compliant_rule_count ?? 0, undefined, { min: '0', step: '1' }));
  body.appendChild(row3);

  return section;
}

function buildDecisionSupportSection() {
  const section = buildSection('ds-section', 'Decision Support');
  const body = section.querySelector('.form-section-body');
  const ds = state.draft.decision_support;
  const ci = ds?.calculation_inputs;
  const ip = ds?.investigation_priority;
  const wc = ds?.workflow_classification;

  body.appendChild(buildField('ds_calculation_version', 'Calculation Version', 'text', ds?.calculation_version ?? ''));

  // Calculation inputs subsection
  body.appendChild(subsectionTitle('Calculation Inputs'));
  const ciRow1 = el('div', { class: 'form-row form-row-3' });
  ciRow1.appendChild(buildField('ci_highest_historical_context_level', 'Highest Historical Context Level', 'number', ci?.highest_historical_context_level ?? 0, undefined, { min: '0', step: '1' }));
  ciRow1.appendChild(buildField('ci_non_compliant_rule_count', 'Non-Compliant Rule Count', 'number', ci?.non_compliant_rule_count ?? 0, undefined, { min: '0', step: '1' }));
  ciRow1.appendChild(buildField('ci_potential_gap_rule_count', 'Potential Gap Rule Count', 'number', ci?.potential_gap_rule_count ?? 0, undefined, { min: '0', step: '1' }));
  body.appendChild(ciRow1);

  const ciRow2 = el('div', { class: 'form-row form-row-3' });
  ciRow2.appendChild(buildField('ci_insufficient_data_rule_count', 'Insufficient Data Rule Count', 'number', ci?.insufficient_data_rule_count ?? 0, undefined, { min: '0', step: '1' }));
  ciRow2.appendChild(buildField('ci_not_applicable_rule_count', 'Not Applicable Rule Count', 'number', ci?.not_applicable_rule_count ?? 0, undefined, { min: '0', step: '1' }));
  ciRow2.appendChild(buildField('ci_compliant_rule_count', 'Compliant Rule Count', 'number', ci?.compliant_rule_count ?? 0, undefined, { min: '0', step: '1' }));
  body.appendChild(ciRow2);

  // Investigation priority
  body.appendChild(subsectionTitle('Investigation Priority'));
  const ipRow1 = el('div', { class: 'form-row form-row-2' });
  ipRow1.appendChild(buildField('ip_priority_band', 'Priority Band', 'text', ip?.priority_band ?? '', 'e.g. HIGH, MEDIUM, LOW'));
  ipRow1.appendChild(buildField('ip_score', 'Score', 'number', ip?.score ?? 0, undefined, { step: 'any' }));
  body.appendChild(ipRow1);

  const ipRow2 = el('div', { class: 'form-row form-row-3' });
  ipRow2.appendChild(buildField('ip_raw_score', 'Raw Score', 'number', ip?.raw_score ?? 0, undefined, { step: 'any' }));
  ipRow2.appendChild(buildField('ip_maximum_score', 'Maximum Score', 'number', ip?.maximum_score ?? 0, undefined, { step: 'any' }));
  ipRow2.appendChild(buildField('ip_base_historical_context_score', 'Base Historical Context Score', 'number', ip?.base_historical_context_score ?? 0, undefined, { step: 'any' }));
  body.appendChild(ipRow2);

  const ipRow3 = el('div', { class: 'form-row form-row-3' });
  ipRow3.appendChild(buildField('ip_potential_gap_points', 'Potential Gap Points', 'number', ip?.potential_gap_points ?? 0, undefined, { step: 'any' }));
  ipRow3.appendChild(buildField('ip_insufficient_data_points', 'Insufficient Data Points', 'number', ip?.insufficient_data_points ?? 0, undefined, { step: 'any' }));
  ipRow3.appendChild(buildField('ip_non_compliance_points', 'Non-Compliance Points', 'number', ip?.non_compliance_points ?? 0, undefined, { step: 'any' }));
  body.appendChild(ipRow3);

  // Workflow classification
  body.appendChild(subsectionTitle('Workflow Classification'));
  const wcRow1 = el('div', { class: 'form-row form-row-2' });
  wcRow1.appendChild(buildField('wc_final_verdict', 'Final Verdict', 'text', wc?.final_verdict ?? '', 'e.g. ESCALATE, CLEAR'));
  wcRow1.appendChild(buildField('wc_matched_rule_id', 'Matched Rule ID', 'text', wc?.matched_rule_id ?? ''));
  body.appendChild(wcRow1);

  body.appendChild(buildField('wc_meaning', 'Meaning', 'text', wc?.meaning ?? ''));

  const boolRow = el('div', { class: 'form-row form-row-2' });
  boolRow.appendChild(buildBoolField('wc_is_legal_conclusion', 'Is Legal Conclusion', wc?.is_legal_conclusion ?? false));
  boolRow.appendChild(buildBoolField('wc_establishes_money_laundering', 'Establishes Money Laundering', wc?.establishes_money_laundering ?? false));
  body.appendChild(boolRow);

  body.appendChild(buildListField('wc_rationale', 'Rationale', wc?.rationale ?? []));

  return section;
}

function buildRegulatorySection() {
  const section = buildSection('reg-section', 'Regulatory Interpretation');
  const body = section.querySelector('.form-section-body');
  const ri = state.draft.regulatory_interpretation;

  body.appendChild(buildField('ri_summary', 'Summary', 'text', ri?.summary ?? ''));
  body.appendChild(buildField('ri_regulatory_relevance', 'Regulatory Relevance', 'text', ri?.regulatory_relevance ?? ''));
  body.appendChild(buildListField('ri_key_findings', 'Key Findings', ri?.key_findings ?? []));

  return section;
}

/* ------------------------------------------------------------------ */
/* Field primitives                                                     */
/* ------------------------------------------------------------------ */
function buildSection(id, title) {
  const section = el('div', { class: 'form-section', id });
  const sectionTitle = el('div', {
    class: 'form-section-title',
    role: 'button',
    tabindex: '0',
    'aria-expanded': 'true',
    'aria-controls': id + '-body',
  });
  sectionTitle.textContent = title;
  const chevron = el('span', { 'aria-hidden': 'true' });
  chevron.textContent = '▾';
  sectionTitle.appendChild(chevron);
  const body = el('div', { class: 'form-section-body', id: id + '-body' });

  sectionTitle.addEventListener('click', () => {
    const expanded = sectionTitle.getAttribute('aria-expanded') === 'true';
    sectionTitle.setAttribute('aria-expanded', String(!expanded));
    chevron.textContent = !expanded ? '▾' : '▸';
  });
  sectionTitle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sectionTitle.click(); }
  });

  section.appendChild(sectionTitle);
  section.appendChild(body);
  return section;
}

function subsectionTitle(text) {
  const h = el('h4', { style: 'color:var(--color-text-muted);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.06em;margin-top:4px' });
  h.textContent = text;
  return h;
}

function buildField(id, label, type, value, hint, extraAttrs = {}) {
  const field = el('div', { class: 'field' });
  const lbl = el('label', { for: id });
  lbl.textContent = label;
  field.appendChild(lbl);
  if (hint) {
    const hintEl = el('span', { class: 'field-hint', id: id + '-hint' });
    hintEl.textContent = hint;
    field.appendChild(hintEl);
  }
  const attrs = { id, name: id, type, 'aria-describedby': hint ? id + '-hint' : undefined, ...extraAttrs };
  const input = el('input', attrs);
  if (type === 'number') {
    input.value = value !== '' && value != null ? String(value) : '';
  } else {
    input.value = String(value ?? '');
  }
  field.appendChild(input);
  const errorEl = el('span', { class: 'field-error', id: id + '-error', role: 'alert', 'aria-live': 'polite' });
  field.appendChild(errorEl);
  return field;
}

function buildBoolField(id, label, value) {
  const field = el('div', { class: 'field' });
  const wrapper = el('div', { class: 'checkbox-field' });
  const input = el('input', { id, name: id, type: 'checkbox' });
  input.checked = Boolean(value);
  const lbl = el('label', { for: id });
  lbl.textContent = label;
  wrapper.appendChild(input);
  wrapper.appendChild(lbl);
  field.appendChild(wrapper);
  const errorEl = el('span', { class: 'field-error', id: id + '-error', role: 'alert', 'aria-live': 'polite' });
  field.appendChild(errorEl);
  return field;
}

function buildListField(id, label, items) {
  const field = el('div', { class: 'field' });
  const lbl = el('div');
  lbl.textContent = label;
  lbl.style.cssText = 'font-size:0.82rem;font-weight:600;color:var(--color-text);margin-bottom:4px';
  field.appendChild(lbl);

  const editor = el('div', { class: 'list-editor', id, 'aria-label': label + ' list' });
  for (const item of items) {
    editor.appendChild(buildListItem(item));
  }

  const addBtn = el('button', { class: 'btn btn-ghost btn-sm list-editor-add', type: 'button' });
  addBtn.textContent = '+ Add item';
  addBtn.addEventListener('click', () => {
    const newItem = buildListItem('');
    editor.insertBefore(newItem, addBtn);
    newItem.querySelector('input').focus();
  });
  editor.appendChild(addBtn);
  field.appendChild(editor);
  const errorEl = el('span', { class: 'field-error', id: id + '-error', role: 'alert', 'aria-live': 'polite' });
  field.appendChild(errorEl);
  return field;
}

function buildListItem(value) {
  const item = el('div', { class: 'list-editor-item' });
  const input = el('input', { type: 'text', 'aria-label': 'List item' });
  input.value = String(value ?? '');
  const removeBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-label': 'Remove item' });
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => item.remove());
  item.appendChild(input);
  item.appendChild(removeBtn);
  return item;
}

/* ------------------------------------------------------------------ */
/* Sync: structured form → draft                                        */
/* ------------------------------------------------------------------ */
function syncStructuredToDraft(panel) {
  const g = (id) => panel.querySelector(`#${id}`);
  const val = (id) => g(id)?.value ?? '';
  const num = (id) => { const v = g(id)?.value; return v !== '' && v != null ? Number(v) : 0; };
  const bool = (id) => g(id)?.checked ?? false;
  const list = (id) => {
    const editor = panel.querySelector(`#${id}`);
    if (!editor) return [];
    return Array.from(editor.querySelectorAll('.list-editor-item input')).map((i) => i.value).filter((v) => v.trim() !== '');
  };

  state.draft = {
    transaction_id: val('transaction_id'),
    transaction_information: {
      originator_name: val('ti_originator_name'),
      origin_account: val('ti_origin_account'),
      bank_origin: val('ti_bank_origin'),
      beneficiary_name: val('ti_beneficiary_name'),
      destination_account: val('ti_destination_account'),
      bank_destination: val('ti_bank_destination'),
      amount: num('ti_amount'),
      currency: val('ti_currency'),
    },
    overall_compliance: {
      overall_status: val('oc_overall_status'),
      non_compliant_rule_count: num('oc_non_compliant_rule_count'),
      potential_gap_rule_count: num('oc_potential_gap_rule_count'),
      insufficient_data_rule_count: num('oc_insufficient_data_rule_count'),
      not_applicable_rule_count: num('oc_not_applicable_rule_count'),
      compliant_rule_count: num('oc_compliant_rule_count'),
    },
    decision_support: {
      calculation_version: val('ds_calculation_version'),
      calculation_inputs: {
        highest_historical_context_level: num('ci_highest_historical_context_level'),
        non_compliant_rule_count: num('ci_non_compliant_rule_count'),
        potential_gap_rule_count: num('ci_potential_gap_rule_count'),
        insufficient_data_rule_count: num('ci_insufficient_data_rule_count'),
        not_applicable_rule_count: num('ci_not_applicable_rule_count'),
        compliant_rule_count: num('ci_compliant_rule_count'),
      },
      investigation_priority: {
        base_historical_context_score: num('ip_base_historical_context_score'),
        potential_gap_points: num('ip_potential_gap_points'),
        insufficient_data_points: num('ip_insufficient_data_points'),
        non_compliance_points: num('ip_non_compliance_points'),
        raw_score: num('ip_raw_score'),
        score: num('ip_score'),
        maximum_score: num('ip_maximum_score'),
        priority_band: val('ip_priority_band'),
      },
      workflow_classification: {
        final_verdict: val('wc_final_verdict'),
        matched_rule_id: val('wc_matched_rule_id'),
        rationale: list('wc_rationale'),
        meaning: val('wc_meaning'),
        is_legal_conclusion: bool('wc_is_legal_conclusion'),
        establishes_money_laundering: bool('wc_establishes_money_laundering'),
      },
    },
    regulatory_interpretation: {
      summary: val('ri_summary'),
      key_findings: list('ri_key_findings'),
      regulatory_relevance: val('ri_regulatory_relevance'),
    },
  };
}

/* ------------------------------------------------------------------ */
/* Sync: draft → structured form                                        */
/* ------------------------------------------------------------------ */
function syncDraftToStructured(panel) {
  const d = state.draft;
  const setVal = (id, v) => { const el = panel.querySelector(`#${id}`); if (el) el.value = v != null ? String(v) : ''; };
  const setCheck = (id, v) => { const el = panel.querySelector(`#${id}`); if (el) el.checked = Boolean(v); };

  setVal('transaction_id', d.transaction_id);
  const ti = d.transaction_information ?? {};
  setVal('ti_originator_name', ti.originator_name);
  setVal('ti_origin_account', ti.origin_account);
  setVal('ti_bank_origin', ti.bank_origin);
  setVal('ti_beneficiary_name', ti.beneficiary_name);
  setVal('ti_destination_account', ti.destination_account);
  setVal('ti_bank_destination', ti.bank_destination);
  setVal('ti_amount', ti.amount);
  setVal('ti_currency', ti.currency);

  const oc = d.overall_compliance ?? {};
  setVal('oc_overall_status', oc.overall_status);
  setVal('oc_non_compliant_rule_count', oc.non_compliant_rule_count);
  setVal('oc_potential_gap_rule_count', oc.potential_gap_rule_count);
  setVal('oc_insufficient_data_rule_count', oc.insufficient_data_rule_count);
  setVal('oc_not_applicable_rule_count', oc.not_applicable_rule_count);
  setVal('oc_compliant_rule_count', oc.compliant_rule_count);

  const ds = d.decision_support ?? {};
  setVal('ds_calculation_version', ds.calculation_version);
  const ci = ds.calculation_inputs ?? {};
  setVal('ci_highest_historical_context_level', ci.highest_historical_context_level);
  setVal('ci_non_compliant_rule_count', ci.non_compliant_rule_count);
  setVal('ci_potential_gap_rule_count', ci.potential_gap_rule_count);
  setVal('ci_insufficient_data_rule_count', ci.insufficient_data_rule_count);
  setVal('ci_not_applicable_rule_count', ci.not_applicable_rule_count);
  setVal('ci_compliant_rule_count', ci.compliant_rule_count);

  const ip = ds.investigation_priority ?? {};
  setVal('ip_priority_band', ip.priority_band);
  setVal('ip_score', ip.score);
  setVal('ip_raw_score', ip.raw_score);
  setVal('ip_maximum_score', ip.maximum_score);
  setVal('ip_base_historical_context_score', ip.base_historical_context_score);
  setVal('ip_potential_gap_points', ip.potential_gap_points);
  setVal('ip_insufficient_data_points', ip.insufficient_data_points);
  setVal('ip_non_compliance_points', ip.non_compliance_points);

  const wc = ds.workflow_classification ?? {};
  setVal('wc_final_verdict', wc.final_verdict);
  setVal('wc_matched_rule_id', wc.matched_rule_id);
  setVal('wc_meaning', wc.meaning);
  setCheck('wc_is_legal_conclusion', wc.is_legal_conclusion);
  setCheck('wc_establishes_money_laundering', wc.establishes_money_laundering);
  rebuildListEditor(panel, 'wc_rationale', wc.rationale ?? []);

  const ri = d.regulatory_interpretation ?? {};
  setVal('ri_summary', ri.summary);
  setVal('ri_regulatory_relevance', ri.regulatory_relevance);
  rebuildListEditor(panel, 'ri_key_findings', ri.key_findings ?? []);
}

function rebuildListEditor(panel, id, items) {
  const editor = panel.querySelector(`#${id}`);
  if (!editor) return;
  // Remove all existing items (but keep the add button)
  const addBtn = editor.querySelector('.list-editor-add');
  const existing = Array.from(editor.querySelectorAll('.list-editor-item'));
  for (const item of existing) item.remove();
  for (const value of items) {
    const newItem = buildListItem(value);
    editor.insertBefore(newItem, addBtn);
  }
}

/* ------------------------------------------------------------------ */
/* Sync: JSON textarea → draft                                          */
/* ------------------------------------------------------------------ */
function syncJsonToDraft(textarea, errorEl) {
  try {
    const parsed = JSON.parse(textarea.value);
    state.draft = parsed;
    errorEl.textContent = '';
    return true;
  } catch (e) {
    errorEl.textContent = `Invalid JSON: ${e.message}`;
    textarea.setAttribute('aria-invalid', 'true');
    textarea.focus();
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Save handler                                                         */
/* ------------------------------------------------------------------ */
async function handleSave({ isEdit, alertId, structuredPanel, jsonPanel, jsonTextarea, jsonError, globalErrors, saveBtn }) {
  // Sync whichever panel is active
  const jsonActive = document.getElementById('json-panel').getAttribute('aria-hidden') === 'false';
  if (jsonActive) {
    const ok = syncJsonToDraft(jsonTextarea, jsonError);
    if (!ok) return;
  } else {
    syncStructuredToDraft(structuredPanel);
  }

  // Clear previous errors
  clearFieldErrors(structuredPanel);
  clear(globalErrors);

  // Client-side presence check for required string fields
  const errors = validateDraft(state.draft);
  if (errors.length > 0) {
    showValidationErrors(errors, structuredPanel, globalErrors);
    return;
  }

  saveBtn.disabled = true;
  const spinnerEl = el('span', { class: 'spinner', 'aria-hidden': 'true' });
  saveBtn.prepend(spinnerEl);

  try {
    let result;
    if (isEdit) {
      result = await replaceAlert(alertId, state.draft);
      showToast('Alert updated.', 'success');
      navigate(`#/alerts/${encodeURIComponent(result.id)}`);
    } else {
      result = await createAlert(state.draft);
      showToast('Alert created.', 'success');
      navigate(`#/alerts/${encodeURIComponent(result.id)}`);
    }
  } catch (err) {
    saveBtn.disabled = false;
    spinnerEl.remove();
    if (err instanceof ApiError && err.status === 422) {
      const fieldMap = map422Errors(err.detail);
      const fieldErrors = Object.entries(fieldMap).map(([path, msg]) => ({ path, msg }));
      if (fieldErrors.length > 0) {
        showValidationErrors(fieldErrors.map((e) => ({ field: e.path, message: e.msg })), structuredPanel, globalErrors);
      } else {
        appendGlobalError(globalErrors, typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
      }
    } else {
      appendGlobalError(globalErrors, err.message);
    }
  } finally {
    // Re-enable if still mounted
    if (saveBtn.isConnected) {
      saveBtn.disabled = false;
      const sp = saveBtn.querySelector('.spinner');
      if (sp) sp.remove();
    }
  }
}

function validateDraft(draft) {
  const errors = [];
  if (!draft.transaction_id?.trim()) errors.push({ field: 'transaction_id', message: 'Transaction ID is required.' });
  if (!draft.transaction_information?.originator_name?.trim()) errors.push({ field: 'ti_originator_name', message: 'Originator name is required.' });
  if (!draft.transaction_information?.beneficiary_name?.trim()) errors.push({ field: 'ti_beneficiary_name', message: 'Beneficiary name is required.' });
  if (!draft.overall_compliance?.overall_status?.trim()) errors.push({ field: 'oc_overall_status', message: 'Overall status is required.' });
  if (!draft.decision_support?.investigation_priority?.priority_band?.trim()) errors.push({ field: 'ip_priority_band', message: 'Priority band is required.' });
  if (!draft.decision_support?.workflow_classification?.final_verdict?.trim()) errors.push({ field: 'wc_final_verdict', message: 'Final verdict is required.' });
  return errors;
}

function showValidationErrors(errors, panel, globalErrors) {
  let firstEl = null;
  for (const { field, message } of errors) {
    const input = panel.querySelector(`#${CSS.escape(field)}`);
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      const errorEl = panel.querySelector(`#${CSS.escape(field)}-error`);
      if (errorEl) errorEl.textContent = message;
      if (!firstEl) firstEl = input;
    } else {
      appendGlobalError(globalErrors, `${field}: ${message}`);
    }
  }
  if (firstEl) firstEl.focus();
}

function clearFieldErrors(panel) {
  panel.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
  panel.querySelectorAll('.field-error').forEach((el) => { el.textContent = ''; });
}

function appendGlobalError(container, message) {
  const banner = el('div', { class: 'error-banner', style: 'margin-bottom:12px' });
  const icon = el('span', { class: 'error-banner-icon', 'aria-hidden': 'true' });
  icon.textContent = '✕';
  banner.appendChild(icon);
  const body = el('div', { class: 'error-banner-body' });
  body.textContent = message;
  banner.appendChild(body);
  container.appendChild(banner);
}
