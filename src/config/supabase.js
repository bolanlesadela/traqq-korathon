import { createClient } from '@supabase/supabase-js';
import { env } from './env.js';

/**
 * Service role client — bypasses Row Level Security.
 * ONLY used server-side. Never expose this key to the frontend.
 * Used for all backend DB operations.
 */
export const supabase = createClient(
  env.supabase.url,
  env.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
