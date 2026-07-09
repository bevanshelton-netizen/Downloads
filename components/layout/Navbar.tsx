'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { getSession, signOut } from '@/lib/auth'
import { useRouter } from 'next/navigation'

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      const session = await getSession()
      setIsLoggedIn(!!session)
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const handleLogout = async () => {
    try {
      await signOut()
      setIsLoggedIn(false)
      setIsOpen(false)
      router.push('/')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  const links = [
    { href: '/', label: 'Home' },
    { href: '/ask', label: 'Ask The Chancellor' },
    { href: '/domains', label: '12 Domains' },
    { href: '/laws', label: '50 Laws' },
    { href: '/collection', label: 'Collection' },
    { href: '/about', label: 'About' },
  ]

  return (
    <nav className="fixed top-0 w-full bg-black border-b border-gold z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition">
            <div className="w-12 h-12 relative">
              <Image
                src="/chancellor-crest.png"
                alt="Chancellor Crest"
                fill
                className="object-contain"
              />
            </div>
            <span className="text-gold font-serif font-bold text-lg hidden sm:block">
              THE CHANCELLOR™
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex gap-8 items-center">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-ivory hover:text-gold transition text-sm font-medium"
              >
                {link.label}
              </Link>
            ))}

            {/* Auth Buttons */}
            <div className="flex gap-3 items-center">
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-gold border-t-transparent rounded-full animate-spin"></div>
              ) : isLoggedIn ? (
                <>
                  <Link
                    href="/dashboard"
                    className="text-gold hover:text-platinum transition text-sm font-medium"
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="btn-premium-outline text-xs px-4 py-2"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="text-ivory hover:text-gold transition text-sm font-medium"
                  >
                    Login
                  </Link>
                  <Link href="/auth/signup" className="btn-premium text-xs px-4 py-2">
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden text-gold hover:text-platinum transition"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block py-2 text-ivory hover:text-gold transition text-sm"
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}

            <div className="pt-4 border-t border-gold mt-4 space-y-2">
              {isLoading ? (
                <div className="text-gold text-sm">Loading...</div>
              ) : isLoggedIn ? (
                <>
                  <Link
                    href="/dashboard"
                    className="block py-2 text-gold font-medium"
                    onClick={() => setIsOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout()
                      setIsOpen(false)
                    }}
                    className="w-full text-left py-2 text-ivory hover:text-gold transition text-sm"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="block py-2 text-ivory hover:text-gold transition text-sm"
                    onClick={() => setIsOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="block py-2 text-gold font-medium"
                    onClick={() => setIsOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
