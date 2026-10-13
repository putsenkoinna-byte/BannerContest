import { requireAccess, requireSameOrigin } from './_access.js';
import { airtable, listAll, getClosedState, getWinners, SETTINGS_TABLE_ID, WORKS_TABLE_ID, VOTES_TABLE_ID, getSnapshotKey, apiError } from './_airtable.js';
export default async function handler(req,res) {
  if (!requireAccess(req,res)) return;
  if (!requireSameOrigin(req,res)) return;
  if (req.method !== 'POST') return res.status(405).json({error:'Метод не поддерживается'});
  if (!process.env.ADMIN_PIN) return res.status(503).json({error:'В Vercel не настроен ADMIN_PIN'});
  if (String(req.body?.pin || '') !== process.env.ADMIN_PIN) return res.status(403).json({error:'Неверный PIN-код'});
  try {
    const state = await getClosedState();
    const [works,votes] = await Promise.all([listAll(WORKS_TABLE_ID),listAll(VOTES_TABLE_ID)]);
    if (!state.closed) {
      // Save exactly which vote records existed at the moment of closure.
      // Removing any one of them later in Airtable reopens the contest.
      const fields = { Key: getSnapshotKey(votes), Closed: true };
      if (state.record) await airtable(`${SETTINGS_TABLE_ID}/${state.record.id}`,{method:'PATCH',body:JSON.stringify({fields})});
      else await airtable(SETTINGS_TABLE_ID,{method:'POST',body:JSON.stringify({fields})});
    }
    return res.status(200).json({closed:true,winners:getWinners(works,votes)});
  } catch(e) { return apiError(res,e,'finish'); }
}
