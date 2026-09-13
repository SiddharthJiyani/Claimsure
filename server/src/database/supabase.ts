/**
 * Supabase client — backend/service role.
 * Uses the SERVICE_ROLE_KEY which bypasses RLS for trusted server operations.
 * Never expose this key to the client.
 */

import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// Service role client — bypasses RLS, used for all backend queries
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Anon client — respects RLS, used to verify user JWTs
export const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
