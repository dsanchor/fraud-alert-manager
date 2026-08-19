/* Application state */

export const state = {
  alerts: [],
  total: 0,
  limit: 50,
  offset: 0,
  current: null,
  status: 'idle', // 'idle' | 'loading' | 'error'
  error: null,
  /** draft is the working object in the create/edit form */
  draft: null,
};

/** Server-managed fields that must be stripped before PUT/POST */
export const SERVER_FIELDS = ['id', 'created_at', 'updated_at', 'version'];

/** Strip server-managed fields from a full alert object */
export function stripServerFields(alert) {
  const copy = { ...alert };
  for (const f of SERVER_FIELDS) delete copy[f];
  return copy;
}

/** Deep clone a value via JSON round-trip (safe for plain data objects) */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
