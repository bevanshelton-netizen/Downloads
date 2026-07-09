import { supabase } from './supabase'
import { Database } from './database.types'

/**
 * Save a chat message to Supabase
 */
export async function saveChatMessage(
  userId: string,
  role: 'user' | 'assistant',
  content: string
) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert([
      {
        user_id: userId,
        role,
        content,
      },
    ])
    .select()

  if (error) {
    console.error('Error saving chat message:', error)
    throw error
  }

  return data
}

/**
 * Get chat history for a user
 */
export async function getChatHistory(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching chat history:', error)
    throw error
  }

  return data?.reverse() || []
}

/**
 * Get all laws
 */
export async function getLaws() {
  const { data, error } = await supabase
    .from('laws')
    .select('*')
    .order('law_number', { ascending: true })

  if (error) {
    console.error('Error fetching laws:', error)
    throw error
  }

  return data || []
}

/**
 * Get a specific law by number
 */
export async function getLawByNumber(lawNumber: number) {
  const { data, error } = await supabase
    .from('laws')
    .select('*')
    .eq('law_number', lawNumber)
    .single()

  if (error) {
    console.error('Error fetching law:', error)
    throw error
  }

  return data
}

/**
 * Get all products
 */
export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching products:', error)
    throw error
  }

  return data || []
}

/**
 * Get user subscription
 */
export async function getUserSubscription(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching subscription:', error)
    throw error
  }

  return data || null
}

/**
 * Create or update user profile
 */
export async function upsertUserProfile(
  userId: string,
  email: string,
  displayName?: string
) {
  const { data, error } = await supabase
    .from('users')
    .upsert(
      {
        id: userId,
        email,
        display_name: displayName,
      },
      {
        onConflict: 'id',
      }
    )
    .select()

  if (error) {
    console.error('Error upserting user profile:', error)
    throw error
  }

  return data
}
