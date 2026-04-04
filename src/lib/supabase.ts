import { createClient } from '@supabase/supabase-js'

// Turbopack compiles unset NEXT_PUBLIC_ vars as the string "undefined" (truthy),
// which bypasses the || fallback and breaks createClient. Use startsWith check.
const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseUrl = rawUrl.startsWith('http') ? rawUrl : 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role (API routes only)
export function createServiceClient() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const url = raw.startsWith('http') ? raw : 'https://placeholder.supabase.co'
  return createClient(
    url,
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
