// Service Worker for Web Push Notifications
// This extends the existing Zero-based notification system with Web Push

const CACHE_NAME = 'hominio-v1';

// Install event - cache static assets
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activate immediately
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim(); // Take control of all pages immediately
});

// Handle messages from main thread (e.g., store session token)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'STORE_SESSION_TOKEN') {
    setSessionToken(event.data.token);
  }
});

// Push event - handle incoming push notifications from VAPID
self.addEventListener('push', (event) => {

  let notificationData = {
    title: 'Hominio',
    body: 'You have a new notification',
    icon: '/favicon-96x96.png',
    badge: '/favicon-96x96.png',
    tag: 'hominio-notification',
    requireInteraction: false,
    data: {},
  };

  // Parse push payload if available
  if (event.data) {
    try {
      const payload = event.data.json();
      notificationData = {
        title: payload.title || notificationData.title,
        body: payload.body || payload.message || notificationData.body,
        icon: payload.icon || notificationData.icon,
        badge: notificationData.badge,
        tag: payload.tag || `notification-${payload.id || Date.now()}`,
        requireInteraction: payload.priority === 'true' || payload.priority === true,
        data: {
          notificationId: payload.id,
          resourceType: payload.resourceType,
          resourceId: payload.resourceId,
          url: payload.url || '/alpha',
        },
      };
    } catch (e) {
      // Use default notification data
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      requireInteraction: notificationData.requireInteraction,
      data: notificationData.data,
      vibrate: notificationData.requireInteraction ? [200, 100, 200] : [200],
      actions: notificationData.data.url
        ? [
            {
              action: 'open',
              title: 'Open',
            },
          ]
        : [],
    })
  );
});

// Notification click event - handle user clicking on notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const notificationData = event.notification.data;
  const urlToOpen = notificationData?.url || '/alpha';

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync event - check for new priority notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-priority-notifications') {
    event.waitUntil(checkForPriorityNotifications());
  }
});

// Periodic background sync - check for priority notifications every 15 minutes
// This works even when browser is closed (on supported platforms)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-priority-notifications') {
    event.waitUntil(checkForPriorityNotifications());
  }
});

// Check for new priority notifications
async function checkForPriorityNotifications() {
  try {
    // Get last checked timestamp from IndexedDB
    const lastChecked = await getLastCheckedTimestamp();
    
    // Get user session token from IndexedDB (stored when user logs in)
    const sessionToken = await getSessionToken();
    
    if (!sessionToken) {
      return;
    }

    // Fetch new priority notifications
    const url = new URL('/alpha/api/notifications/check-priority', self.location.origin);
    if (lastChecked) {
      url.searchParams.set('lastChecked', lastChecked);
    }

    // Fetch with credentials to include cookies
    const response = await fetch(url.toString(), {
      credentials: 'include', // Include cookies automatically
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    
    if (data.notifications && data.notifications.length > 0) {
      // Show notification for each new priority notification
      for (const notification of data.notifications) {
        await self.registration.showNotification(notification.title, {
          body: notification.message,
          icon: notification.icon || '/favicon-96x96.png',
          badge: '/favicon-96x96.png',
          tag: `notification-${notification.id}`,
          requireInteraction: true, // Priority notifications require interaction
          data: {
            notificationId: notification.id,
            resourceType: notification.resourceType,
            resourceId: notification.resourceId,
            url: '/alpha',
          },
          vibrate: [200, 100, 200],
          actions: [
            {
              action: 'open',
              title: 'Open',
            },
          ],
        });
      }

      // Update last checked timestamp
      await setLastCheckedTimestamp(new Date().toISOString());
    }
  } catch (error) {
    // Silently fail - will retry on next sync
  }
}

// IndexedDB helper functions
async function getLastCheckedTimestamp() {
  return new Promise((resolve) => {
    const request = indexedDB.open('hominio-sw', 1);
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['store'], 'readonly');
      const store = transaction.objectStore('store');
      const getRequest = store.get('lastChecked');
      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => resolve(null);
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store');
      }
    };
  });
}

async function setLastCheckedTimestamp(timestamp) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('hominio-sw', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['store'], 'readwrite');
      const store = transaction.objectStore('store');
      const putRequest = store.put(timestamp, 'lastChecked');
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store');
      }
    };
  });
}

async function getSessionToken() {
  // Get session cookie from IndexedDB
  return new Promise((resolve) => {
    const request = indexedDB.open('hominio-sw', 1);
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['store'], 'readonly');
      const store = transaction.objectStore('store');
      const getRequest = store.get('sessionToken');
      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => resolve(null);
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store');
      }
    };
  });
}

async function setSessionToken(token) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('hominio-sw', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['store'], 'readwrite');
      const store = transaction.objectStore('store');
      const putRequest = store.put(token, 'sessionToken');
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('store')) {
        db.createObjectStore('store');
      }
    };
  });
}

