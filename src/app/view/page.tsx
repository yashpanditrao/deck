'use client'

import { useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import EmailVerification from '@/components/EmailVerification'
import dynamic from 'next/dynamic'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

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
  is_downloadable: boolean
}

interface VerificationResponse {
  success: boolean
  deckId?: string
  recipientEmail: string
}

const ViewDeckContent = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [shareData, setShareData] = useState<ShareLinkData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState<'verification' | 'viewing'>('verification')
  const [recipientEmail, setRecipientEmail] = useState('')

  // Check if user is already verified (session storage only) - email-based verification
  const getVerificationStatus = (email: string) => {
    if (typeof window !== 'undefined') {
      const verifiedData = sessionStorage.getItem(`verified_email_${email.toLowerCase()}`)
      if (verifiedData) {
        try {
          const { timestamp, token: storedToken } = JSON.parse(verifiedData)
          // Check if verification is less than 24 hours old and token matches
          const twentyFourHours = 24 * 60 * 60 * 1000
          if (Date.now() - timestamp < twentyFourHours && storedToken === token) {
            return true
          } else {
            // Remove expired or mismatched verification
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

  // Fetch deck data after successful email verification
  const fetchDeckData = useCallback(async (email: string) => {
    if (!token) {
      setError('No token provided')
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      // First verify email matches the token
      const verifyResponse = await fetch('/api/verify/email-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email })
      })

      const verifyData = await verifyResponse.json()

      if (!verifyResponse.ok) {
        throw new Error(verifyData.error || 'Email verification failed')
      }

      // Only after successful verification, fetch deck data
      const response = await fetch('/api/deck/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email })
      })

      const result = await response.json()

      if (response.ok && result.data) {
        setShareData({
          deck_url: result.data.deck_url,
          is_downloadable: result.data.is_downloadable
        })
        // Store verification in session storage
        sessionStorage.setItem(
          `verified_email_${email.toLowerCase()}`,
          JSON.stringify({
            timestamp: Date.now(),
            token: token
          })
        )
        setStep('viewing')
      } else {
        throw new Error(result.error || 'Failed to load deck data')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setStep('verification')
    } finally {
      setLoading(false)
    }
  }, [token])

  const handleEmailVerified = useCallback(async (email: string) => {
    console.log('Email verified, setting recipient email:', email);
    setRecipientEmail(email);
    setLoading(true);
    try {
      console.log('Fetching deck data...');
      const response = await fetch('/api/deck/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email })
      });

      const result = await response.json();
      console.log('Deck data response:', result);

      if (response.ok) {
        // The API returns { success: true, is_downloadable: boolean }
        // We need to construct the deck_url using the token
        const deckUrl = `/api/deck/serve/${token}?email=${encodeURIComponent(email)}`;
        
        setShareData({
          deck_url: deckUrl,
          is_downloadable: result.is_downloadable || false
        });
        // Store verification in session storage
        sessionStorage.setItem(
          `verified_email_${email.toLowerCase()}`,
          JSON.stringify({
            timestamp: Date.now(),
            token: token
          })
        );
        setStep('viewing');
      } else {
        throw new Error(result.error || 'Failed to load deck data');
      }
    } catch (err) {
      console.error('Error in handleEmailVerified:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [token]);

  if (step === 'verification') {
    return (
      <EmailVerification 
        key={token || 'no-token'} // Force re-render on token change
        token={token || ''} 
        recipientEmail={recipientEmail}
        onVerified={handleEmailVerified}
      />
    )
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span className="text-gray-300">Loading document...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-500">{error}</p>
            <Button className="mt-4" onClick={() => window.location.href = `/view?token=${token}`}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  console.log('Current state:', { step, token, hasShareData: !!shareData, recipientEmail });

  if (step === 'viewing' && token) {
    console.log('Rendering PdfViewer with token:', token);
    return (
      <div className="fixed inset-0 bg-black">
        <PdfViewer
          pdfLink={shareData?.deck_url || ''}
          isDownloadable={shareData?.is_downloadable || false}
          token={token}
          email={recipientEmail}
        />
      </div>
    )
  }


  // Default fallback
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-white">Loading...</div>
    </div>
  )
}

const ViewDeckPage = () => {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    }>
      <ViewDeckContent />
    </Suspense>
  )
}

export default ViewDeckPage
