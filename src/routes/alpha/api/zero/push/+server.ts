import { json } from '@sveltejs/kit';
import { PushProcessor } from '@rocicorp/zero/server';
import { zeroNodePg } from '@rocicorp/zero/server/adapters/pg';
import { Pool } from 'pg';
import { schema } from '../../../../../zero-schema';
import { extractAuthData } from '$lib/server/auth-context';
import { createMutators } from '../../../../../lib/mutators';
import { createServerMutators } from '../../../../../lib/mutators.server';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

// Create a single Pool instance for reuse
// Using pg Pool directly (Neon's connection string is compatible)
let dbPool: Pool | null = null;

function getDbPool(): Pool {
  if (!dbPool) {
    const connectionString = env.SECRET_ZERO_DEV_PG;
    if (!connectionString) {
      throw new Error('SECRET_ZERO_DEV_PG environment variable is required');
    }
    dbPool = new Pool({
      connectionString,
      // Connection pool settings
      max: 10, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return an error after 10 seconds if connection could not be established
    });
  }
  return dbPool;
}

// Create PushProcessor instance (reused across requests)
let processor: PushProcessor | null = null;

function getProcessor(): PushProcessor {
  if (!processor) {
    const pool = getDbPool();
    // Create ZQLDatabase adapter for Zero using pg Pool
    const db = zeroNodePg(schema, pool);
    processor = new PushProcessor(db);
  }
  return processor;
}

/**
 * Zero Push Endpoint for Custom Mutators
 * Handles mutations from zero-cache with cookie-based authentication
 * 
 * Flow:
 * 1. Client calls mutator → runs optimistically on client
 * 2. zero-cache forwards mutation to this endpoint
 * 3. We authenticate via cookies (BetterAuth)
 * 4. We run server mutator with permission checks
 * 5. Result synced back to all clients
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    // Debug: Log all headers and cookies to see what's being forwarded
    console.log('[push] Request headers:', Object.fromEntries(request.headers.entries()));
    console.log('[push] Cookie header:', request.headers.get('cookie'));
    console.log('[push] Available cookies from SvelteKit:', cookies.getAll());
    
    // Extract auth data from cookies using centralized auth context
    // This automatically reads BetterAuth session and checks admin status
    const authData = await extractAuthData(request);

    // Log for debugging
    if (authData) {
      console.log('[push] ✅ Authenticated user:', authData.sub, 'isAdmin:', authData.isAdmin);
    } else {
      console.log('[push] ❌ Anonymous request - NO AUTH DATA');
    }

    // Create client mutators (will be reused by server mutators)
    const clientMutators = createMutators(authData);

    // Create server mutators with permission checks
    const serverMutators = createServerMutators(authData, clientMutators);

    // Get PushProcessor instance
    const pushProcessor = getProcessor();

    // Process push request
    // PushProcessor handles the push protocol, executing mutators in transactions
    const result = await pushProcessor.process(serverMutators, request);

    return json(result);
  } catch (error) {
    console.error('Error handling push request:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

