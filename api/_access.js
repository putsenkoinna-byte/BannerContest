import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'cosplaybattle_access';
const MAX_AGE = 7 * 24 * 60 * 60;

function secret() {
  // Derive the signing key from private, server-side environment variables.
  const value = process.env.ACCESS_SESSION_SECRET || process.env.AIRTABLE_TOKEN;
  if (!value || !process.env.VOTER_ACCESS_PIN) throw new Error('Configure VOTER_ACCESS_PIN and ACCESS_SESSION_SECRET');
  return value;
}
function sign(payload) {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}
function compare(a,b) {
  const left=Buffer.from(String(a)); const right=Buffer.from(String(b));
  return left.length===right.length && timingSafeEqual(left,right);
}
export function hasAccess(req) {
  try {
    const cookie = (req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='));
    if (!cookie) return false;
    const token = cookie.slice(COOKIE.length+1);
    const [expires, signature] = token.split('.');
    if (!/^\d+$/.test(expires) || !signature || Number(expires) <= Date.now()) return false;
    return compare(sign(expires), signature);
  } catch { return false; }
}
export function requireAccess(req,res) {
  try {
    if (hasAccess(req)) return true;
  } catch (err) { console.error('access config:', err); res.status(503).json({error:'Доступ временно не настроен'}); return false; }
  res.setHeader('Cache-Control','no-store');
  res.status(401).json({error:'Введите PIN для доступа к голосованию'});
  return false;
}
export function checkPin(pin) {
  const actual=process.env.VOTER_ACCESS_PIN;
  secret();
  return compare(String(pin||''), actual);
}
export function setAccessCookie(req,res) {
  const expires=String(Date.now()+MAX_AGE*1000);
  const token=expires+'.'+sign(expires);
  const proto=String(req.headers['x-forwarded-proto'] || 'https');
  const secure=proto==='https' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${MAX_AGE}${secure}`);
  res.setHeader('Cache-Control','no-store');
}
export function requireSameOrigin(req,res) {
  const origin=req.headers.origin;
  if (!origin) return true; // Some browsers omit Origin; authentication still required.
  const host=req.headers['x-forwarded-host'] || req.headers.host;
  try {
    if (new URL(origin).host===host) return true;
  } catch {}
  res.status(403).json({error:'Недопустимый источник запроса'});
  return false;
}
