import { requireAccess, requireSameOrigin } from './_access.js';
import { getClosedState, listAll, getWinners, VOTES_TABLE_ID, WORKS_TABLE_ID, apiError } from './_airtable.js';
export default async function handler(req,res) {
  if (!requireAccess(req,res)) return;
  if (req.method !== 'GET') return res.status(405).json({error:'Метод не поддерживается'});
  try {
    if (!(await getClosedState()).closed) return res.status(403).json({error:'Результаты станут доступны после завершения голосования'});
    const [works,votes] = await Promise.all([listAll(WORKS_TABLE_ID),listAll(VOTES_TABLE_ID)]);
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({winners:getWinners(works,votes)});
  } catch(e) { return apiError(res,e,'winners'); }
}
