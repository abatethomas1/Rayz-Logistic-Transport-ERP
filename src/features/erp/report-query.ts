import { z } from 'zod';
export const reportQuerySchema = z.object({
  department: z.enum(['logistics', 'transport', 'finance']),
  view: z.string().max(50).default(''),
  operationId: z.string().max(200).default(''), customer: z.string().max(200).default(''),
  status: z.string().max(100).default(''), search: z.string().max(200).default(''),
  from: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).default(''),
  to: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).default(''),
}).refine((q) => !q.from || !q.to || q.from <= q.to, 'Start date must not follow end date');
export type ReportQuery = z.input<typeof reportQuerySchema>;