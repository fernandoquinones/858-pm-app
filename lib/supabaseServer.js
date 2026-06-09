import { createClient } from '@supabase/supabase-js'
// Server-side client (RLS off in prototype). Used by API routes.
export const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)
