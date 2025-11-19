'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Mail, Lock, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

function VerifyContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const token = searchParams.get('token')

    const [step, setStep] = useState<'email' | 'otp'>('email')
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [successMessage, setSuccessMessage] = useState('')
    const [checkingAccess, setCheckingAccess] = useState(true)

    // Check if this is a public link - if so, redirect to view
    useEffect(() => {
        const checkAccessLevel = async () => {
            if (!token) {
                setError('Invalid link. Token is missing.')
                setCheckingAccess(false)
                return
            }

            try {
                const response = await fetch(`/api/access/requirements?token=${token}`)
                const data = await response.json()

                if (response.ok && data.accessLevel === 'public') {
                    // Public link - redirect to view page directly
                    router.push(`/view?token=${token}`)
                    return
                }

                // Not public - continue with verification flow
                setCheckingAccess(false)
            } catch (err) {
                console.error('Error checking access level:', err)
                setCheckingAccess(false)
            }
        }

        checkAccessLevel()
    }, [token, router])

    const handleRequestCode = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!token) return

        setLoading(true)
        setError('')
        setSuccessMessage('')

        try {
            const response = await fetch('/api/verify/request-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, email })
            })

            const data = await response.json()

            if (response.ok) {
                setStep('otp')
                setSuccessMessage('Verification code sent to your email')
            } else {
                setError(data.error || 'Failed to send verification code')
            }
        } catch (_err) {
            setError('Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleVerifyCode = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!token) return

        setLoading(true)
        setError('')

        try {
            const response = await fetch('/api/verify/confirm-code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, code: otp, email })
            })

            const data = await response.json()

            if (response.ok && data.accessToken) {
                // Store the JWT access token
                localStorage.setItem(`access_token_${token}`, data.accessToken)
                localStorage.setItem('last_verified_email', email)

                // Redirect to view
                router.push(`/view?token=${token}`)
            } else {
                setError(data.error || 'Invalid verification code')
            }
        } catch (_err) {
            setError('Network error. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    // Show loading while checking if it's a public link
    if (checkingAccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-[#771144]" />
            </div>
        )
    }

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-red-600">Error</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>Invalid link. Please check the URL and try again.</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="space-y-1">
                    <div className="flex justify-center mb-4">
                        {step === 'email' ? (
                            <div className="p-3 bg-blue-50 rounded-full">
                                <Mail className="h-8 w-8 text-[#771144]" />
                            </div>
                        ) : (
                            <div className="p-3 bg-blue-50 rounded-full">
                                <Lock className="h-8 w-8 text-[#771144]" />
                            </div>
                        )}
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">
                        {step === 'email' ? 'Access Verification' : 'Enter Verification Code'}
                    </CardTitle>
                    <CardDescription className="text-center">
                        {step === 'email'
                            ? 'Please enter your email to access this deck'
                            : `We sent a code to ${email}`}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <div className="mb-4 p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-100">
                            {error}
                        </div>
                    )}
                    {successMessage && (
                        <div className="mb-4 p-3 text-sm text-green-600 bg-green-50 rounded-md border border-green-100">
                            {successMessage}
                        </div>
                    )}

                    {step === 'email' ? (
                        <form onSubmit={handleRequestCode} className="space-y-4">
                            <div className="space-y-2">
                                <Input
                                    type="email"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="h-11"
                                    autoFocus
                                />
                            </div>
                            <Button
                                type="submit"
                                className="w-full h-11 bg-[#771144] hover:bg-[#5a0d33]"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending Code...
                                    </>
                                ) : (
                                    <>
                                        Continue <ArrowRight className="ml-2 h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyCode} className="space-y-4">
                            <div className="space-y-2">
                                <Input
                                    type="text"
                                    placeholder="Enter 6-digit code"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    required
                                    className="h-11 text-center text-lg tracking-widest"
                                    autoFocus
                                    maxLength={6}
                                />
                            </div>
                            <Button
                                type="submit"
                                className="w-full h-11 bg-[#771144] hover:bg-[#5a0d33]"
                                disabled={loading || otp.length !== 6}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    'Verify & Access'
                                )}
                            </Button>
                            <div className="text-center">
                                <button
                                    type="button"
                                    onClick={() => setStep('email')}
                                    className="text-sm text-gray-500 hover:text-gray-700 underline"
                                >
                                    Change email
                                </button>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

export default function VerifyPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-[#771144]" />
            </div>
        }>
            <VerifyContent />
        </Suspense>
    )
}
