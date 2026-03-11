import { z } from 'zod';

export const dashboardQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
