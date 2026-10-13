import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

// Session token is returned to JavaScript and kept in sessionStorage, not a
// persistent cookie. Reload preserves it; opening a fresh tab normally does not.
const TTL_MS = 12 * 60 * 60 * 1000;
function secret() {
  const value = process.env.ACCESS_SESSION_SECRET;
  if (!value || !process.env.VOTER_ACCESS_PIN) throw new Error('Configure access secrets');
  return value;
}
function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}
function safeEquals(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && timingSafeEqual(left, right);
}
export function issueAccessToken() {
  const payload = Buffer.from(JSON.stringify({
    expires: Date.now() + TTL_MS,
    nonce: randomBytes(16).toString('hex')
  })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function hasAccess(req) {
  try {
    const token = String(req.headers['x-contest-access'] || '');
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra || !safeEquals(signature, sign(payload))) return false;
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(parsed.expires) && parsed.expires > Date.now() && parsed.expires <= Date.now() + TTL_MS;
  } catch { return false; }
}
export function requireAccess(req, res) {
  try {
    if (hasAccess(req)) return true;
  } catch (error) {
    console.error('access config:', error);
    res.status(503).json({ error: 'Доступ временно не настроен' });
    return false;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(401).json({ error: 'Введите PIN для доступа к голосованию' });
  return false;
}
export function checkPin(pin) {
  const correct = process.env.VOTER_ACCESS_PIN;
  secret();
  return safeEquals(String(pin || ''), String(correct));
}
export function requireSameOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  try { if (new URL(origin).host === host) return true; } catch {}
  res.status(403).json({ error: 'Недопустимый источник запроса' });
  return false;
}
