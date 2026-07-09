'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signIn } from '@/lib/auth'
import { SectionTitle } from '@/components/sections/SectionTitle'
import { PremiumCard } from '@/components/ui/PremiumCard'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await signIn(email, password)
      router.push('/dashboard')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign in'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="bg-black min-h-screen pt-24 pb-20">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="Welcome Back"
          subtitle="Access your premium mentorship"
        />

        <PremiumCard>
          <form onSubmit={handleLogin} className="space-y-6">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-gold font-semibold mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full bg-black border border-gold text-ivory px-4 py-3 rounded-lg focus:outline-none focus:border-platinum transition"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-gold font-semibold mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-black border border-gold text-ivory px-4 py-3 rounded-lg focus:outline-none focus:border-platinum transition"
              />
            </div>

            {/* Forgot Password */}
            <div className="text-right">
              <Link
                href="/auth/reset-password"
                className="text-platinum hover:text-gold transition text-sm font-medium"
              >
                Forgot password?
              </Link>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 bg-red-900 border border-red-700 rounded-lg text-ivory text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn-premium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="mt-6 pt-6 border-t border-gold text-center">
            <p className="text-ivory text-sm">
              Don't have an account?{' '}
              <Link href="/auth/signup" className="text-gold hover:text-platinum transition font-semibold">
                Sign Up
              </Link>
            </p>
          </div>
        </PremiumCard>

        {/* Back to Home */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-platinum hover:text-gold transition text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}
