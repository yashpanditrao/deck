import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto text-center">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🔐 Deck Viewer Platform
          </h1>
          <p className="text-xl text-gray-600 mb-6">
            Secure deck viewing platform for RaiseGate shared content
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>How to Access a Shared Deck</CardTitle>
            <CardDescription>
              If someone shared a deck with you, you should have received a unique link
            </CardDescription>
          </CardHeader>
          <CardContent className="text-left space-y-4">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
                1
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Click Your Share Link</h3>
                <p className="text-gray-600 text-sm">The link will look like: <code className="bg-gray-100 px-1 rounded">/view?token=abc123...</code></p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
                2
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Verify Your Email</h3>
                <p className="text-gray-600 text-sm">Enter the email address the deck was shared with</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
                3
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Enter Verification Code</h3>
                <p className="text-gray-600 text-sm">Check your email for a 6-digit verification code</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-green-100 text-green-800 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
                ✓
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">View the Deck</h3>
                <p className="text-gray-600 text-sm">Access the shared pitch deck securely</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Don&apos;t have a share link?</h3>
          <p className="text-blue-700 text-sm">
            Contact the person who mentioned they would share a deck with you. 
            They need to send you the unique viewing link from their RaiseGate dashboard.
          </p>
        </div>

        <footer className="mt-8 text-center text-gray-500 text-sm">
          <p>Powered by RaiseGate • Secure Deck Sharing Platform</p>
        </footer>
      </div>
    </div>
  )
}
