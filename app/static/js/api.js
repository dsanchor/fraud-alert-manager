/* Centralised API client */

const BASE = '/api/v1/fraud-alerts';

export class ApiError extends Error {
  constructor(status, detail, raw) {
    super(typeof detail === 'string' ? detail : 'API error');
    this.status = status;
    this.detail = detail; // may be string or FastAPI 422 array
    this.raw = raw;
  }
}

/**
 * Map FastAPI 422 detail array to a field→message map.
 * loc paths look like ["body","decision_support","calculation_inputs","non_compliant_rule_count"]
 * We join from index 1 (skip "body") with dots.
 */
export function map422Errors(detail) {
  const map = {};
  if (!Array.isArray(detail)) return map;
  for (const err of detail) {
    if (!Array.isArray(err.loc)) continue;
    const path = err.loc.slice(1).join('.');
    map[path] = err.msg;
  }
  return map;
}

async function request(method, url, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  };
  if (body != null) opts.body = JSON.stringify(body);

  let response;
  try {
    response = await fetch(url, opts);
  } catch (networkErr) {
    throw new ApiError(0, 'Network error — check your connection.', networkErr);
  }

  if (response.status === 204) return null;

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const detail = (data && data.detail) ? data.detail : `HTTP ${response.status}`;
    throw new ApiError(response.status, detail, data);
  }
  return data;
}

export function listAlerts({ limit = 50, offset = 0 } = {}) {
  return request('GET', `${BASE}?limit=${limit}&offset=${offset}`);
}

export function getAlert(id) {
  return request('GET', `${BASE}/${encodeURIComponent(id)}`);
}

export function createAlert(body) {
  return request('POST', BASE, body);
}

export function replaceAlert(id, body) {
  return request('PUT', `${BASE}/${encodeURIComponent(id)}`, body);
}

export function deleteAlert(id) {
  return request('DELETE', `${BASE}/${encodeURIComponent(id)}`);
}
