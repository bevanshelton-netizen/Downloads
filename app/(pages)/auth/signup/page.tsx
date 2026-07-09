'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { signUp } from '@/lib/auth'
import { SectionTitle } from '@/components/sections/SectionTitle'
import { PremiumCard } from '@/components/ui/PremiumCard'

export default function SignUp() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await signUp(email, password, displayName)
      setSuccess(true)
      // Redirect after a short delay
      setTimeout(() => {
        router.push('/auth/login')
      }, 2000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign up'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="bg-black min-h-screen pt-24 pb-20">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="Join THE CHANCELLOR™"
          subtitle="Begin your transformation"
        />

        {success ? (
          <PremiumCard className="text-center">
            <div className="mb-4 text-4xl">✓</div>
            <h3 className="text-2xl font-serif font-bold text-gold mb-3">
              Welcome
            </h3>
            <p className="text-ivory mb-4">
              Your account has been created successfully.
            </p>
            <p className="text-platinum text-sm">
              Redirecting to login...
            </p>
          </PremiumCard>
        ) : (
          <PremiumCard>
            <form onSubmit={handleSignUp} className="space-y-6">
              {/* Display Name */}
              <div>
                <label htmlFor="displayName" className="block text-gold font-semibold mb-2">
                  Full Name
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-black border border-gold text-ivory px-4 py-3 rounded-lg focus:outline-none focus:border-platinum transition"
                />
              </div>

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
                  minLength={6}
                  className="w-full bg-black border border-gold text-ivory px-4 py-3 rounded-lg focus:outline-none focus:border-platinum transition"
                />
                <p className="text-platinum text-xs mt-2">
                  Password must be at least 6 characters
                </p>
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
                {isLoading ? 'Creating Account...' : 'Sign Up'}
              </button>
            </form>

            {/* Sign In Link */}
            <div className="mt-6 pt-6 border-t border-gold text-center">
              <p className="text-ivory text-sm">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-gold hover:text-platinum transition font-semibold">
                  Sign In
                </Link>
              </p>
            </div>
          </PremiumCard>
        )}

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
