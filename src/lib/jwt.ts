import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

// Enforce JWT_SECRET - throw error if not set
if (!process.env.JWT_SECRET) {
    throw new Error('CRITICAL: JWT_SECRET environment variable is not set. Application cannot start.')
}

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET)

export interface AccessTokenPayload extends JWTPayload {
    token: string // The share link token
    email: string // The verified email
    accessLevel: 'public' | 'restricted' | 'whitelisted'
}

/**
 * Generate a JWT access token for a verified user
 * @param payload - Token payload containing share link token and email
 * @param expiresIn - Token expiration time in seconds (default: 2 hours for security)
 */
export async function generateAccessToken(
    payload: Omit<AccessTokenPayload, 'iat' | 'exp'>,
    expiresIn: number = 2 * 60 * 60 // 2 hours (reduced from 24 for security)
): Promise<string> {
    const token = await new SignJWT(payload as JWTPayload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn)
        .sign(JWT_SECRET)

    return token
}

/**
 * Verify and decode a JWT access token
 * @param token - The JWT token to verify
 * @returns The decoded payload if valid, null otherwise
 */
export async function verifyAccessToken(
    token: string
): Promise<AccessTokenPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET)
        return payload as AccessTokenPayload
    } catch (error) {
        console.error('JWT verification failed:', error)
        return null
    }
}

// Alias for backwards compatibility
export const verifyJWT = verifyAccessToken;
