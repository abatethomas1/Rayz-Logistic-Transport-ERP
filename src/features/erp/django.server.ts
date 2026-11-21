import { getCookie, setCookie, deleteCookie, getRequest, setResponseHeader } from '@tanstack/react-start/server';
import type { DjangoSession } from './django-contract';

const accessCookie = 'rayz-django-access';
const refreshCookie = 'rayz-django-refresh';
const companyCookie = 'rayz-django-company';
function apiBase() {
  const configured = process.env['DJANGO_API_URL'];
  const base = configured || (import.meta.env.DEV ? 'http://127.0.0.1:8091' : '');
  if (!base) throw new Error('The Django service has not been connected.');
  const url = new URL(base);
  if (url.protocol !== 'https:' && !(import.meta.env.DEV && ['127.0.0.1', 'localhost'].includes(url.hostname))) throw new Error('The Django service must use HTTPS.');
  return `${url.origin}${url.pathname.replace(/\/$/, '').replace(/\/api\/v1$/, '')}/api/v1/`;
}
function cookieOptions(maxAge: number) { return { httpOnly: true, secure: !import.meta.env.DEV || new URL(getRequest().url).protocol === 'https:', sameSite: 'lax' as const, path: '/', maxAge }; }
export function clearDjangoSession() { for (const name of [accessCookie, refreshCookie, companyCookie]) deleteCookie(name, { path: '/' }); }
function saveTokens(tokens: { access: string; refresh?: string }) {
  setCookie(accessCookie, tokens.access, cookieOptions(60 * 10));
  if (tokens.refresh) setCookie(refreshCookie, tokens.refresh, cookieOptions(60 * 60 * 24));
}
export class DjangoApiError extends Error { constructor(public status: number, message: string) { super(message); } }
async function rawRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(new URL(path, apiBase()), { ...options, redirect: 'error' });
  if (!response.ok) {
    let message = response.status === 401 ? 'Your session expired. Sign in again.' : response.status === 404 ? 'Record not found in your company.' : 'The Django service could not complete this request.';
    try { const data = await response.json() as Record<string, unknown>; const detail = data['detail'] || data['message']; if (typeof detail === 'string') message = detail; else { const first = Object.values(data)[0]; if (Array.isArray(first) && typeof first[0] === 'string') message = first[0]; } } catch { /* No provider body is exposed. */ }
    throw new DjangoApiError(response.status, message);
  }
  return response;
}
export async function djangoRequest(path: string, options: RequestInit = {}, authenticated = true) {
  setResponseHeader('Cache-Control', 'private, no-store');
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && !(options.body instanceof FormData) && options.body) headers.set('Content-Type', 'application/json');
  if (authenticated) {
    let access = getCookie(accessCookie);
    if (!access) {
      const refresh = getCookie(refreshCookie);
      if (!refresh) throw new DjangoApiError(401, 'Sign in to your company workspace.');
      const response = await rawRequest('auth/refresh/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh }) });
      const tokens = await response.json() as { access: string; refresh?: string };
      saveTokens(tokens); access = tokens.access;
    }
    headers.set('Authorization', `Bearer ${access}`);
    const company = getCookie(companyCookie);
    if (company) headers.set('X-Company', company);
  }
  return rawRequest(path, { ...options, headers });
}
export async function djangoJson<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> { return await (await djangoRequest(path, options, authenticated)).json() as T; }
export async function readDjangoSession(): Promise<DjangoSession | null> {
  if (!getCookie(accessCookie) && !getCookie(refreshCookie)) return null;
  try {
    const identity = await djangoJson<Omit<DjangoSession, 'activeCompany'>>('auth/me/');
    const selected = getCookie(companyCookie);
    const activeCompany = identity.memberships.find((m) => m.company === selected)?.company ?? (identity.memberships.length === 1 ? identity.memberships[0]?.company ?? null : null);
    if (activeCompany && selected !== activeCompany) setCookie(companyCookie, activeCompany, cookieOptions(60 * 60 * 24));
    return { ...identity, activeCompany };
  } catch (error) {
    if (error instanceof DjangoApiError && error.status === 401) { clearDjangoSession(); return null; }
    throw error;
  }
}
export async function signInDjango(username: string, password: string) {
  const tokens = await djangoJson<{ access: string; refresh: string }>('auth/token/', { method: 'POST', body: JSON.stringify({ username, password }) }, false);
  const identity = await (await rawRequest('auth/me/', { headers: { Authorization: `Bearer ${tokens.access}` } })).json() as Omit<DjangoSession, 'activeCompany'>;
  const activeCompany = identity.memberships.length === 1 ? identity.memberships[0]?.company ?? null : null;
  clearDjangoSession(); saveTokens(tokens);
  if (activeCompany) setCookie(companyCookie, activeCompany, cookieOptions(60 * 60 * 24));
  return { ...identity, activeCompany };
}
export async function signOutDjango() {
  const refresh = getCookie(refreshCookie);
  try { if (refresh) await djangoJson('auth/logout/', { method: 'POST', body: JSON.stringify({ refresh }) }, false); }
  finally { clearDjangoSession(); }
}
export async function selectDjangoCompany(company: string) {
  const session = await readDjangoSession();
  if (!session?.memberships.some((m) => m.company === company)) throw new DjangoApiError(403, 'Company membership required.');
  setCookie(companyCookie, company, cookieOptions(60 * 60 * 24));
  return { ...session, activeCompany: company };
}

export async function proxyDjangoRequest(request: Request, splat: string) {
  if (!/^[a-zA-Z0-9/_-]*$/.test(splat)) return Response.json({ detail: 'Invalid API path.' }, { status: 400 });
  const bearer = request.headers.get('Authorization');
  if (!['GET', 'HEAD'].includes(request.method) && !bearer && request.headers.get('Origin') !== new URL(request.url).origin) return Response.json({ detail: 'Same-origin request required.' }, { status: 403 });
  const path = `${splat.replace(/\/$/, '')}/${new URL(request.url).search}`;
  const headers = new Headers();
  const type = request.headers.get('Content-Type'); if (type) headers.set('Content-Type', type);
  let body: BodyInit | undefined;
  if (!['GET', 'HEAD'].includes(request.method)) {
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > 12 * 1024 * 1024) return Response.json({ detail: 'Upload is too large.' }, { status: 413 });
    body = bytes;
  }
  try {
    let upstream: Response;
    if (bearer) {
      headers.set('Authorization', bearer);
      const selected = request.headers.get('X-Company'); if (selected) headers.set('X-Company', selected);
      upstream = await rawRequest(path, { method: request.method, headers, ...(body ? { body } : {}) });
    } else {
      upstream = await djangoRequest(path, { method: request.method, headers, ...(body ? { body } : {}) });
    }
    const outgoing = new Headers({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    for (const key of ['Content-Type', 'Content-Disposition']) { const value = upstream.headers.get(key); if (value) outgoing.set(key, value); }
    return new Response(upstream.body, { status: upstream.status, headers: outgoing });
  } catch (error) {
    return Response.json({ detail: error instanceof Error ? error.message : 'Django service unavailable.' }, { status: error instanceof DjangoApiError ? error.status : 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}