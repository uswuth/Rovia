/**
 * Utility helper to cleanly extract array items from standardized API envelopes:
 * `{ success: true, statusCode: 200, message: '...', data: { items: [...], pagination: {...} } }`
 * Supports Axios response wrappers, paginated `{ items: [...] }`, and direct array responses.
 */
export function extractApiItems<T = Record<string, unknown>>(res: unknown): T[] {
  if (!res) return [];

  let body: unknown = res;

  // Unwrap Axios response container (res.data) if present
  if (typeof res === 'object' && res !== null && 'data' in res) {
    const resObj = res as { data: unknown };
    body = resObj.data;

    // Unwrap API envelope (res.data.data) if present
    if (typeof body === 'object' && body !== null && 'data' in body) {
      body = (body as { data: unknown }).data;
    }
  }

  // Direct array payload
  if (Array.isArray(body)) {
    return body as T[];
  }

  // Object envelope containing items / members / users / data array
  if (typeof body === 'object' && body !== null) {
    const record = body as { items?: unknown[]; data?: unknown[]; members?: unknown[]; users?: unknown[] };
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.members)) return record.members as T[];
    if (Array.isArray(record.users)) return record.users as T[];
  }

  return [];
}

/**
 * Utility helper to cleanly extract a single item from standardized API envelopes:
 * `{ success: true, statusCode: 200, message: '...', data: { ... } }` or `{ data: { items: [...] } }`
 */
export function extractApiItem<T = Record<string, unknown>>(res: unknown): T | null {
  if (!res) return null;

  let body: unknown = res;

  // Unwrap Axios response container (res.data) if present
  if (typeof res === 'object' && res !== null && 'data' in res) {
    const resObj = res as { data: unknown };
    body = resObj.data;

    // Unwrap API envelope (res.data.data) if present
    if (typeof body === 'object' && body !== null && 'data' in body) {
      body = (body as { data: unknown }).data;
    }
  }

  // If body has an items array, pick the first item
  if (typeof body === 'object' && body !== null && 'items' in body && Array.isArray((body as { items: unknown[] }).items)) {
    const items = (body as { items: unknown[] }).items;
    return (items[0] as T) || null;
  }

  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    return body as T;
  }

  return null;
}
