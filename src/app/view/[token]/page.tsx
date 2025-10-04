'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import EmailVerification from '@/components/EmailVerification'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Dynamically import PdfViewer to avoid SSR issues
const PdfViewer = dynamic(() => import('@/components/PdfViewer'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4 text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        <span className="text-gray-300">Loading document viewer...</span>
      </div>
    </div>
  )
})

interface ShareLinkData {
  deck_url: string
  recipient_email: string
  is_verified: boolean
  expires_at: string | null
}

interface DeckData {
  deck_url: string
}

export default function ViewDeckPage() {
  const params = useParams()
  const token = params.token as string

  const [shareData, setShareData] = useState<ShareLinkData | null>(null)
  const [deckData, setDeckData] = useState<DeckData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'validating' | 'verification' | 'viewing'>('validating')

  // Check if user is already verified (session storage only) - email-based verification
  const getVerificationStatus = (email?: string) => {
    if (typeof window !== 'undefined' && email) {
      const verifiedData = sessionStorage.getItem(`verified_email_${email.toLowerCase()}`)
      if (verifiedData) {
        try {
          const { timestamp } = JSON.parse(verifiedData)
          // Check if verification is less than 24 hours old
          const twentyFourHours = 24 * 60 * 60 * 1000
          if (Date.now() - timestamp < twentyFourHours) {
            return true
          } else {
            // Remove expired verification
            sessionStorage.removeItem(`verified_email_${email.toLowerCase()}`)
          }
        } catch {
          // Remove invalid verification data
          sessionStorage.removeItem(`verified_email_${email.toLowerCase()}`)
        }
      }
    }
    return false
  }

  // Set verification status in session storage - now email-based
  const setVerificationStatus = (verified: boolean, email?: string) => {
    if (typeof window !== 'undefined' && email) {
      if (verified) {
        const verificationData = {
          timestamp: Date.now(),
          email: email.toLowerCase()
        }
        sessionStorage.setItem(`verified_email_${email.toLowerCase()}`, JSON.stringify(verificationData))
      } else {
        sessionStorage.removeItem(`verified_email_${email.toLowerCase()}`)
      }
    }
  }

  // Load deck data after verification
  const loadDeck = useCallback(async () => {
    try {
      const response = await fetch('/api/deck/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })

      const result = await response.json()

      if (response.ok) {
        setDeckData(result.data)
      } else {
        setError(result.error)
      }
    } catch {
      setError('Failed to load deck. Please try again.')
    }
  }, [token])

  // Validate token and get share link data
  const validateToken = useCallback(async () => {
    try {
      const response = await fetch('/api/deck/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
      const result = await response.json()

      if (response.ok) {
        setShareData(result.data)
        
        // Check if already verified in session storage only (not database)
        // Database is_verified should not bypass email verification for security
        if (getVerificationStatus(result.data.recipient_email)) {
          setStep('viewing')
          await loadDeck()
        } else {
          setStep('verification')
        }
      } else {
        setError(result.error)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [token, loadDeck])

  // Handle successful verification
  const handleVerified = () => {
    if (shareData?.recipient_email) {
      setVerificationStatus(true, shareData.recipient_email)
    }
    setStep('viewing')
    loadDeck()
  }

  useEffect(() => {
    if (token) {
      validateToken()
    }
  }, [token, validateToken])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <span className="ml-2">Validating access...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-red-600">Access Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-700 mb-4">{error}</p>
            <p className="text-sm text-gray-500">
              Please check your link or contact the person who shared this deck with you.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'verification' && shareData) {
    return (
      <EmailVerification
        token={token}
        recipientEmail={shareData.recipient_email}
        onVerified={handleVerified}
      />
    )
  }

  if (step === 'viewing' && deckData) {
    return (
      <PdfViewer 
        pdfLink={deckData.deck_url}
      />
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center p-8">
          <span>Loading...</span>
        </CardContent>
      </Card>
    </div>
  )
}