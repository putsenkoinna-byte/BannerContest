import { airtable, listAll, getClosedState, getWinners, SETTINGS_TABLE_ID, WORKS_TABLE_ID, VOTES_TABLE_ID, apiError } from './_airtable.js';
export default async function handler(req,res) {
  if (req.method !== 'POST') return res.status(405).json({error:'Метод не поддерживается'});
  if (!process.env.ADMIN_PIN) return res.status(503).json({error:'В Vercel не настроен ADMIN_PIN'});
  if (String(req.body?.pin || '') !== process.env.ADMIN_PIN) return res.status(403).json({error:'Неверный PIN-код'});
  try {
    const state = await getClosedState();
    if (!state.closed) {
      if (state.record) await airtable(`${SETTINGS_TABLE_ID}/${state.record.id}`,{method:'PATCH',body:JSON.stringify({fields:{Closed:true}})});
      else await airtable(SETTINGS_TABLE_ID,{method:'POST',body:JSON.stringify({fields:{Key:'contest',Closed:true}})});
    }
    const [works,votes] = await Promise.all([listAll(WORKS_TABLE_ID),listAll(VOTES_TABLE_ID)]);
    return res.status(200).json({closed:true,winners:getWinners(works,votes)});
  } catch(e) { return apiError(res,e,'finish'); }
}
