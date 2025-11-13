import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';

/**
 * Get VAPID public key for push notifications
 * GET /alpha/api/push/vapid-public-key
 */
export const GET: RequestHandler = async () => {
  try {
    const publicKey = env.PUBLIC_VAPID_PUBLIC_KEY || '';
    
    // Remove quotes if present (sometimes .env files add quotes)
    const cleanPublicKey = publicKey.replace(/^["']|["']$/g, '').trim();
    
    if (!cleanPublicKey) {
      return json({ 
        error: 'VAPID public key not configured',
        details: 'PUBLIC_VAPID_PUBLIC_KEY environment variable is not set or empty'
      }, { status: 500 });
    }

    // Validate key format (should be base64 URL-safe, ~87 characters)
    if (cleanPublicKey.length < 80 || cleanPublicKey.length > 100) {
      return json({ 
        error: 'VAPID public key has invalid format',
        details: `Key length is ${cleanPublicKey.length}, expected 80-100 characters`
      }, { status: 500 });
    }

    // Check for common base64 URL-safe characters
    const base64UrlPattern = /^[A-Za-z0-9_-]+$/;
    if (!base64UrlPattern.test(cleanPublicKey)) {
      return json({ 
        error: 'VAPID public key has invalid format',
        details: 'Key should only contain base64 URL-safe characters (A-Z, a-z, 0-9, -, _)'
      }, { status: 500 });
    }

    return json({ publicKey: cleanPublicKey });
  } catch (error) {
    return json({ 
      error: 'Failed to get VAPID public key',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

