'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Mail } from 'lucide-react'

interface EmailVerificationProps {
  token: string
  recipientEmail: string
  onVerified: (email: string) => void
}

export default function EmailVerification({ token, recipientEmail, onVerified }: EmailVerificationProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const [isVerified, setIsVerified] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/verify/email-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email })
      })

      const data = await response.json()

      if (response.ok) {
        setIsVerified(true)
        // Add a small delay to show the success state
        setTimeout(() => onVerified(email), 1500)
      } else {
        setError(data.error || 'Verification failed. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-8 space-y-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center">
              <Mail className="h-10 w-10 text-[#771144]" />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">
              {isVerified ? 'Access Granted' : 'Verify Your Email'}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {isVerified 
                ? 'You\'re being redirected to your deck...'
                : 'Enter your email to access the shared content'}
            </p>
          </div>

        {isVerified ? (
          <div className="text-center py-4">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-50 mb-4">
              <svg
                className="h-6 w-6 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-gray-600">Verified successfully</p>
            <div className="mt-4">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-[#771144]" />
            </div>
          </div>
        ) : (
          <form onSubmit={handleEmailSubmit} className="pt-2 space-y-4">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
                className="w-full h-11"
                autoComplete="email"
                autoFocus
              />
            </div>
            
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
            
            <Button 
              type="submit" 
              disabled={loading} 
              className="w-full h-11 bg-[#771144] hover:bg-[#5a0d33]"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </form>
        )}
        </div>
      </div>
    </div>
  )
}