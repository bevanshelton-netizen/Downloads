import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials are not configured')
}

export const supabase = createClient<Database>(
  supabaseUrl || '',
  supabaseAnonKey || ''
)

/**
 * Get the current user session
 */
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/**
 * Get the current session
 */
export async function getSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}
