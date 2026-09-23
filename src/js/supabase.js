/* Shared Supabase client. URL + anon key come from build-time env vars
   (.env.local locally, GitHub repo variables in CI). The anon key is public
   by design; row-level security in supabase/schema.sql does the protecting. */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);
export const BUCKET = 'inquiry-files';

export const supabase = isConfigured
  ? createClient(url, key, { auth: { persistSession: true, storageKey: 'ws-team-auth' } })
  : null;
