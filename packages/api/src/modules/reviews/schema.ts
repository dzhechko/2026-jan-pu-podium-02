import { z } from 'zod';

export const submitReviewSchema = z.object({
  stars: z.number().int().min(1).max(5),
  text: z.string().min(10, 'Минимум 10 символов').max(2000),
});

export const listReviewsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sentiment: z.enum(['POSITIVE', 'NEGATIVE', 'NEUTRAL']).optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type ListReviewsQuery = z.infer<typeof listReviewsSchema>;
