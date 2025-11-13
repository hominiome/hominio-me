// Centralized role definitions for the Hominio platform
// These roles determine user permissions across the application

/**
 * User roles in the Hominio system
 * - DEFAULT: Regular user (can participate with hominio identity)
 * - FOUNDER: User with founder identity (can create and manage projects)
 * - ADMIN: Administrator (full system access)
 */
export const USER_ROLES = {
  DEFAULT: 'default',
  FOUNDER: 'founder',
  ADMIN: 'admin'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

// Re-export role checking utilities (for use in mutators and components)
export { isAdmin, isFounder, hasRole } from './permissions/roles';

// Re-export server-side auth utilities (for use in API endpoints)
export { extractAuthData, requireAuth, requireAdmin, type AuthData } from './server/auth-context';

