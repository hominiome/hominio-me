import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getZeroDbInstance } from '$lib/db.server.js';
import { extractAuthData } from '$lib/server/auth-context.js';

/**
 * Unsubscribe from Web Push Notifications
 * POST /alpha/api/push/unsubscribe
 * 
 * Body: {
 *   endpoint: string (optional - if not provided, removes all subscriptions for user)
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const authData = await extractAuthData(request);
    
    if (!authData) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { endpoint } = await request.json();
    const zeroDb = getZeroDbInstance();
    const userId = authData.sub;
    const now = new Date().toISOString();

    if (endpoint) {
      // Remove specific subscription
      await zeroDb
        .deleteFrom('pushSubscription')
        .where('endpoint', '=', endpoint)
        .where('userId', '=', userId)
        .execute();
    } else {
      // Remove all subscriptions for user
      await zeroDb
        .deleteFrom('pushSubscription')
        .where('userId', '=', userId)
        .execute();
    }

    // Check if user has any remaining subscriptions
    const remaining = await zeroDb
      .selectFrom('pushSubscription')
      .selectAll()
      .where('userId', '=', userId)
      .execute();

    // Update user preferences - disable push if no subscriptions remain
    await zeroDb
      .updateTable('userPreferences')
      .set({
        pushEnabled: remaining.length > 0 ? 'true' : 'false',
        updatedAt: now,
      })
      .where('userId', '=', userId)
      .execute();

    return json({ success: true, message: 'Unsubscribed' });
  } catch (error) {
    console.error('Push unsubscribe error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to unsubscribe',
      },
      { status: 500 }
    );
  }
};

