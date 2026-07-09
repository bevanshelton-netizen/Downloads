'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser, signOut, updatePassword } from '@/lib/auth'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { SectionTitle } from '@/components/sections/SectionTitle'
import { PremiumCard } from '@/components/ui/PremiumCard'
import Link from 'next/link'

interface UserData {
  displayName?: string
  email?: string
}

export default function Profile() {
  const router = useRouter()
  const [user, setUser] = useState<UserData>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  useEffect(() => {
    async function loadUser() {
      try {
        const currentUser = await getCurrentUser()
        if (!currentUser) {
          router.push('/auth/login')
          return
        }

        setUser({
          displayName: currentUser.user_metadata?.display_name || 'User',
          email: currentUser.email,
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load profile'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()
  }, [])

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsUpdatingPassword(true)

    try {
      await updatePassword(newPassword)
      setSuccessMessage('Password updated successfully')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update password'
      setError(errorMessage)
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut()
      router.push('/')
    } catch (err) {
      setError('Failed to logout')
    }
  }

  if (isLoading) {
    return (
      <ProtectedRoute>
        <main className="bg-black min-h-screen pt-24 pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-block">
              <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-gold mt-4 font-serif text-lg">Loading profile...</p>
          </div>
        </main>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <main className="bg-black min-h-screen pt-24 pb-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitle
            title="Your Profile"
            subtitle="Manage your account settings"
          />

          {error && (
            <div className="mb-8 p-4 bg-red-900 border border-red-700 rounded-lg text-ivory">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-8 p-4 bg-green-900 border border-green-700 rounded-lg text-ivory">
              {successMessage}
            </div>
          )}

          {/* Account Information */}
          <div className="mb-12">
            <h2 className="text-3xl font-serif font-bold text-gold mb-6">Account Information</h2>
            <PremiumCard>
              <div className="space-y-4">
                <div>
                  <p className="text-platinum text-sm mb-1">Name</p>
                  <p className="text-ivory text-lg">{user.displayName}</p>
                </div>
                <div>
                  <p className="text-platinum text-sm mb-1">Email</p>
                  <p className="text-ivory text-lg">{user.email}</p>
                </div>
              </div>
            </PremiumCard>
          </div>

          {/* Change Password */}
          <div className="mb-12">
            <h2 className="text-3xl font-serif font-bold text-gold mb-6">Change Password</h2>
            <PremiumCard>
              <form onSubmit={handleUpdatePassword} className="space-y-6">
                {/* New Password */}
                <div>
                  <label htmlFor="newPassword" className="block text-gold font-semibold mb-2">
                    New Password
                  </label>
                  <input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-black border border-gold text-ivory px-4 py-3 rounded-lg focus:outline-none focus:border-platinum transition"
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <label htmlFor="confirmPassword" className="block text-gold font-semibold mb-2">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="w-full bg-black border border-gold text-ivory px-4 py-3 rounded-lg focus:outline-none focus:border-platinum transition"
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="btn-premium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </PremiumCard>
          </div>

          {/* Danger Zone */}
          <div>
            <h2 className="text-3xl font-serif font-bold text-gold mb-6">Account Actions</h2>
            <div className="space-y-4">
              <PremiumCard>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="mb-4 md:mb-0">
                    <h3 className="text-xl font-serif font-bold text-platinum mb-1">
                      Sign Out
                    </h3>
                    <p className="text-ivory text-sm">Sign out of your account</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="btn-premium-outline"
                  >
                    Sign Out
                  </button>
                </div>
              </PremiumCard>
            </div>
          </div>

          {/* Back Link */}
          <div className="mt-12 text-center">
            <Link href="/dashboard" className="text-platinum hover:text-gold transition text-sm">
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  )
}
