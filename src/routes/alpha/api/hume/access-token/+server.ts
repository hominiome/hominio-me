import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  try {
    const HUME_API_KEY = process.env.HUME_API_KEY;
    const HUME_SECRET_KEY = process.env.HUME_SECRET_KEY;

    if (!HUME_API_KEY || !HUME_SECRET_KEY) {
      console.error('[Hume] ❌ Missing credentials - HUME_API_KEY or HUME_SECRET_KEY not set');
      return json(
        {
          error: 'Hume credentials not configured'
        },
        {
          status: 500
        }
      );
    }

    console.log('[Hume] 🔑 Fetching access token...');

    // Fetch access token from Hume
    const response = await fetch('https://api.hume.ai/oauth2-cc/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: HUME_API_KEY,
        client_secret: HUME_SECRET_KEY,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[Hume] ❌ Token fetch failed:', {
        status: response.status,
        statusText: response.statusText,
        body: errorBody
      });

      // Parse error to give helpful feedback
      let errorMessage = response.statusText;
      try {
        const errorJson = JSON.parse(errorBody);
        errorMessage = errorJson.error_description || errorJson.error || errorMessage;

        // Check for common errors
        if (errorMessage.includes('insufficient') || errorMessage.includes('credit')) {
          console.error('[Hume] 💳 INSUFFICIENT CREDITS - Please top up your Hume account');
          errorMessage = 'Insufficient Hume credits. Please top up your account at https://platform.hume.ai/';
        } else if (errorMessage.includes('invalid') || errorMessage.includes('unauthorized')) {
          console.error('[Hume] 🔐 INVALID CREDENTIALS - Check your API keys');
          errorMessage = 'Invalid Hume credentials. Please verify HUME_API_KEY and HUME_SECRET_KEY';
        }
      } catch (e) {
        // Error body not JSON
      }

      return json(
        {
          error: 'Failed to fetch Hume access token',
          details: errorMessage,
          status: response.status
        },
        {
          status: response.status
        }
      );
    }

    const data = await response.json();
    console.log('[Hume] ✅ Access token fetched successfully', {
      expiresIn: data.expires_in,
      tokenPreview: data.access_token.substring(0, 20) + '...'
    });

    return json({
      accessToken: data.access_token,
      expiresIn: data.expires_in,
    });
  } catch (error: any) {
    console.error('[Hume] ❌ Unexpected error fetching access token:', error);
    console.error('[Hume] ❌ Error stack:', error.stack);
    return json(
      {
        error: 'Failed to fetch access token',
        details: error.message
      },
      {
        status: 500
      }
    );
  }
};

