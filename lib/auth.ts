import { supabase } from './supabase'

/**
 * Sign up a new user
 */
export async function signUp(email: string, password: string, displayName?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  })

  if (error) {
    throw error
  }

  // Create user profile
  if (data.user) {
    await supabase.from('users').insert([
      {
        id: data.user.id,
        email: data.user.email || '',
        display_name: displayName,
      },
    ])
  }

  return data
}

/**
 * Sign in a user
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    throw error
  }

  return data
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()

  if (error) {
    throw error
  }
}

/**
 * Get the current user
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

/**
 * Reset password
 */
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  })

  if (error) {
    throw error
  }
}

/**
 * Update password
 */
export async function updatePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    throw error
  }
}
