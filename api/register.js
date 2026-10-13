import { requireAccess, requireSameOrigin } from './_access.js';
import { airtable, listAll, VOTERS_TABLE_ID, getClosedState, getVoterNames, normalize, key, apiError } from './_airtable.js';
export default async function handler(req,res) {
  if (!requireAccess(req,res)) return;
  if (!requireSameOrigin(req,res)) return;
  if (req.method !== 'POST') return res.status(405).json({error:'Метод не поддерживается'});
  const name = normalize(req.body?.name);
  if (name.length < 2 || name.length > 60 || /[<>\r\n]/.test(name)) return res.status(400).json({error:'Введите имя от 2 до 60 символов'});
  try {
    if ((await getClosedState()).closed) return res.status(409).json({error:'Голосование завершено'});
    if ((await getVoterNames()).some(n => key(n) === key(name))) return res.status(409).json({error:'Такое имя уже есть. Выберите его в списке или уточните имя.'});
    await airtable(VOTERS_TABLE_ID, { method:'POST', body: JSON.stringify({fields:{Name:name}}) });
    return res.status(201).json({success:true,name});
  } catch(e) { return apiError(res,e,'register'); }
}
