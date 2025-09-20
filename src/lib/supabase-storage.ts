import { supabase } from './supabase'

const BUCKET_NAME = 'deck'
const DEFAULT_EXPIRATION = 3600 // 1 hour in seconds

/**
 * Generate a signed URL for accessing a file in Supabase Storage
 * @param fileName - The name of the file in the storage bucket (from deck_url)
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns Promise<string> - The signed URL
 */
export async function generateSignedUrl(
  fileName: string, 
  expiresIn: number = DEFAULT_EXPIRATION
): Promise<string> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, expiresIn)

    if (error) {
      console.error('Error generating signed URL:', error)
      throw new Error(`Failed to generate signed URL: ${error.message}`)
    }

    if (!data?.signedUrl) {
      throw new Error('No signed URL returned from Supabase')
    }

    return data.signedUrl
  } catch (error) {
    console.error('Error generating signed URL:', error)
    throw new Error('Failed to generate signed URL for file access')
  }
}

/**
 * Check if a file exists in the Supabase Storage bucket
 * @param fileName - The name of the file to check
 * @returns Promise<boolean> - Whether the file exists
 */
export async function fileExists(fileName: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('', {
        limit: 1,
        search: fileName
      })

    if (error) {
      console.error('Error checking file existence:', error)
      return false
    }

    return data && data.length > 0 && data.some(file => file.name === fileName)
  } catch (error) {
    console.error('Error checking file existence:', error)
    return false
  }
}

/**
 * Generate a signed URL with file existence check
 * @param fileName - The name of the file in the storage bucket
 * @param expiresIn - URL expiration time in seconds
 * @returns Promise<string> - The signed URL
 * @throws Error if file doesn't exist
 */
export async function generateSignedUrlWithCheck(
  fileName: string, 
  expiresIn: number = DEFAULT_EXPIRATION
): Promise<string> {
  const exists = await fileExists(fileName)
  if (!exists) {
    throw new Error(`File not found in storage: ${fileName}`)
  }
  
  return generateSignedUrl(fileName, expiresIn)
}