'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { SectionTitle } from '@/components/sections/SectionTitle'
import { PremiumCard } from '@/components/ui/PremiumCard'
import { getSession } from '@/lib/auth'
import { getUserPlan, getUserDailyQuestionCount, SUBSCRIPTION_PLANS } from '@/lib/subscription'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

export default function AskChancellor() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Greetings. I am THE CHANCELLOR™. I am here to provide you with wise counsel on your journey. What is on your mind today?',
    },
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [plan, setPlan] = useState<string>('free')
  const [dailyCount, setDailyCount] = useState(0)
  const [isLimitExceeded, setIsLimitExceeded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    async function loadUserInfo() {
      const session = await getSession()
      if (session?.user) {
        setUserId(session.user.id)
        const subscription = await getUserPlan(session.user.id)
        setPlan(subscription?.tier || 'free')
        const count = await getUserDailyQuestionCount(session.user.id)
        setDailyCount(count)
      }
    }

    loadUserInfo()
  }, [])

  const planConfig = SUBSCRIPTION_PLANS[plan as keyof typeof SUBSCRIPTION_PLANS]
  const remaining = Math.max(0, planConfig.dailyLimit - dailyCount)
  const showLimitWarning = plan === 'free' && remaining <= 2

  const handleSendMessage = async () => {
    if (!input.trim()) return

    // Check limit before sending
    if (plan === 'free' && dailyCount >= planConfig.dailyLimit) {
      setIsLimitExceeded(true)
      setError(
        `You've reached your daily limit of ${planConfig.dailyLimit} questions. Upgrade to Wisdom or Legacy for unlimited access.`
      )
      return
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        const data = await response.json()

        if (response.status === 429 && data.limitExceeded) {
          setIsLimitExceeded(true)
          setMessages((prev) => prev.slice(0, -1)) // Remove user message
        }

        throw new Error(data.error || `API error: ${response.status}`)
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
      }

      setMessages((prev) => [...prev, assistantMessage])
      setDailyCount((prev) => prev + 1)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to get response from The Chancellor'
      setError(errorMessage)
      setMessages((prev) => prev.slice(0, -1)) // Remove user message on error
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="bg-black min-h-screen pt-24 pb-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="Ask The Chancellor™"
          subtitle="Receive wise counsel on your life journey"
        />

        {/* Plan Info */}
        {userId && (
          <div className="mb-6 p-4 bg-black border border-platinum rounded-lg">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
              <div>
                <p className="text-platinum text-sm mb-1">Current Plan</p>
                <p className="text-gold font-semibold capitalize text-lg">{plan} Plan</p>
              </div>
              {plan === 'free' && (
                <div className="text-right">
                  <p className="text-platinum text-sm mb-1">Questions Today</p>
                  <p className={`font-semibold text-lg ${
                    remaining <= 2 ? 'text-red-400' : 'text-gold'
                  }`}>
                    {dailyCount}/{planConfig.dailyLimit}
                  </p>
                </div>
              )}
              {plan === 'free' && (
                <button
                  onClick={() => router.push('/subscribe')}
                  className="btn-premium text-sm"
                >
                  Upgrade
                </button>
              )}
            </div>
          </div>
        )}

        {/* Limit Warning */}
        {showLimitWarning && !isLimitExceeded && (
          <div className="mb-6 p-4 bg-yellow-900 border border-yellow-700 rounded-lg text-ivory">
            <p className="text-sm">
              ⚠️ You have <strong>{remaining}</strong> question{remaining !== 1 ? 's' : ''} remaining today. 
              <button
                onClick={() => router.push('/subscribe')}
                className="ml-2 text-gold hover:text-platinum font-semibold"
              >
                Upgrade for unlimited access
              </button>
            </p>
          </div>
        )}

        {/* Chat Container */}
        <PremiumCard className="h-96 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto mb-6 space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-gold text-black'
                      : 'bg-platinum text-black'
                  }`}
                >
                  <p className="text-sm md:text-base leading-relaxed">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-platinum text-black px-4 py-3 rounded-lg">
                  <div className="flex gap-2 items-center">
                    <div className="w-2 h-2 bg-black rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-black rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-black rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Error Message */}
          {error && (
            <div className={`mb-4 p-3 border rounded-lg text-ivory text-sm ${
              isLimitExceeded
                ? 'bg-red-900 border-red-700'
                : 'bg-red-900 border-red-700'
            }`}>
              {error}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask The Chancellor..."
              disabled={isLoading || isLimitExceeded}
              className="flex-1 bg-black border border-gold text-ivory px-4 py-3 rounded-lg focus:outline-none focus:border-platinum transition disabled:opacity-50"
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim() || isLimitExceeded}
              className="btn-premium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </PremiumCard>

        {/* Tips */}
        <div className="mt-12">
          <h3 className="text-2xl font-serif font-bold text-gold mb-6">Get the Most from Your Session</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              'Be specific with your questions to receive tailored guidance',
              'Share context about your situation for deeper insights',
              'Reflect on the counsel and apply it to your unique circumstances',
            ].map((tip, i) => (
              <PremiumCard key={i}>
                <p className="text-ivory leading-relaxed">{tip}</p>
              </PremiumCard>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
