/**
 * Domain normalization utilities
 * Handles both hominio.me and www.hominio.me domains
 */

import { browser } from '$app/environment';
import { env as publicEnv } from '$env/dynamic/public';

/**
 * Get the base domain from environment variable
 * Accepts domain with or without protocol/port
 * Examples: "hominio.me", "https://hominio.me", "hominio.me:3000"
 * Returns: "hominio.me" (normalized, no protocol, no port, no www)
 */
export function getBaseDomain(): string {
  const domain = publicEnv.PUBLIC_DOMAIN;
  
  if (domain && typeof domain === 'string' && domain.trim()) {
    let normalized = domain.trim();
    
    // Remove protocol if present
    normalized = normalized.replace(/^https?:\/\//, '');
    normalized = normalized.replace(/^wss?:\/\//, '');
    
    // Remove www. prefix (we'll handle www separately)
    normalized = normalized.replace(/^www\./, '');
    
    // Remove port if present
    normalized = normalized.split(':')[0];
    
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    
    return normalized;
  }
  
  // Fallback: detect from browser location
  if (browser) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'localhost';
    }
    // Remove www. prefix for base domain
    return hostname.replace(/^www\./, '');
  }
  
  // Server-side fallback
  return 'hominio.me';
}

/**
 * Get the Zero sync domain from environment variable
 * Defaults to sync.{baseDomain}
 */
export function getZeroSyncDomain(): string {
  const syncDomain = publicEnv.PUBLIC_ZERO_SYNC_DOMAIN;
  
  if (syncDomain && typeof syncDomain === 'string' && syncDomain.trim()) {
    let normalized = syncDomain.trim();
    
    // Remove protocol if present
    normalized = normalized.replace(/^https?:\/\//, '');
    normalized = normalized.replace(/^wss?:\/\//, '');
    
    // Remove port if present
    normalized = normalized.split(':')[0];
    
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    
    return normalized;
  }
  
  // Default to sync.{baseDomain}
  return `sync.${getBaseDomain()}`;
}

/**
 * Get full HTTPS URL for the main domain
 * Returns both hominio.me and www.hominio.me variants based on current request
 * @param path - Optional path to append (e.g., "/alpha/api/zero/get-queries")
 * @param preferWww - If true, prefer www. variant (default: detect from current location)
 */
export function getMainDomainUrl(path: string = '', preferWww?: boolean): string {
  const baseDomain = getBaseDomain();
  
  // In browser, detect if we're on www or non-www
  if (browser) {
    const isWww = window.location.hostname.startsWith('www.');
    const useWww = preferWww ?? isWww;
    const domain = useWww ? `www.${baseDomain}` : baseDomain;
    return `https://${domain}${path}`;
  }
  
  // Server-side: default to non-www, but accept both
  // When building URLs for callbacks, use non-www as default
  return `https://${baseDomain}${path}`;
}

/**
 * Get WebSocket URL for Zero sync service
 * Zero client accepts https:// and handles WebSocket upgrade internally
 * Using https:// instead of wss:// as Zero requires http/https scheme
 */
export function getZeroServerUrl(): string {
  const syncDomain = getZeroSyncDomain();
  // Zero client accepts https:// and handles WebSocket upgrade internally
  return `https://${syncDomain}`;
}

/**
 * Get all trusted origins (for CORS, BetterAuth, etc.)
 * Includes both www and non-www variants
 */
export function getTrustedOrigins(): string[] {
  const baseDomain = getBaseDomain();
  const syncDomain = getZeroSyncDomain();
  
  return [
    `https://${baseDomain}`,
    `https://www.${baseDomain}`,
    `https://${syncDomain}`,
  ];
}

/**
 * Check if a given origin is trusted
 */
export function isTrustedOrigin(origin: string): boolean {
  const trusted = getTrustedOrigins();
  return trusted.includes(origin);
}

