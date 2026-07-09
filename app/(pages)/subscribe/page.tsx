'use client'

import { SectionTitle } from '@/components/sections/SectionTitle'
import { PremiumCard } from '@/components/ui/PremiumCard'
import { SUBSCRIPTION_PLANS } from '@/lib/subscription'
import { useEffect, useState } from 'react'
import { getSession } from '@/lib/auth'
import { getUserPlan } from '@/lib/subscription'
import Link from 'next/link'

export default function Subscribe() {
  const [currentPlan, setCurrentPlan] = useState<string>('free')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    async function checkSubscription() {
      const session = await getSession()
      if (session?.user) {
        setIsLoggedIn(true)
        const subscription = await getUserPlan(session.user.id)
        setCurrentPlan(subscription?.tier || 'free')
      }
    }

    checkSubscription()
  }, [])

  const handleUpgrade = (plan: string) => {
    if (!isLoggedIn) {
      // Redirect to login
      window.location.href = '/auth/login'
      return
    }

    // TODO: Implement PayFast payment integration
    alert(`Upgrade to ${plan} plan - Payment integration coming soon`)
  }

  return (
    <main className="bg-black min-h-screen pt-24 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="Choose Your Plan"
          subtitle="Unlock premium access to THE CHANCELLOR™"
        />

        {/* Current Plan Info */}
        {isLoggedIn && (
          <div className="mb-12 p-4 bg-black border border-platinum rounded-lg text-center">
            <p className="text-platinum text-sm mb-1">Current Plan</p>
            <p className="text-gold font-serif font-bold text-2xl capitalize">{currentPlan}</p>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {Object.values(SUBSCRIPTION_PLANS).map((plan) => (
            <div
              key={plan.id}
              className={`transform transition duration-300 ${
                currentPlan === plan.id ? 'md:scale-105' : ''
              }`}
            >
              <PremiumCard
                className={`h-full flex flex-col ${
                  currentPlan === plan.id ? 'border-platinum' : ''
                }`}
              >
                {currentPlan === plan.id && (
                  <div className="mb-4">
                    <span className="bg-gold text-black px-4 py-1 rounded-full text-sm font-semibold">
                      Current Plan
                    </span>
                  </div>
                )}

                <h3 className="text-3xl font-serif font-bold text-gold mb-2">
                  {plan.name}
                </h3>
                <p className="text-platinum mb-6">Premium AI mentorship</p>

                <div className="mb-6">
                  <span className="text-5xl font-serif font-bold text-gold">
                    {plan.price}
                  </span>
                  <span className="text-platinum ml-2">{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="text-ivory flex items-start gap-3">
                      <span className="text-gold mt-1">✓</span>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {currentPlan === plan.id ? (
                  <button
                    disabled
                    className="w-full py-3 font-semibold tracking-wider uppercase rounded-lg bg-platinum text-black opacity-50 cursor-not-allowed"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleUpgrade(plan.name)}
                    className={`w-full py-3 font-semibold tracking-wider uppercase transition-all duration-300 rounded-lg ${
                      plan.id === 'free'
                        ? 'border-2 border-gold text-gold hover:bg-gold hover:text-black'
                        : 'bg-gold text-black hover:bg-dark-gold'
                    }`}
                  >
                    {plan.id === 'free' ? 'Choose Free' : 'Upgrade Now'}
                  </button>
                )}
              </PremiumCard>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mb-20">
          <h2 className="text-4xl font-serif font-bold text-gold mb-12 text-center">
            Frequently Asked Questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                q: 'Can I change my plan anytime?',
                a: 'Yes. Upgrade or downgrade your plan at any time from your dashboard. Changes take effect immediately.',
              },
              {
                q: 'Is there a free trial?',
                a: 'Yes! Start with our Free plan and upgrade to Wisdom or Legacy anytime to unlock unlimited access.',
              },
              {
                q: 'What if I am not satisfied?',
                a: 'We offer a 30-day money-back guarantee on paid plans. No questions asked.',
              },
              {
                q: 'How are payments processed?',
                a: 'Payments are securely processed through PayFast. We support all major payment methods.',
              },
              {
                q: 'Can I cancel my subscription?',
                a: 'Yes. You can cancel anytime from your profile settings. Your access continues until the end of your billing period.',
              },
              {
                q: 'What payment methods do you accept?',
                a: 'We accept credit cards, debit cards, bank transfers, and all PayFast payment methods.',
              },
            ].map((item, i) => (
              <PremiumCard key={i}>
                <h3 className="text-xl font-serif font-bold text-gold mb-3">{item.q}</h3>
                <p className="text-ivory leading-relaxed text-sm">{item.a}</p>
              </PremiumCard>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="bg-black border border-gold rounded-lg p-12 text-center">
          <h2 className="text-4xl font-serif font-bold text-gold mb-4">
            Ready to Transform Your Life?
          </h2>
          <p className="text-ivory text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of premium members walking in wisdom, building with purpose, and
            creating lasting legacies.
          </p>
          {!isLoggedIn ? (
            <Link href="/auth/signup" className="btn-premium">
              Create Your Account
            </Link>
          ) : currentPlan === 'free' ? (
            <button onClick={() => handleUpgrade('Wisdom')} className="btn-premium">
              Upgrade Now
            </button>
          ) : (
            <Link href="/dashboard" className="btn-premium">
              Go to Dashboard
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}
