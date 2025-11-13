import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getZeroDbInstance } from '$lib/db.server.js';
import { extractAuthData } from '$lib/server/auth-context.js';
import { nanoid } from 'nanoid';

/**
 * Subscribe to Web Push Notifications
 * POST /alpha/api/push/subscribe
 * 
 * Body: {
 *   subscription: {
 *     endpoint: string,
 *     keys: {
 *       p256dh: string,
 *       auth: string
 *     }
 *   }
 * }
 */
export const POST: RequestHandler = async ({ request }) => {
  try {
    const authData = await extractAuthData(request);
    
    if (!authData) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subscription } = await request.json();

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return json({ error: 'Invalid subscription data' }, { status: 400 });
    }

    const zeroDb = getZeroDbInstance();
    const userId = authData.sub;
    const now = new Date().toISOString();

    // Extract device information
    const userAgent = subscription.userAgent || request.headers.get('user-agent') || '';
    const deviceName = subscription.deviceName || 'Unknown Device';

    // Check if subscription already exists for this endpoint
    const existing = await zeroDb
      .selectFrom('pushSubscription')
      .selectAll()
      .where('endpoint', '=', subscription.endpoint)
      .where('userId', '=', userId)
      .executeTakeFirst();

    if (existing) {
      // Update existing subscription (including device info)
      await zeroDb
        .updateTable('pushSubscription')
        .set({
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          userAgent: userAgent,
          deviceName: deviceName,
          updatedAt: now,
        })
        .where('id', '=', existing.id)
        .execute();

      return json({ success: true, message: 'Subscription updated' });
    }

    // Create new subscription
    const subscriptionId = nanoid();
    await zeroDb
      .insertInto('pushSubscription')
      .values({
        id: subscriptionId,
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: userAgent,
        deviceName: deviceName,
        createdAt: now,
        updatedAt: now,
      })
      .execute();

    // Update user preferences - pushEnabled is automatically true if subscriptions exist
    // We'll update it here for consistency, but it's computed from subscriptions
    const existingPrefs = await zeroDb
      .selectFrom('userPreferences')
      .selectAll()
      .where('userId', '=', userId)
      .executeTakeFirst();

    if (existingPrefs) {
      await zeroDb
        .updateTable('userPreferences')
        .set({
          pushEnabled: 'true', // At least one subscription exists
          updatedAt: now,
        })
        .where('userId', '=', userId)
        .execute();
    } else {
      const prefsId = nanoid();
      await zeroDb
        .insertInto('userPreferences')
        .values({
          id: prefsId,
          userId,
          newsletterSubscribed: 'false',
          pushEnabled: 'true', // At least one subscription exists
          updatedAt: now,
        })
        .execute();
    }

    return json({ success: true, message: 'Subscription created' });
  } catch (error) {
    console.error('Push subscription error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to subscribe',
      },
      { status: 500 }
    );
  }
};

