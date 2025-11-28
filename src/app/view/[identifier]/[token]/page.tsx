'use client'

import { useState, useCallback, Suspense, useEffect } from 'react'
import { useParams } from 'next/navigation'
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

const ViewDeckContentWithIdentifier = () => {
  const params = useParams()
  // Identifier is just for convenience in the URL - we ignore it and use token only
  const token = params?.token as string

  const [shareData, setShareData] = useState<ShareLinkData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('verification');
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Check for existing verification on initial load
  useEffect(() => {
    const checkAccess = async () => {
      if (!token) {
        setError('Invalid link: token is required');
        return;
      }

      try {
        // 1. Check access requirements
        const reqResponse = await fetch(`/api/access/requirements?token=${token}`);
        const requirements = await reqResponse.json();

        if (!reqResponse.ok) {
          setError(requirements.error || 'Failed to load access requirements');
          return;
        }

        // 2. Handle Public Access
        if (requirements.accessLevel === 'public') {
          setStep('viewing');
          loadDeckData(token, null);
          return;
        }

        // 3. Handle Restricted/Whitelisted Access - Check for JWT
        const storedAccessToken = localStorage.getItem(`access_token_${token}`);

        if (storedAccessToken) {
          // We have an access token, proceed to view
          setAccessToken(storedAccessToken);
          setStep('viewing');
          loadDeckData(token, storedAccessToken);
        } else {
          // No access token, redirect to verify page
          window.location.href = `/verify?token=${token}`;
        }

      } catch {
        setError('Failed to check access permissions');
      }
    };

    checkAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadDeckData = useCallback(async (token: string, accessToken: string | null) => {
    setLoading(true);
    try {
      const response = await fetch('/api/deck/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email: '' }) // email not needed anymore
      });

      const result = await response.json();

      if (response.ok) {
        // Construct URL with access token if available
        const deckUrl = accessToken
          ? `/api/deck/serve/${token}?accessToken=${encodeURIComponent(accessToken)}`
          : `/api/deck/serve/${token}`;

        setShareData({
          deck_url: deckUrl,
          is_downloadable: result.is_downloadable || false
        });

        setStep('viewing');
      } else {
        throw new Error(result.error || 'Failed to load deck data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deck');
    } finally {
      setLoading(false);
    }
  }, []);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Invalid Link</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This link is invalid or has expired. Please check the URL and try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>{error}</p>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span className="text-gray-300">Loading deck...</span>
        </div>
      </div>
    );
  }

  if (step === 'viewing' && shareData) {
    return (
      <PdfViewer
        pdfLink={shareData.deck_url}
        isDownloadable={shareData.is_downloadable}
        token={token}
        accessToken={accessToken}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please wait while we verify your access...</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default function ViewDeckPageWithIdentifier() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4 text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <span className="text-gray-300">Loading...</span>
        </div>
      </div>
    }>
      <ViewDeckContentWithIdentifier />
    </Suspense>
  );
}

