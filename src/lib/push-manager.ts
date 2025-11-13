/**
 * Client-side Push Notification Manager
 * Handles Service Worker registration and push subscription
 */

import { browser } from '$app/environment';

let registration: ServiceWorkerRegistration | null = null;
let pushSubscription: PushSubscription | null = null;

/**
 * Register Service Worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!browser || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    });
    return registration;
  } catch (error) {
    return null;
  }
}

/**
 * Request push notification permission and subscribe
 */
export async function requestPushPermission(): Promise<boolean> {
  if (!browser || !('Notification' in window) || !('PushManager' in window)) {
    return false;
  }

  // Check current permission
  const permission = Notification.permission;
  if (permission === 'granted') {
    return true;
  }

  if (permission === 'denied') {
    return false;
  }

  // Request permission
  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!browser || !('PushManager' in window)) {
    return null;
  }

  // Ensure service worker is registered
  if (!registration) {
    registration = await registerServiceWorker();
    if (!registration) {
      return null;
    }
  }

  // Wait for service worker to be ready and active
  await registration.update();
  
  // Wait for service worker to be in 'activated' state
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  
  // Ensure service worker is active
  if (!registration.active) {
    return null;
  }

  // Detect browser type (needed for Chrome/Brave workarounds)
  const userAgent = browser ? navigator.userAgent : 'N/A';
  const isChrome = browser && /Chrome/.test(userAgent) && !/Edg|OPR/.test(userAgent);
  const isBrave = browser && /Brave/.test(userAgent);

  try {
    // Get VAPID public key from server
    const vapidResponse = await fetch('/alpha/api/push/vapid-public-key');
    if (!vapidResponse.ok) {
      return null;
    }
    
    const vapidData = await vapidResponse.json();
    const { publicKey, error } = vapidData;

    if (error || !publicKey) {
      return null;
    }

    // Validate VAPID key format (should be base64 URL-safe, ~87 characters)
    if (publicKey.length < 80 || publicKey.length > 100) {
      return null;
    }

    // Convert VAPID key to Uint8Array
    let applicationServerKey: Uint8Array;
    try {
      applicationServerKey = urlBase64ToUint8Array(publicKey);
      if (applicationServerKey.length !== 65) {
        return null;
      }
    } catch (error) {
      return null;
    }

    // Subscribe to push
    try {
      // Check if push manager is available
      if (!registration.pushManager) {
        return null;
      }

      // Check for existing subscription first
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        // Check if it's the same key by comparing the actual key bytes
        const existingKey = existingSubscription.getKey('p256dh');
        if (existingKey) {
          const existingKeyArray = new Uint8Array(existingKey);
          // Compare keys byte by byte
          let keysMatch = existingKeyArray.length === applicationServerKey.length;
          if (keysMatch) {
            for (let i = 0; i < existingKeyArray.length; i++) {
              if (existingKeyArray[i] !== applicationServerKey[i]) {
                keysMatch = false;
                break;
              }
            }
          }
          
          if (keysMatch) {
            pushSubscription = existingSubscription;
            // Still save to server in case it's not there
            await saveSubscriptionToServer(existingSubscription);
            return existingSubscription;
          } else {
            try {
              await existingSubscription.unsubscribe();
              // Wait a bit for unsubscribe to complete (Chrome sometimes needs this)
              await new Promise((resolve) => setTimeout(resolve, 500));
            } catch (unsubError) {
              // Ignore unsubscribe errors
            }
          }
        }
      }

      // Chrome/Brave specific: Ensure we're using the correct key format
      // Chrome/Brave use FCM (Firebase Cloud Messaging) which can be more strict
      const subscriptionOptions: PushSubscriptionOptionsInit = {
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey,
      };
      
      if (isChrome || isBrave) {
        // Chrome sometimes needs the service worker to be fully ready
        // Wait for the service worker to be in 'activated' state
        if (registration.active?.state !== 'activated') {
          await new Promise((resolve) => {
            const checkState = () => {
              if (registration.active?.state === 'activated') {
                resolve(undefined);
              } else {
                setTimeout(checkState, 100);
              }
            };
            checkState();
          });
        }
        
        // Chrome sometimes needs a small delay before subscribing
        await new Promise((resolve) => setTimeout(resolve, 200));
        
        // Double-check that pushManager is still available
        if (!registration.pushManager) {
          return null;
        }
        
        // Chrome/Brave: Try multiple approaches
        // Chrome's FCM can be very picky about the subscription process
        let lastError: any = null;
        
        // Approach 1: Standard Uint8Array with timeout
        try {
          await new Promise((resolve) => setTimeout(resolve, 200));
          
          pushSubscription = await Promise.race([
            registration.pushManager.subscribe(subscriptionOptions),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Subscription timeout after 10s')), 10000)
            )
          ]) as PushSubscription;
        } catch (error1: any) {
          lastError = error1;
          
          // Approach 2: ArrayBuffer
          try {
            await new Promise((resolve) => setTimeout(resolve, 300));
            
            const arrayBufferKey = applicationServerKey.buffer.slice(
              applicationServerKey.byteOffset,
              applicationServerKey.byteOffset + applicationServerKey.byteLength
            );
            
            pushSubscription = await Promise.race([
              registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: arrayBufferKey,
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Subscription timeout after 10s')), 10000)
              )
            ]) as PushSubscription;
          } catch (error2: any) {
            lastError = error2;
            
            // Approach 3: Try with a fresh service worker registration
            try {
              // Get all service worker registrations first
              const allRegistrations = await navigator.serviceWorker.getRegistrations();
              
              // Unregister all existing service workers
              await Promise.all(allRegistrations.map(reg => reg.unregister()));
              
              // Wait a bit for cleanup
              await new Promise((resolve) => setTimeout(resolve, 1000));
              
              // Re-register fresh
              const newRegistration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/',
              });
              
              // Wait for service worker to be ready
              await newRegistration.update();
              
              // Wait for activation with timeout
              await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                  reject(new Error('Service worker activation timeout'));
                }, 5000);
                
                const checkState = () => {
                  if (newRegistration.active?.state === 'activated') {
                    clearTimeout(timeout);
                    resolve(undefined);
                  } else if (newRegistration.installing) {
                    newRegistration.installing.addEventListener('statechange', () => {
                      if (newRegistration.active?.state === 'activated') {
                        clearTimeout(timeout);
                        resolve(undefined);
                      }
                    });
                  } else {
                    setTimeout(checkState, 100);
                  }
                };
                checkState();
              });
              
              // Wait a bit more for Chrome to fully initialize
              await new Promise((resolve) => setTimeout(resolve, 500));
              
              if (newRegistration.pushManager) {
                pushSubscription = await newRegistration.pushManager.subscribe({
                  userVisibleOnly: true,
                  applicationServerKey: applicationServerKey,
                });
                // Update global registration
                registration = newRegistration;
              } else {
                throw new Error('PushManager not available after refresh');
              }
            } catch (error3: any) {
              throw lastError; // Throw the most recent error
            }
          }
        }
      } else {
        // Safari and other browsers - use standard approach
        pushSubscription = await registration.pushManager.subscribe(subscriptionOptions);
      }

      // Send subscription to server
      await saveSubscriptionToServer(pushSubscription);

      return pushSubscription;
    } catch (subscribeError: any) {
      return null;
    }
  } catch (error: any) {
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!pushSubscription) {
    // Try to get existing subscription
    if (!registration) {
      registration = await registerServiceWorker();
    }
    if (registration) {
      pushSubscription = await registration.pushManager.getSubscription();
    }
  }

  if (!pushSubscription) {
    return true;
  }

  try {
    // Unsubscribe from push service
    const unsubscribed = await pushSubscription.unsubscribe();
    if (unsubscribed) {
      // Notify server
      await fetch('/alpha/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: pushSubscription.endpoint }),
      });
      pushSubscription = null;
    }
    return unsubscribed;
  } catch (error) {
    return false;
  }
}

