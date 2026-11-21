import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const getDjangoSession = createServerFn({ method: 'GET' }).handler(async () => { const { readDjangoSession } = await import('./django.server'); return readDjangoSession(); });
export const loginDjango = createServerFn({ method: 'POST' }).inputValidator(z.object({ username: z.string().min(1).max(150), password: z.string().min(1).max(200) })).handler(async ({ data }) => { const { signInDjango } = await import('./django.server'); return signInDjango(data.username, data.password); });
export const logoutDjango = createServerFn({ method: 'POST' }).handler(async () => { const { signOutDjango } = await import('./django.server'); await signOutDjango(); return true; });
export const chooseDjangoCompany = createServerFn({ method: 'POST' }).inputValidator(z.object({ company: z.string().uuid() })).handler(async ({ data }) => { const { selectDjangoCompany } = await import('./django.server'); return selectDjangoCompany(data.company); });
export const djangoAccountAction = createServerFn({ method: 'POST' }).inputValidator(z.discriminatedUnion('action', [
  z.object({ action: z.literal('forgot'), email: z.string().email() }),
  z.object({ action: z.literal('reset'), uid: z.string().max(200), token: z.string().max(200), password: z.string().min(8).max(200) }),
  z.object({ action: z.literal('invite'), token: z.string().max(200), username: z.string().min(1).max(150), password: z.string().min(8).max(200) }),
  z.object({ action: z.literal('profile'), name: z.string().min(1).max(150), avatar: z.union([z.string().url(), z.literal('')]) }),
])).handler(async ({ data }) => {
  const { djangoJson, readDjangoSession } = await import('./django.server');
  const path = data.action === 'forgot' ? 'auth/password-reset/' : data.action === 'reset' ? 'auth/password-reset-confirm/' : data.action === 'invite' ? 'auth/accept-invitation/' : 'workspace/profile/';
  const authenticated = data.action === 'profile' || (data.action === 'invite' && Boolean(await readDjangoSession()));
  return djangoJson<{ message: string }>(path, { method: 'POST', body: JSON.stringify(data) }, authenticated);
});