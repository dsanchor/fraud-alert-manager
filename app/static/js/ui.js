/* Toast / live-region feedback */
import { el } from './dom.js';

const region = document.getElementById('toast-region');

export function showToast(message, type = 'default', duration = 4000) {
  const toast = el('div', { class: `toast toast-${type}`, role: 'status' });
  toast.textContent = message;
  region.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 320);
  }, duration);
}

/* Accessible confirmation dialog */
const dialog = document.getElementById('confirm-dialog');
const descEl = document.getElementById('dialog-desc');
const cancelBtn = document.getElementById('dialog-cancel');
const confirmBtn = document.getElementById('dialog-confirm');

let _resolve = null;

cancelBtn.addEventListener('click', () => {
  if (_resolve) _resolve(false);
  dialog.close();
});
confirmBtn.addEventListener('click', () => {
  if (_resolve) _resolve(true);
  dialog.close();
});
dialog.addEventListener('cancel', () => {
  if (_resolve) _resolve(false);
});

/**
 * Show a confirmation dialog. Returns a promise resolving to true/false.
 * @param {string} message
 */
export function confirmDialog(message) {
  descEl.textContent = message;
  // Cancel button gets initial focus; confirm is not the default
  dialog.showModal();
  cancelBtn.focus();
  return new Promise((resolve) => {
    _resolve = resolve;
  });
}

/* Loading state helpers */
export function setAppBusy(busy) {
  const main = document.getElementById('main');
  if (busy) main.setAttribute('aria-busy', 'true');
  else main.setAttribute('aria-busy', 'false');
}
