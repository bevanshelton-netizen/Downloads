import { supabase } from './supabase'
import { Database } from './database.types'

export const SUBSCRIPTION_PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 'R0',
    period: '/month',
    dailyLimit: 5,
    features: [
      '5 questions per day',
      'Access to 50 Laws of Life',
      'Community forum access',
      'Basic support',
    ],
  },
  wisdom: {
    id: 'wisdom',
    name: 'Wisdom',
    price: 'R99',
    period: '/month',
    dailyLimit: Infinity,
    features: [
      'Unlimited questions',
      'Everything in Free, plus:',
      'Priority response time',
      '12 Domains deep dives',
      'Weekly group sessions',
      'Exclusive resources library',
      'Premium support',
    ],
  },
  legacy: {
    id: 'legacy',
    name: 'Legacy',
    price: 'R299',
    period: '/month',
    dailyLimit: Infinity,
    features: [
      'Everything in Wisdom, plus:',
      'Personal mentorship track',
      'Monthly one-on-ones',
      'Custom learning paths',
      'VIP event access',
      'Direct messaging access',
      'Priority support',
    ],
  },
}

/**
 * Get user's current plan
 */
export async function getUserPlan(userId: string) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching subscription:', error)
    return null
  }

  return data || null
}

/**
 * Get user's daily question count
 */
export async function getUserDailyQuestionCount(userId: string) {
  const today = new Date().toISOString().split('T')[0]

  const { data, error, count } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', `${today}T00:00:00`)
    .lte('created_at', `${today}T23:59:59`)

  if (error) {
    console.error('Error fetching daily question count:', error)
    return 0
  }

  return count || 0
}

/**
 * Check if user can ask a question
 */
export async function canUserAskQuestion(userId: string): Promise<{
  canAsk: boolean
  message?: string
  remaining?: number
}> {
  try {
    // Get user's subscription
    const subscription = await getUserPlan(userId)
    const plan = subscription?.tier || 'free'
    const planConfig = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS]

    // Unlimited plans can always ask
    if (planConfig.dailyLimit === Infinity) {
      return { canAsk: true }
    }

    // Check daily limit
    const dailyCount = await getUserDailyQuestionCount(userId)
    const remaining = planConfig.dailyLimit - dailyCount

    if (remaining <= 0) {
      return {
        canAsk: false,
        message: `You've reached your daily limit of ${planConfig.dailyLimit} questions. Upgrade to Wisdom or Legacy for unlimited access.`,
        remaining: 0,
      }
    }

    return {
      canAsk: true,
      remaining,
    }
  } catch (error) {
    console.error('Error checking question limit:', error)
    // Default to allowing the question on error
    return { canAsk: true }
  }
}

/**
 * Create or update subscription
 */
export async function createSubscription(
  userId: string,
  tier: 'free' | 'wisdom' | 'legacy',
  status: 'active' | 'canceled' | 'past_due' = 'active'
) {
  const { data, error } = await supabase
    .from('subscriptions')
    .upsert(
      {
        user_id: userId,
        tier,
        status,
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )
    .select()

  if (error) {
    console.error('Error creating subscription:', error)
    throw error
  }

  return data
}

/**
 * Get subscription info formatted for display
 */
export function getPlanInfo(tier: string) {
  return SUBSCRIPTION_PLANS[tier as keyof typeof SUBSCRIPTION_PLANS] || SUBSCRIPTION_PLANS.free
}
