const BASE_ID = process.env.AIRTABLE_BASE_ID || 'appSxQXkQdS7Z9V6b';
export const VOTES_TABLE_ID = process.env.AIRTABLE_VOTES_TABLE_ID || 'tblbzFEy8wRU63bv1';
export const WORKS_TABLE_ID = process.env.AIRTABLE_WORKS_TABLE_ID || 'tblw7e0Mp2HGsym5n';
export const VOTERS_TABLE_ID = process.env.AIRTABLE_VOTERS_TABLE_ID;
export const SETTINGS_TABLE_ID = process.env.AIRTABLE_SETTINGS_TABLE_ID;
export const DEFAULT_VOTERS = ['Рома', 'Вика', 'Арина', 'Карина', 'Андрей'];
export const MAX_VOTES = 5;
export const normalize = s => String(s || '').trim().replace(/\s+/g, ' ');
export const key = s => normalize(s).replace(/^@+/, '').toLocaleLowerCase('ru');
export const linkedIds = record => {
  const ids = record?.fields?.['Contest Work'];
  return Array.isArray(ids) ? ids : ids ? [ids] : [];
};
export const apiError = (res, err, label) => {
  console.error(label, err);
  return res.status(502).json({ error: 'Ошибка обращения к Airtable. Проверьте настройки и права таблиц.' });
};
export async function airtable(path, options = {}) {
  if (!process.env.AIRTABLE_TOKEN) throw new Error('Missing AIRTABLE_TOKEN');
  const response = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Airtable ${response.status}: ${data?.error?.message || data?.error?.type || 'error'}`);
  return data;
}
export async function listAll(tableId) {
  if (!tableId) throw new Error('Missing Airtable table environment variable');
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.set('offset', offset);
    const data = await airtable(`${tableId}?${params}`);
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return records;
}
// Key keeps an exact snapshot of Airtable vote record IDs when the contest closes.
// No new Airtable fields are required: 'contest|recXXX,recYYY'.
// Any deleted vote ID reopens the contest automatically. New votes never reopen it.
export const getSnapshotKey = votes => 'contest|' + votes.map(v => v.id).sort().join(',');
export async function getClosedState() {
  const rows = await listAll(SETTINGS_TABLE_ID);
  const row = rows.find(r => {
    const value = String(r.fields?.Key || '');
    return value === 'contest' || value.startsWith('contest|');
  });
  if (!row?.fields?.Closed) return { closed: false, record: row };

  const rawKey = String(row.fields?.Key || '');
  const hasSnapshot = rawKey.startsWith('contest|');
  const savedIds = hasSnapshot ? rawKey.slice('contest|'.length).split(',').filter(Boolean) : [];

  // Earlier versions recorded Closed only; they did not record a snapshot.
  // Such an old closure cannot be matched to removed votes, so reset once.
  if (!hasSnapshot) {
    await airtable(`${SETTINGS_TABLE_ID}/${row.id}`, {
      method: 'PATCH', body: JSON.stringify({ fields: { Key: 'contest', Closed: false } })
    });
    return { closed: false, record: { ...row, fields: { ...row.fields, Closed: false } } };
  }

  const current = new Set((await listAll(VOTES_TABLE_ID)).map(v => v.id));
  // A closed contest with zero current votes must always reopen.
  // This also fixes old closed snapshots whose saved ID list was empty.
  const deleted = current.size === 0 || savedIds.some(id => !current.has(id));
  if (deleted) {
    await airtable(`${SETTINGS_TABLE_ID}/${row.id}`, {
      method: 'PATCH', body: JSON.stringify({ fields: { Key: 'contest', Closed: false } })
    });
    return { closed: false, record: { ...row, fields: { ...row.fields, Key: 'contest', Closed: false } } };
  }
  return { closed: true, record: row };
}
export async function getVoterNames() {
  const rows = await listAll(VOTERS_TABLE_ID);
  const names = new Map(DEFAULT_VOTERS.map(n => [key(n), n]));
  for (const r of rows) {
    const n = normalize(r.fields?.Name);
    if (n && !names.has(key(n))) names.set(key(n), n);
  }
  return [...names.values()];
}
export function getWinners(works, votes) {
  votes = canonicalVotes(works, votes);
  const perAuthor = new Map();
  const workById = new Map(works.map(w => [w.id, w]));
  for (const w of works) {
    const name = normalize(w.fields?.Username).replace(/^@+/, '');
    if (!name) continue;
    const k = key(name);
    if (!perAuthor.has(k)) perAuthor.set(k, { username: name, count: 0, bestWorkId: w.id, bestVotes: 0, link: '' });
    const item = perAuthor.get(k);
    if (!item.link) item.link = String(w.fields?.['Ссылка на пост'] || '');
  }
  const workVotes = new Map();
  for (const v of votes) for (const id of linkedIds(v)) workVotes.set(id, (workVotes.get(id) || 0) + 1);
  for (const [id, count] of workVotes) {
    const w = workById.get(id);
    const item = perAuthor.get(key(w?.fields?.Username));
    if (!item) continue;
    item.count += count;
    if (count > item.bestVotes) {
      item.bestVotes = count;
      item.bestWorkId = id;
      item.link = String(w.fields?.['Ссылка на пост'] || '');
    }
  }
  return [...perAuthor.values()].filter(x => x.count > 0)
    .sort((a,b) => b.count - a.count || a.username.localeCompare(b.username, 'ru'))
    .slice(0,5).map(({ bestVotes, bestWorkId, ...x }, index) => ({ rank:index+1, ...x }));
}

// Deterministic canonical votes: one per voter+author, ignoring orphan records.
export function canonicalVotes(works, votes) {
  const authorById = new Map(works.map(w => [w.id, key(w.fields?.Username)]));
  const sorted = [...votes].sort((a,b) => String(a.createdTime || '').localeCompare(String(b.createdTime || '')) || String(a.id).localeCompare(String(b.id)));
  const seen = new Set();
  return sorted.filter(v => {
    const voter = key(v.fields?.['Voter Name']);
    const author = linkedIds(v).map(id => authorById.get(id)).find(Boolean);
    if (!voter || !author) return false;
    const fingerprint = `${voter}|${author}`;
    if (seen.has(fingerprint)) return false;
    seen.add(fingerprint);
    return true;
  });
}
