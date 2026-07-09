import { supabase } from './supabase'

/**
 * PayFast payment gateway integration
 * PLACEHOLDER - Do not use with real credentials
 * This is for future payment implementation
 */

interface PayFastConfig {
  merchantId: string
  merchantKey: string
  returnUrl: string
  cancelUrl: string
  notifyUrl: string
  sandbox: boolean
}

const payFastConfig: PayFastConfig = {
  merchantId: process.env.PAYFAST_MERCHANT_ID || 'test_merchant_id',
  merchantKey: process.env.PAYFAST_MERCHANT_KEY || 'test_merchant_key',
  returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/subscribe/success`,
  cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/subscribe`,
  notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payfast/notify`,
  sandbox: process.env.PAYFAST_SANDBOX === 'true' || true,
}

interface SubscriptionPayload {
  itemName: string
  itemDescription: string
  amount: number
  cycles: number
  frequency: string
  billingDate: string
  emailAddress: string
  customStr1?: string
  customStr2?: string
}

/**
 * Generate PayFast payment signature
 */
export function generatePayFastSignature(
  data: Record<string, any>,
  merchantKey: string
): string {
  const sortedKeys = Object.keys(data).sort()
  let signature = ''

  for (const key of sortedKeys) {
    if (data[key] !== '') {
      signature += `${key}=${encodeURIComponent(data[key].toString())}&`
    }
  }

  signature += `passphrase=${encodeURIComponent(merchantKey)}`

  // In production, use MD5 hashing
  // For now, return placeholder
  return 'payfast_signature_placeholder'
}

/**
 * Create PayFast subscription payment
 * PLACEHOLDER - For future implementation
 */
export function createPayFastSubscriptionLink(
  userId: string,
  userEmail: string,
  plan: 'wisdom' | 'legacy'
): { url: string; payload: any } {
  const amounts = {
    wisdom: 99.00,
    legacy: 299.00,
  }

  const planNames = {
    wisdom: 'Wisdom Plan',
    legacy: 'Legacy Plan',
  }

  const payload = {
    merchant_id: payFastConfig.merchantId,
    merchant_key: payFastConfig.merchantKey,
    return_url: payFastConfig.returnUrl,
    cancel_url: payFastConfig.cancelUrl,
    notify_url: payFastConfig.notifyUrl,
    name_first: 'User',
    name_last: 'Name',
    email_address: userEmail,
    item_name: planNames[plan],
    item_description: `THE CHANCELLOR™ ${planNames[plan]} - Monthly Subscription`,
    subscription_type: 1,
    billing_date: new Date().toISOString().split('T')[0],
    cycle_days: 30,
    frequency: 3, // Monthly
    cycles: 0, // Infinite until cancelled
    amount: amounts[plan].toFixed(2),
    custom_str1: userId,
    custom_str2: plan,
  }

  const signature = generatePayFastSignature(payload, payFastConfig.merchantKey)
  payload.signature = signature

  const baseUrl = payFastConfig.sandbox
    ? 'https://sandbox.payfast.co.za/hostedpayments/process'
    : 'https://www.payfast.co.za/hostedpayments/process'

  const queryString = new URLSearchParams(
    Object.entries(payload).reduce((acc, [key, value]) => {
      acc[key] = value.toString()
      return acc
    }, {} as Record<string, string>)
  ).toString()

  return {
    url: `${baseUrl}?${queryString}`,
    payload,
  }
}

/**
 * Verify PayFast payment notification
 * PLACEHOLDER - For future implementation
 */
export async function verifyPayFastNotification(
  data: Record<string, any>,
  merchantId: string,
  merchantKey: string
): Promise<boolean> {
  try {
    // Verify signature
    const signature = generatePayFastSignature(data, merchantKey)

    if (signature !== data.signature) {
      console.error('PayFast signature mismatch')
      return false
    }

    // Verify merchant ID
    if (data.merchant_id !== merchantId) {
      console.error('PayFast merchant ID mismatch')
      return false
    }

    // In production, verify with PayFast server
    // For now, return true
    return true
  } catch (error) {
    console.error('PayFast verification error:', error)
    return false
  }
}

/**
 * Handle successful PayFast payment
 */
export async function handlePayFastSuccess(
  userId: string,
  plan: 'wisdom' | 'legacy'
) {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        tier: plan,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()

    if (error) {
      console.error('Error updating subscription:', error)
      throw error
    }

    return data
  } catch (error) {
    console.error('Error handling PayFast success:', error)
    throw error
  }
}
