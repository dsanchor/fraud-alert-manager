/* Safe DOM builder utilities — never use innerHTML with dynamic data */

/**
 * Create an element with optional attributes and append children.
 * @param {string} tag
 * @param {Record<string, string>} [attrs]
 * @param {...(Node|string|null|undefined)} children
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'for') node.htmlFor = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

/** Create a text node */
export function txt(str) {
  return document.createTextNode(String(str ?? ''));
}

/** Set textContent safely */
export function setText(node, value) {
  node.textContent = String(value ?? '');
  return node;
}

/** Clear all children of a node */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Replace all children of a node */
export function replaceChildren(node, ...children) {
  clear(node);
  for (const child of children) {
    if (child == null) continue;
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

/**
 * Build a badge element from a status string.
 * Color is derived from common pattern matching — never from user HTML.
 */
export function statusBadge(value) {
  const text = String(value ?? '—');
  let cls = 'badge-gray';
  const upper = text.toUpperCase();
  if (upper.includes('NON_COMP') || upper.includes('FAIL') || upper.includes('REJECT') || upper.includes('ESCALATE')) cls = 'badge-red';
  else if (upper.includes('COMPLIANT') || upper.includes('PASS') || upper.includes('CLEAR') || upper.includes('OK')) cls = 'badge-green';
  else if (upper.includes('POTENTIAL') || upper.includes('WARN') || upper.includes('GAP') || upper.includes('REVIEW')) cls = 'badge-yellow';
  else if (upper.includes('HIGH')) cls = 'badge-red';
  else if (upper.includes('MEDIUM') || upper.includes('MED')) cls = 'badge-yellow';
  else if (upper.includes('LOW')) cls = 'badge-green';
  else if (upper.includes('INSUF') || upper.includes('PENDING')) cls = 'badge-blue';
  const badge = el('span', { class: `badge ${cls}` });
  badge.textContent = text;
  return badge;
}

/** Build a detail field row */
export function detailField(label, value, mono = false) {
  const wrap = el('div', { class: 'detail-field' });
  wrap.appendChild(el('span', { class: 'detail-field-label' }, label));
  const valEl = el('span', { class: `detail-field-value${mono ? ' mono' : ''}` });
  if (value == null || value === '') {
    valEl.textContent = '—';
    valEl.classList.add('text-muted');
  } else {
    valEl.textContent = String(value);
  }
  wrap.appendChild(valEl);
  return wrap;
}

/** Build a detail field with a badge value */
export function detailBadgeField(label, value) {
  const wrap = el('div', { class: 'detail-field' });
  wrap.appendChild(el('span', { class: 'detail-field-label' }, label));
  wrap.appendChild(statusBadge(value));
  return wrap;
}

/** Build a detail field with a list of strings */
export function detailListField(label, items) {
  const wrap = el('div', { class: 'detail-field' });
  wrap.appendChild(el('span', { class: 'detail-field-label' }, label));
  if (!items || items.length === 0) {
    const empty = el('span', { class: 'text-muted detail-field-value' }, '(empty)');
    wrap.appendChild(empty);
  } else {
    const ul = el('ul', { class: 'list-value' });
    for (const item of items) {
      ul.appendChild(el('li', {}, item));
    }
    wrap.appendChild(ul);
  }
  return wrap;
}