/**
 * Get device name from user agent
 */
function getDeviceName(): string {
  if (!browser || !navigator.userAgent) {
    return 'Unknown Device';
  }

  const ua = navigator.userAgent;
  const platform = navigator.platform || '';

  // Detect browser
  let browserName = 'Unknown Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browserName = 'Chrome';
  else if (ua.includes('Firefox')) browserName = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browserName = 'Safari';
  else if (ua.includes('Edg')) browserName = 'Edge';
  else if (ua.includes('Opera') || ua.includes('OPR')) browserName = 'Opera';

  // Detect platform
  let platformName = '';
  if (platform.includes('Mac')) platformName = 'Mac';
  else if (platform.includes('Win')) platformName = 'Windows';
  else if (platform.includes('Linux')) platformName = 'Linux';
  else if (/iPhone|iPad|iPod/.test(ua)) platformName = ua.includes('iPhone') ? 'iPhone' : 'iPad';
  else if (ua.includes('Android')) platformName = 'Android';

  return platformName ? `${browserName} on ${platformName}` : browserName;
}

/**
 * Save subscription to server with device information
 */
async function saveSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  const subscriptionData = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(subscription.getKey('p256dh')!),
      auth: arrayBufferToBase64(subscription.getKey('auth')!),
    },
    userAgent: browser ? navigator.userAgent : '',
    deviceName: getDeviceName(),
  };

  const response = await fetch('/alpha/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscriptionData }),
  });

  if (!response.ok) {
    throw new Error('Failed to save subscription to server');
  }
}

