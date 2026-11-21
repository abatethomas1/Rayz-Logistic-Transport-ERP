import { createFileRoute } from '@tanstack/react-router';
async function handle(request: Request, splat: string) {
  const { proxyDjangoRequest } = await import('@/features/erp/django.server');
  return proxyDjangoRequest(request, splat);
}
export const Route = createFileRoute('/api/v1/$')({
  server: { handlers: { GET: ({ request, params }) => handle(request, params._splat || ''), POST: ({ request, params }) => handle(request, params._splat || ''), PATCH: ({ request, params }) => handle(request, params._splat || ''), DELETE: ({ request, params }) => handle(request, params._splat || '') } },
});