import { requireAccess, requireSameOrigin } from './_access.js';
import { airtable, listAll, WORKS_TABLE_ID, VOTES_TABLE_ID, getClosedState, getVoterNames, key, linkedIds, apiError, MAX_VOTES, canonicalVotes } from './_airtable.js';
export default async function handler(req,res) {
  if (!requireAccess(req,res)) return;
  if (!requireSameOrigin(req,res)) return;
  if (req.method !== 'POST') return res.status(405).json({error:'Метод не поддерживается'});
  const {action,contestWork} = req.body || {};
  const voterName = String(req.body?.voterName || '').trim();
  if (!['add','delete'].includes(action) || !/^rec[a-zA-Z0-9]+$/.test(String(contestWork)) || !voterName) return res.status(400).json({error:'Неверный запрос'});
  try {
    const [state, names, votes, works] = await Promise.all([
      getClosedState(),getVoterNames(),listAll(VOTES_TABLE_ID),listAll(WORKS_TABLE_ID)
    ]);
    if (state.closed) return res.status(409).json({error:'Голосование уже завершено'});
    if (!names.some(n => key(n) === key(voterName))) return res.status(403).json({error:'Сначала зарегистрируйте имя'});
    const work = works.find(w => w.id === contestWork);
    if (!work || !work.fields?.Username || !(work.fields?.['Конкурсные работы'] || []).length) return res.status(404).json({error:'Работа не найдена'});
    if (/без\s+голосования/i.test(String(work.fields?.['Примечания'] || ''))) return res.status(403).json({error:'Голосование за эту работу недоступно'});
    const canonical = canonicalVotes(works, votes);
    const own = canonical.filter(v => key(v.fields?.['Voter Name']) === key(voterName));
    const existing = own.find(v => linkedIds(v).includes(contestWork));
    if (action === 'delete') {
      const duplicates = votes.filter(v => key(v.fields?.['Voter Name'])===key(voterName) && linkedIds(v).includes(contestWork));
      if (!duplicates.length) return res.status(200).json({success:true});
      await Promise.all(duplicates.map(v => airtable(`${VOTES_TABLE_ID}/${v.id}`,{method:'DELETE'})));
      return res.status(200).json({success:true});
    }
    if (existing) return res.status(409).json({error:'Голос за эту работу уже отдан'});
    if (own.length >= MAX_VOTES) return res.status(409).json({error:'Лимит 5 голосов исчерпан'});
    const byId = new Map(works.map(w => [w.id,w]));
    if (own.some(v => linkedIds(v).some(id => key(byId.get(id)?.fields?.Username) === key(work.fields.Username))))
      return res.status(409).json({error:'За этого автора вы уже голосовали'});
    const created = await airtable(VOTES_TABLE_ID,{method:'POST',body:JSON.stringify({fields:{'Voter Name':voterName,'Contest Work':[contestWork],'Date/Time':new Date().toISOString()}})});
    // Best effort to reconcile duplicate concurrent submissions in Airtable.
    const latest = await listAll(VOTES_TABLE_ID);
    const latestOwn = latest.filter(v => key(v.fields?.['Voter Name'])===key(voterName) && linkedIds(v).some(id => key(works.find(w => w.id===id)?.fields?.Username)===key(work.fields.Username)));
    latestOwn.sort((a,b) => String(a.createdTime||'').localeCompare(String(b.createdTime||'')) || a.id.localeCompare(b.id));
    if (latestOwn.length > 1) await Promise.all(latestOwn.slice(1).map(v=>airtable(`${VOTES_TABLE_ID}/${v.id}`,{method:'DELETE'})));
    return res.status(201).json({success:true,record:created});
  } catch(e) { return apiError(res,e,'vote'); }
}
