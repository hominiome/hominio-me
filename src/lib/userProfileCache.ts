/**
 * User Profile Cache
 * 
 * Fetches and caches user profile data (name, image) from the API
 * to avoid storing denormalized data in the project schema
 */

interface UserProfile {
  id: string;
  name: string | null;
  image: string | null;
}

const cache = new Map<string, UserProfile>();
const pendingRequests = new Map<string, Promise<UserProfile>>();

/**
 * Fetch user profile from API with caching
 * @param userId - User ID to fetch
 * @returns User profile with name and image
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  // Return cached value if available
  if (cache.has(userId)) {
    return cache.get(userId)!;
  }

  // Return pending request if already fetching
  if (pendingRequests.has(userId)) {
    return pendingRequests.get(userId)!;
  }

  // Create new fetch request
  const fetchPromise = (async () => {
    try {
      const response = await fetch(`/alpha/api/user/${userId}`);
      
      if (!response.ok) {
        // Return default profile if user not found
        const defaultProfile: UserProfile = {
          id: userId,
          name: "Anonymous",
          image: null,
        };
        cache.set(userId, defaultProfile);
        return defaultProfile;
      }

      const profile = await response.json();
      cache.set(userId, profile);
      return profile;
    } catch (error) {
      console.error(`Failed to fetch user profile for ${userId}:`, error);
      // Return default profile on error
      const defaultProfile: UserProfile = {
        id: userId,
        name: "Anonymous",
        image: null,
      };
      cache.set(userId, defaultProfile);
      return defaultProfile;
    } finally {
      pendingRequests.delete(userId);
    }
  })();

  pendingRequests.set(userId, fetchPromise);
  return fetchPromise;
}

/**
 * Prefetch multiple user profiles in parallel
 * @param userIds - Array of user IDs to fetch
 */
export async function prefetchUserProfiles(userIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(userIds)];
  const uncachedIds = uniqueIds.filter(id => !cache.has(id) && !pendingRequests.has(id));
  
  if (uncachedIds.length === 0) return;

  // Fetch all uncached profiles in parallel
  await Promise.all(uncachedIds.map(id => getUserProfile(id)));
}

/**
 * Clear the cache (useful for testing or refresh)
 */
export function clearUserProfileCache(): void {
  cache.clear();
  pendingRequests.clear();
}

/**
 * Get cached profile without fetching (returns null if not cached)
 */
export function getCachedUserProfile(userId: string): UserProfile | null {
  return cache.get(userId) || null;
}

