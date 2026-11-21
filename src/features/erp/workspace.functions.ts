import { createServerFn } from '@tanstack/react-start';
import type { Json } from '@/integrations/supabase/types';
import { z } from 'zod';
import { roles } from './model';
import { masterSchema, operationalSchema } from './production-model';
import type { DjangoWorkspace } from './django-contract';

export const loadWorkspace = createServerFn({ method: 'GET' }).handler(async () => {
  const { djangoJson } = await import('./django.server');
  return djangoJson<DjangoWorkspace>('workspace/');
});
export const inviteStaff = createServerFn({ method: 'POST' }).inputValidator(z.object({ email: z.string().email(), name: z.string().min(1), role: z.enum(roles), origin: z.string().url() })).handler(async ({ data }) => {
  const { djangoJson } = await import('./django.server');
  return djangoJson<Json>('workspace/invitations/', { method: 'POST', body: JSON.stringify(data) });
});
export const mutateWorkspace = createServerFn({ method: 'POST' }).inputValidator((input: { action: string; input: Json }) => input).handler(async ({ data }) => {
  const { djangoJson } = await import('./django.server');
  return djangoJson<Json>('workspace/actions/', { method: 'POST', body: JSON.stringify(data) });
});
export const assignStaff = createServerFn({ method: 'POST' }).inputValidator(z.object({ staff_id: z.string().uuid(), staff_role: z.string().max(100), operation_id: z.string().max(200).optional(), work_area: z.string().max(50).optional() })).handler(async ({ data }) => {
  const { djangoJson } = await import('./django.server');
  return djangoJson<Json>('workspace/assignments/', { method: 'POST', body: JSON.stringify(data) });
});
export const saveMaster = createServerFn({ method: 'POST' }).inputValidator(masterSchema).handler(async ({ data }) => {
  const { djangoJson } = await import('./django.server');
  await djangoJson('workspace/master-data/', { method: 'POST', body: JSON.stringify(data) });
  return true;
});
export const operationalAction = createServerFn({ method: 'POST' }).inputValidator(operationalSchema).handler(async ({ data }) => {
  const { djangoJson } = await import('./django.server');
  return djangoJson<Json>('workspace/operational-actions/', { method: 'POST', body: JSON.stringify(data) });
});
