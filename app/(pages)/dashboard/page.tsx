'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser, getSession } from '@/lib/auth'
import { getUserSubscription, getChatHistory } from '@/lib/supabase-service'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { SectionTitle } from '@/components/sections/SectionTitle'
import { PremiumCard } from '@/components/ui/PremiumCard'

interface DashboardData {
  displayName?: string
  email?: string
  subscription?: {
    tier: string
    status: string
  }
  recentChats?: any[]
}

export default function Dashboard() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const user = await getCurrentUser()
        if (!user) {
          router.push('/auth/login')
          return
        }

        // Get subscription info
        const subscription = await getUserSubscription(user.id)

        // Get recent chats
        const recentChats = await getChatHistory(user.id, 10)

        setData({
          displayName: user.user_metadata?.display_name || 'User',
          email: user.email,
          subscription: subscription ? {
            tier: subscription.tier,
            status: subscription.status,
          } : undefined,
          recentChats,
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard'
        setError(errorMessage)
      } finally {
        setIsLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  if (isLoading) {
    return (
      <ProtectedRoute>
        <main className="bg-black min-h-screen pt-24 pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-block">
              <div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-gold mt-4 font-serif text-lg">Loading your dashboard...</p>
          </div>
        </main>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <main className="bg-black min-h-screen pt-24 pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Welcome Section */}
          <div className="mb-12">
            <h1 className="text-5xl md:text-6xl font-serif font-bold text-gold mb-2">
              Welcome, {data.displayName}!
            </h1>
            <p className="text-platinum text-lg">Your premium mentorship dashboard</p>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-red-900 border border-red-700 rounded-lg text-ivory">
              {error}
            </div>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            {/* Subscription Status */}
            <PremiumCard>
              <h3 className="text-gold font-serif font-bold text-lg mb-3">Subscription</h3>
              {data.subscription ? (
                <>
                  <p className="text-ivory text-2xl font-semibold capitalize mb-2">
                    {data.subscription.tier}
                  </p>
                  <p className="text-platinum text-sm capitalize">
                    Status: {data.subscription.status}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-ivory text-lg mb-4">No active subscription</p>
                  <Link href="/subscribe" className="text-gold hover:text-platinum transition font-semibold text-sm">
                    Upgrade Now →
                  </Link>
                </>
              )}
            </PremiumCard>

            {/* Ask The Chancellor */}
            <PremiumCard hover>
              <h3 className="text-gold font-serif font-bold text-lg mb-3">Chat</h3>
              <p className="text-ivory text-sm mb-4">
                Get personalized guidance from THE CHANCELLOR™
              </p>
              <Link
                href="/ask"
                className="text-gold hover:text-platinum transition font-semibold text-sm"
              >
                Start Conversation →
              </Link>
            </PremiumCard>

            {/* Profile */}
            <PremiumCard hover>
              <h3 className="text-gold font-serif font-bold text-lg mb-3">Account</h3>
              <p className="text-ivory text-sm mb-4">{data.email}</p>
              <Link
                href="/dashboard/profile"
                className="text-gold hover:text-platinum transition font-semibold text-sm"
              >
                Edit Profile →
              </Link>
            </PremiumCard>
          </div>

          {/* Recent Conversations */}
          <div className="mb-12">
            <h2 className="text-3xl font-serif font-bold text-gold mb-6">Recent Conversations</h2>
            {data.recentChats && data.recentChats.length > 0 ? (
              <div className="space-y-4">
                {data.recentChats
                  .filter((msg: any) => msg.role === 'user')
                  .slice(0, 5)
                  .map((msg: any, i: number) => (
                    <PremiumCard key={i} hover>
                      <p className="text-ivory line-clamp-2">{msg.content}</p>
                      <p className="text-platinum text-xs mt-2">
                        {new Date(msg.created_at).toLocaleDateString()}
                      </p>
                    </PremiumCard>
                  ))}
                <Link
                  href="/ask"
                  className="btn-premium inline-block"
                >
                  View All Conversations
                </Link>
              </div>
            ) : (
              <PremiumCard>
                <p className="text-ivory mb-4">No conversations yet. Start your first chat!</p>
                <Link href="/ask" className="text-gold hover:text-platinum transition font-semibold">
                  Ask The Chancellor →
                </Link>
              </PremiumCard>
            )}
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PremiumCard hover>
              <h3 className="text-gold font-serif font-bold text-lg mb-3">12 Domains</h3>
              <p className="text-ivory text-sm mb-4">
                Explore excellence across faith, business, leadership, and more.
              </p>
              <Link href="/domains" className="text-gold hover:text-platinum transition font-semibold text-sm">
                Explore →
              </Link>
            </PremiumCard>

            <PremiumCard hover>
              <h3 className="text-gold font-serif font-bold text-lg mb-3">50 Laws of Life</h3>
              <p className="text-ivory text-sm mb-4">
                Discover timeless principles for living with wisdom and purpose.
              </p>
              <Link href="/laws" className="text-gold hover:text-platinum transition font-semibold text-sm">
                Explore →
              </Link>
            </PremiumCard>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  )
}
