'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import EmailVerification from '@/components/EmailVerification'
import PdfViewer from '@/components/PdfViewer'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ShareLinkData {
  deck_id: string
  recipient_email: string
  is_verified: boolean
  expires_at: string | null
}

interface DeckData {
  deck_url: string
  deck_id: string
}

export default function ViewDeckPage() {
  const params = useParams()
  const token = params.token as string

  const [shareData, setShareData] = useState<ShareLinkData | null>(null)
  const [deckData, setDeckData] = useState<DeckData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'validating' | 'verification' | 'viewing'>('validating')

  // Check if user is already verified (session storage) - now email-based
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
        
        // Check if already verified in database or session (now email-based)
        if (result.data.is_verified || getVerificationStatus(result.data.recipient_email)) {
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
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Shared Deck
            </h1>
            <p className="text-gray-600">
              This deck was shared with {shareData?.recipient_email}
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-4">
            <PdfViewer 
              url={deckData.deck_url} 
              className="w-full"
            />
          </div>
        </div>
      </div>
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