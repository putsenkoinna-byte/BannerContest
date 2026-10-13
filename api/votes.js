import { requireAccess, requireSameOrigin } from './_access.js';
import { listAll, VOTES_TABLE_ID, apiError } from './_airtable.js';
export default async function handler(req,res) {
  if (!requireAccess(req,res)) return;
  if (req.method !== 'GET') return res.status(405).json({error:'Метод не поддерживается'});
  try { res.setHeader('Cache-Control','no-store'); return res.status(200).json({records:await listAll(VOTES_TABLE_ID)}); }
  catch (e) { return apiError(res,e,'votes'); }
}
