import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getZeroDbInstance } from '$lib/zero-manager.server.js';
import { extractAuthData } from '$lib/server/auth-context.js';

/**
 * Check for new priority notifications
 * GET /alpha/api/notifications/check-priority?lastChecked=ISO_TIMESTAMP
 * 
 * Returns unread priority notifications created after lastChecked timestamp
 */
export const GET: RequestHandler = async ({ request, url }) => {
  try {
    const authData = await extractAuthData(request);
    
    if (!authData) {
      return json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = authData.sub;
    const lastCheckedParam = url.searchParams.get('lastChecked');
    const lastChecked = lastCheckedParam ? new Date(lastCheckedParam) : new Date(0);

    const zeroDb = getZeroDbInstance();

    // Get unread priority notifications created after lastChecked
    const notifications = await zeroDb
      .selectFrom('notification')
      .selectAll()
      .where('userId', '=', userId)
      .where('read', '=', 'false')
      .where('priority', '=', 'true')
      .where('createdAt', '>', lastChecked.toISOString())
      .orderBy('createdAt', 'desc')
      .execute();

    return json({
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        resourceType: n.resourceType,
        resourceId: n.resourceId,
        priority: n.priority,
        icon: n.icon || '/favicon-96x96.png',
        createdAt: n.createdAt,
      })),
      count: notifications.length,
    });
  } catch (error) {
    console.error('Check priority notifications error:', error);
    return json(
      {
        error: error instanceof Error ? error.message : 'Failed to check notifications',
      },
      { status: 500 }
    );
  }
};

