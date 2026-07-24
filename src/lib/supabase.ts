import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// These are baked into the bundle at build time, so on a host like Vercel they
// must be set as build environment variables (not just in a local .env). When
// they're missing we flag it and let main.tsx show a clear config screen
// instead of throwing here, which would blank the whole page.
export const missingSupabaseConfig = !url || !anonKey;

// A placeholder keeps createClient from throwing when config is absent; it is
// never contacted, because the app renders the config screen in that case.
export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
);
