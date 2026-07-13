import { createClient } from '@supabase/supabase-js'
// Server-side client. Uses the SERVICE ROLE key when present so API routes
// (create-event, slack, digests, etc.) keep working after RLS is enabled.
// Falls back to the anon key before the service key is set (pre-RLS = safe).
export const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
)
