import { requireAccess, requireSameOrigin } from './_access.js';
import { getClosedState, getVoterNames, apiError } from './_airtable.js';
export default async function handler(req,res) {
  if (!requireAccess(req,res)) return;
  if (req.method !== 'GET') return res.status(405).json({error:'Метод не поддерживается'});
  try {
    const [state, names] = await Promise.all([getClosedState(),getVoterNames()]);
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({closed:state.closed,names});
  } catch(e) { return apiError(res,e,'state'); }
}
