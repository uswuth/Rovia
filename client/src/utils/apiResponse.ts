/** Extracts array items from API envelopes: axios wrapper, `{ items }`, or a direct array. */
export function extractApiItems<T = Record<string, unknown>>(res: unknown): T[] {
  if (!res) return [];

  let body: unknown = res;

  if (typeof res === 'object' && res !== null && 'data' in res) {
    const resObj = res as { data: unknown };
    body = resObj.data;

    if (typeof body === 'object' && body !== null && 'data' in body) {
      body = (body as { data: unknown }).data;
    }
  }

  if (Array.isArray(body)) {
    return body as T[];
  }

  if (typeof body === 'object' && body !== null) {
    const record = body as { items?: unknown[]; data?: unknown[]; members?: unknown[]; users?: unknown[] };
    if (Array.isArray(record.items)) return record.items as T[];
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.members)) return record.members as T[];
    if (Array.isArray(record.users)) return record.users as T[];
  }

  return [];
}

/** Extracts a single item from an API envelope, taking the first entry when the payload is a list. */
export function extractApiItem<T = Record<string, unknown>>(res: unknown): T | null {
  if (!res) return null;

  let body: unknown = res;

  if (typeof res === 'object' && res !== null && 'data' in res) {
    const resObj = res as { data: unknown };
    body = resObj.data;

    if (typeof body === 'object' && body !== null && 'data' in body) {
      body = (body as { data: unknown }).data;
    }
  }

  if (typeof body === 'object' && body !== null && 'items' in body && Array.isArray((body as { items: unknown[] }).items)) {
    const items = (body as { items: unknown[] }).items;
    return (items[0] as T) || null;
  }

  if (typeof body === 'object' && body !== null && !Array.isArray(body)) {
    return body as T;
  }

  return null;
}