/**
 * Convert base64 URL to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Convert ArrayBuffer to base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Store session token in Service Worker's IndexedDB
 * This allows the Service Worker to authenticate API requests
 */
export async function storeSessionToken(): Promise<void> {
  if (!browser || !('serviceWorker' in navigator)) {
    return;
  }

  // Get session cookie from document.cookie
  const cookies = document.cookie.split(';');
  const sessionCookie = cookies.find((c) => c.trim().startsWith('better-auth.session_token='));
  
  if (!sessionCookie) {
    return;
  }

  // Get service worker registration
  if (!registration) {
    registration = await registerServiceWorker();
  }

  if (!registration || !registration.active) {
    return;
  }

  // Send message to service worker to store session token
  registration.active.postMessage({
    type: 'STORE_SESSION_TOKEN',
    token: sessionCookie.trim(),
  });
}

/**
 * Register background sync for priority notifications
 */
export async function registerBackgroundSync(): Promise<boolean> {
  if (!browser || !('serviceWorker' in navigator) || !('sync' in (self as any).registration)) {
    return false;
  }

  if (!registration) {
    registration = await registerServiceWorker();
  }

  if (!registration) {
    return false;
  }

  try {
    // Register periodic background sync (every 15 minutes)
    // Note: This requires "periodic-background-sync" permission
    if ('periodicSync' in registration) {
      // @ts-ignore - periodicSync is experimental
      await registration.periodicSync.register('check-priority-notifications', {
        minInterval: 15 * 60 * 1000, // 15 minutes
      });
    }

    // Register one-time background sync (when browser comes back online)
    await registration.sync.register('check-priority-notifications');
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Initialize push notifications (call during signup)
 * Uses Web Push with VAPID for cross-platform support
 */
export async function initializePushNotifications(): Promise<boolean> {
  // Register service worker
  const reg = await registerServiceWorker();
  if (!reg) {
    return false;
  }

  // Request notification permission
  const hasPermission = await requestPushPermission();
  if (!hasPermission) {
    return false;
  }

  // Subscribe to Web Push (uses VAPID)
  const subscription = await subscribeToPush();
  return subscription !== null;
}
