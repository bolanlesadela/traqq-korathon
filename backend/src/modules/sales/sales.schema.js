import { z } from 'zod';
import { PLATFORMS, PLATFORM_LIST } from '../../config/constants.js';

export const manualSaleSchema = z.object({
  amount: z
    .number({ invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be greater than 0')
    .max(100_000_000, 'Amount too large'),

  platform: z
    .enum(PLATFORM_LIST, {
      errorMap: () => ({ message: `Platform must be one of: ${PLATFORM_LIST.join(', ')}` }),
    }),

  product_name: z
    .string()
    .max(200)
    .optional(),

  currency: z
    .enum(['NGN', 'USD', 'GHS'])
    .default('NGN'),

  // Vendor can backdate manual entries
  sale_date: z
    .string()
    .datetime({ message: 'sale_date must be ISO 8601 format' })
    .optional(),
});

export const salesQuerySchema = z.object({
  platform: z.enum(PLATFORM_LIST).optional(),
  status:   z.enum(['pending', 'success', 'failed']).optional(),
  source:   z.enum(['auto', 'manual']).optional(),
  from:     z.string().datetime().optional(),
  to:       z.string().datetime().optional(),
  period:   z.enum(['today', 'week', 'month']).optional(),
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(100).default(20),
});
