'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface EmailVerificationProps {
  token: string
  recipientEmail: string
  onVerified: () => void
}

export default function EmailVerification({ token, recipientEmail, onVerified }: EmailVerificationProps) {
  const [email, setEmail] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/verify/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(data.message)
        setStep('code')
      } else {
        setError(data.error)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/verify/confirm-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code: verificationCode })
      })

      const data = await response.json()

      if (response.ok) {
        onVerified()
      } else {
        setError(data.error)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const requestNewCode = async () => {
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const response = await fetch('/api/verify/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('New verification code sent!')
        setVerificationCode('')
      } else {
        setError(data.error)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Verify Your Email</CardTitle>
          <CardDescription>
            This deck was shared with <strong>{recipientEmail}</strong>. 
            Please verify your identity to access the content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Enter your email address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  required
                  className="w-full"
                />
              </div>
              
              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                  {error}
                </div>
              )}
              
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Sending...' : 'Send Verification Code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div>
                <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                  Enter the 6-digit code sent to {email}
                </label>
                <Input
                  id="code"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.slice(0, 6))}
                  placeholder="123456"
                  pattern="[0-9]{6}"
                  required
                  className="w-full text-center text-2xl tracking-widest"
                  maxLength={6}
                />
              </div>
              
              {message && (
                <div className="text-green-600 text-sm bg-green-50 p-3 rounded">
                  {message}
                </div>
              )}
              
              {error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                  {error}
                </div>
              )}
              
              <Button type="submit" disabled={loading || verificationCode.length !== 6} className="w-full">
                {loading ? 'Verifying...' : 'Verify Code'}
              </Button>
              
              <div className="text-center">
                <button
                  type="button"
                  onClick={requestNewCode}
                  disabled={loading}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Didn&apos;t receive the code? Send again
                </button>
              </div>
              
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep('email')}
                  className="text-sm text-gray-600 hover:text-gray-800 underline"
                >
                  Change email address
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}