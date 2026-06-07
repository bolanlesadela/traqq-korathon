import { z } from 'zod';

export const registerSchema = z.object({
  full_name: z
    .string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100),
  email: z
    .string()
    .email('Invalid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  business_name: z
    .string()
    .max(100)
    .optional(),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .toLowerCase(),
  password: z
    .string()
    .min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refresh_token: z
    .string()
    .min(1, 'Refresh token is required'),
});

export const updateLinkSchema = z.object({
  korapay_link: z
    .string()
    .url('Must be a valid URL')
    .refine(
      (url) => url.includes('korahq.com') || url.includes('korapay.com'),
      'Must be a valid Korapay payment link'
    ),
});
