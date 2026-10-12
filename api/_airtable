const BASE_ID = "appSxQXkQdS7Z9V6b";
const VOTES_TABLE_ID = "tblbzFEy8wRU63bv1";
const WORKS_TABLE_ID = "tblw7e0Mp2HGsym5n";

export function getToken() {
  const token = process.env.AIRTABLE_TOKEN;
  if (!token) throw new Error("AIRTABLE_TOKEN is not configured");
  return token;
}

export async function airtable(path, options = {}) {
  const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.error?.type || `Airtable HTTP ${response.status}`;
    throw new Error(message);
  }
  return data;
}

export async function listAll(tableId, params = {}) {
  const records = [];
  let offset;

  do {
    const qs = new URLSearchParams(params);
    qs.set("pageSize", "100");
    if (offset) qs.set("offset", offset);

    const data = await airtable(`${tableId}?${qs.toString()}`);
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);

  return records;
}

export { VOTES_TABLE_ID, WORKS_TABLE_ID };
