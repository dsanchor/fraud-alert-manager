/* Hash router */

const routes = [];

export function addRoute(pattern, handler) {
  routes.push({ pattern, handler });
}

export function navigate(hash) {
  window.location.hash = hash;
}

function match(hash) {
  const path = hash.replace(/^#/, '') || '/alerts';
  for (const { pattern, handler } of routes) {
    if (typeof pattern === 'string') {
      if (pattern === path) return { handler, params: {} };
    } else if (pattern instanceof RegExp) {
      const m = path.match(pattern);
      if (m) return { handler, params: m.groups ?? {} };
    }
  }
  return null;
}

function dispatch() {
  const hash = window.location.hash || '#/alerts';
  const result = match(hash);
  if (result) {
    result.handler(result.params);
  } else {
    // Default to alerts list
    const fallback = match('#/alerts');
    if (fallback) fallback.handler({});
  }
  // Update nav active state
  updateNavState(hash);
}

function updateNavState(hash) {
  document.querySelectorAll('.nav-link').forEach((a) => {
    a.removeAttribute('aria-current');
  });
  const alertsLink = document.getElementById('nav-alerts');
  const newLink = document.getElementById('nav-new');
  if (hash.startsWith('#/alerts/new')) {
    if (newLink) newLink.setAttribute('aria-current', 'page');
  } else if (hash.startsWith('#/alerts')) {
    if (alertsLink) alertsLink.setAttribute('aria-current', 'page');
  }
}

export function initRouter() {
  window.addEventListener('hashchange', dispatch);
  window.addEventListener('DOMContentLoaded', dispatch);
  // If DOMContentLoaded already fired (module loads after)
  if (document.readyState !== 'loading') dispatch();
}
