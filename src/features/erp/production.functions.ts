import { createServerFn } from '@tanstack/react-start';
import type { DjangoDocument } from './django-contract';
export const uploadDocument = createServerFn({ method: 'POST' }).inputValidator((input: FormData) => { if (!(input instanceof FormData)) throw new Error('Document upload required.'); return input; }).handler(async ({ data }) => {
  const { djangoJson } = await import('./django.server');
  return djangoJson<DjangoDocument>('workspace/documents/', { method: 'POST', body: data });
});
export const listDocuments = createServerFn({ method: 'GET' }).handler(async () => {
  const { djangoJson } = await import('./django.server');
  return djangoJson<DjangoDocument[]>('workspace/documents/');
});
