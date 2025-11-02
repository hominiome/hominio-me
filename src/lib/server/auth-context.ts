// Centralized auth data extraction from cookies
// This module provides a consistent way to extract authentication data
// from requests across all server endpoints

import { auth } from '$lib/auth.server';
import { isAdmin as checkIsAdmin } from '$lib/admin.server';

/**
 * AuthData structure used throughout the application
 * Extracted from BetterAuth session cookies
 */
export type AuthData = {
  sub: string;      // User ID (subject)
  isAdmin: boolean; // Admin status (checked against ADMIN env var)
};

/**
 * Extract authentication data from request cookies
 * This is the single source of truth for authentication across the app
 * 
 * Usage:
 * - Zero push endpoint: Get auth for mutator permissions
 * - Zero get-queries endpoint: Get auth for query permissions
 * - API endpoints: Get auth for route protection
 * 
 * @param request - The incoming request (SvelteKit or standard Request)
 * @returns AuthData if authenticated, undefined if anonymous
 */
export async function extractAuthData(request: Request): Promise<AuthData | undefined> {
  // Extract session from cookies using BetterAuth
  // BetterAuth automatically reads cookies from request.headers
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  // If no session, user is anonymous
  if (!session?.user) {
    return undefined;
  }

  // Return standardized auth data
  return {
    sub: session.user.id,
    isAdmin: checkIsAdmin(session.user.id),
  };
}

/**
 * Require authentication - throws if not authenticated
 * Use this in endpoints that require a logged-in user
 * 
 * @param request - The incoming request
 * @returns AuthData for the authenticated user
 * @throws Error if not authenticated
 */
export async function requireAuth(request: Request): Promise<AuthData> {
  const authData = await extractAuthData(request);
  
  if (!authData) {
    throw new Error('Unauthorized: Authentication required');
  }
  
  return authData;
}

/**
 * Require admin - throws if not admin
 * Use this in endpoints that require admin access
 * 
 * @param request - The incoming request
 * @returns AuthData for the admin user
 * @throws Error if not authenticated or not admin
 */
export async function requireAdmin(request: Request): Promise<AuthData> {
  const authData = await requireAuth(request);
  
  if (!authData.isAdmin) {
    throw new Error('Forbidden: Admin access required');
  }
  
  return authData;
}

