import { hasAccess, checkPin, issueAccessToken, requireSameOrigin } from './_access.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    try { return res.status(200).json({ authenticated: hasAccess(req) }); }
    catch { return res.status(503).json({ error: 'Вход не настроен' }); }
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Метод не поддерживается' });
  if (!requireSameOrigin(req, res)) return;
  try {
    if (!checkPin(req.body?.pin)) return res.status(403).json({ error: 'Неверный PIN-код' });
    return res.status(200).json({ authenticated: true, accessToken: issueAccessToken() });
  } catch (error) {
    console.error('access:', error);
    return res.status(503).json({ error: 'Вход временно недоступен' });
  }
}
