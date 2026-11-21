import { createServerFn } from '@tanstack/react-start';
import { reportQuerySchema } from './report-query';
export const loadReport = createServerFn({ method: 'GET' }).inputValidator(reportQuerySchema).handler(async ({ data }) => {
  const { djangoJson } = await import('./django.server');
  return djangoJson<Record<string, string | number>[]>('workspace/reports/', { method: 'POST', body: JSON.stringify(data) });
});
