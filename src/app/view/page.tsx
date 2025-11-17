'use client'

import { useState, useCallback, Suspense, useEffect } from 'react'
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

const ViewDeckContent = () => {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [shareData, setShareData] = useState<ShareLinkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('verification');
  const [recipientEmail, setRecipientEmail] = useState('');
  
  // Check for existing verification on initial load
  useEffect(() => {
    if (typeof window !== 'undefined' && token) {
      const storedEmail = localStorage.getItem('last_verified_email');
      if (storedEmail && checkVerificationStatus(storedEmail)) {
        setRecipientEmail(storedEmail);
        setStep('viewing');
        loadDeckData(storedEmail);
      }
    }
  }, [token]);

  const checkVerificationStatus = useCallback((email: string) => {
    if (typeof window === 'undefined') return false;
    
    const verifiedData = sessionStorage.getItem(`verified_email_${email.toLowerCase()}`)
    if (verifiedData) {
      try {
        const { timestamp, token: storedToken } = JSON.parse(verifiedData)
        // Check if verification is still valid (24 hours)
        return Date.now() - timestamp < 24 * 60 * 60 * 1000 && storedToken === token
      } catch (e) {
        return false
      }
    }
    return false
  }, [token])

  const loadDeckData = useCallback(async (email: string) => {
    if (!token) {
      setError('Missing token');
      return;
    }
    
    setRecipientEmail(email);
    setLoading(true);
    try {
      const response = await fetch('/api/deck/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email })
      });

      const result = await response.json();

      if (response.ok) {
        const deckUrl = `/api/deck/serve/${token}?email=${encodeURIComponent(email)}`;
        
        setShareData({
          deck_url: deckUrl,
          is_downloadable: result.is_downloadable || false
        });
        
        const verificationData = {
          timestamp: Date.now(),
          token: token
        };
        
        sessionStorage.setItem(
          `verified_email_${email.toLowerCase()}`,
          JSON.stringify(verificationData)
        );
        localStorage.setItem('last_verified_email', email);
        setStep('viewing');
      } else {
        throw new Error(result.error || 'Failed to load deck data');
      }
    } catch (err) {
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
        onVerified={loadDeckData}
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

  if (step === 'viewing' && token) {
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
