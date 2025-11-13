/**
 * Server-side helper for sending Web Push Notifications
 * Uses web-push library (needs to be installed)
 */

import { getZeroDbInstance } from './db.server.js';
import webpush from 'web-push';
import { env as privateEnv } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

// Initialize web-push with VAPID keys from environment
// SECRET_VAPID_PRIVATE_KEY - server-side only (private)
// PUBLIC_VAPID_PUBLIC_KEY - available on client and server (public)
// PUBLIC_VAPID_SUBJECT - available on client and server (public)
// VAPID_SUBJECT must be a valid mailto: URL (e.g., mailto:admin@example.com)
const VAPID_PUBLIC_KEY = publicEnv.PUBLIC_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = privateEnv.SECRET_VAPID_PRIVATE_KEY || '';
let VAPID_SUBJECT = publicEnv.PUBLIC_VAPID_SUBJECT || 'mailto:admin@hominio.me';

// Ensure VAPID_SUBJECT is a valid mailto: URL
if (VAPID_SUBJECT && !VAPID_SUBJECT.startsWith('mailto:')) {
  // If it's just an email address, add mailto: prefix
  if (VAPID_SUBJECT.includes('@')) {
    VAPID_SUBJECT = `mailto:${VAPID_SUBJECT}`;
  } else {
    // Invalid format, use default
    VAPID_SUBJECT = 'mailto:admin@hominio.me';
  }
}

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (error) {
    throw error;
  }
}

export interface PushNotificationPayload {
  id: string;
  title: string;
  message: string;
  resourceType: string;
  resourceId: string;
  priority?: string;
  icon?: string;
  url?: string;
}

/**
 * Send push notification to a user
 * Only sends if user has pushEnabled=true and has active subscriptions
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { sent: 0, failed: 0 };
  }

  const zeroDb = getZeroDbInstance();

  // Check if user has push enabled
  const prefs = await zeroDb
    .selectFrom('userPreferences')
    .selectAll()
    .where('userId', '=', userId)
    .executeTakeFirst();

  if (!prefs || prefs.pushEnabled !== 'true') {
    return { sent: 0, failed: 0 };
  }

  // Get all push subscriptions for user
  const subscriptions = await zeroDb
    .selectFrom('pushSubscription')
    .selectAll()
    .where('userId', '=', userId)
    .execute();

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0 };
  }

  // Prepare notification payload
  const notificationPayload = JSON.stringify({
    id: payload.id,
    title: payload.title,
    body: payload.message,
    message: payload.message,
    resourceType: payload.resourceType,
    resourceId: payload.resourceId,
    priority: payload.priority || 'false',
    icon: payload.icon || '/favicon-96x96.png',
    url: payload.url || '/alpha',
    tag: `notification-${payload.id}`,
  });

  let sent = 0;
  let failed = 0;

  // Send to all subscriptions
  const sendPromises = subscriptions.map(async (sub) => {
    try {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      await webpush.sendNotification(pushSubscription, notificationPayload);
      sent++;
    } catch (error: any) {
      failed++;

      // If subscription is invalid (410 Gone or 404 Not Found), remove it
      if (error.statusCode === 410 || error.statusCode === 404) {
        await zeroDb
          .deleteFrom('pushSubscription')
          .where('id', '=', sub.id)
          .execute();
      }
    }
  });

  await Promise.allSettled(sendPromises);

  return { sent, failed };
}

/**
 * Send push notification when a priority notification is created
 * This is called from notification creation endpoints
 */
export async function sendPushForPriorityNotification(notification: {
  id: string;
  userId: string;
  title: string;
  message: string;
  resourceType: string;
  resourceId: string;
  priority: string;
  icon?: string;
}): Promise<void> {
  // Only send push for priority notifications
  if (notification.priority !== 'true') {
    return;
  }

  await sendPushNotification(notification.userId, {
    id: notification.id,
    title: notification.title,
    message: notification.message,
    resourceType: notification.resourceType,
    resourceId: notification.resourceId,
    priority: notification.priority,
    icon: notification.icon,
    url: '/alpha',
  });
}

