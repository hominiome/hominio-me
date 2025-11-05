import { json } from '@sveltejs/kit';
import { handleGetQueriesRequest, type ReadonlyJSONValue } from '@rocicorp/zero/server';
import { schema } from '../../../../../zero-schema';
import { builder } from '../../../../../zero-schema';
import { extractAuthData } from '$lib/server/auth-context';
import { getTrustedOrigins, isTrustedOrigin } from '$lib/utils/domain';
import z from 'zod';
import type { RequestHandler } from './$types';

// Server-side query implementations
// We can't import synced-queries.ts here because it uses syncedQuery (client-only)
// Instead, we implement the queries directly using the builder
function getQuery(name: string, args: readonly ReadonlyJSONValue[]) {
  // ========================================
  // NOTIFICATION QUERIES
  // ========================================
  
  if (name === 'myNotifications') {
    z.tuple([z.string()]).parse(args);
    const [userId] = args as [string];
    return {
      query: builder.notification
        .where('userId', '=', userId)
        .orderBy('createdAt', 'desc'),
    };
  }
  
  if (name === 'unreadNotificationCount') {
    z.tuple([z.string()]).parse(args);
    const [userId] = args as [string];
    return {
      query: builder.notification
        .where('userId', '=', userId)
        .where('read', '=', 'false'),
    };
  }

  // ========================================
  // USER PREFERENCES QUERIES
  // ========================================
  
  if (name === 'userPreferencesByUser') {
    z.tuple([z.string()]).parse(args);
    const [userId] = args as [string];
    return {
      query: builder.userPreferences.where('userId', '=', userId),
    };
  }

  // ========================================
  // PROJECT QUERIES
  // ========================================
  
  if (name === 'allProjects') {
    z.tuple([]).parse(args);
    return {
      query: builder.project.orderBy('createdAt', 'desc'),
    };
  }
  
  if (name === 'projectById') {
    z.tuple([z.string()]).parse(args);
    const [projectId] = args as [string];
    return {
      query: builder.project.where('id', '=', projectId),
    };
  }
  
  if (name === 'projectsByUser') {
    z.tuple([z.string()]).parse(args);
    const [userId] = args as [string];
    return {
      query: builder.project
        .where('userId', '=', userId)
        .orderBy('createdAt', 'desc'),
    };
  }

  // ========================================
  // IDENTITY PURCHASE QUERIES
  // ========================================
  
  if (name === 'allPurchases') {
    z.tuple([]).parse(args);
    return {
      query: builder.identityPurchase.orderBy('purchasedAt', 'desc'),
    };
  }
  
  if (name === 'purchasesByUser') {
    z.tuple([z.string()]).parse(args);
    const [userId] = args as [string];
    return {
      query: builder.identityPurchase
        .where('userId', '=', userId)
        .orderBy('purchasedAt', 'desc'),
    };
  }
  
  if (name === 'purchasesByCup') {
    z.tuple([z.string()]).parse(args);
    const [cupId] = args as [string];
    return {
      query: builder.identityPurchase
        .where('cupId', '=', cupId)
        .orderBy('purchasedAt', 'desc'),
    };
  }
  
  if (name === 'purchaseById') {
    z.tuple([z.string()]).parse(args);
    const [purchaseId] = args as [string];
    return {
      query: builder.identityPurchase.where('id', '=', purchaseId),
    };
  }

  // ========================================
  // USER IDENTITIES QUERIES
  // ========================================
  
  if (name === 'identitiesByUser') {
    z.tuple([z.string()]).parse(args);
    const [userId] = args as [string];
    return {
      query: builder.userIdentities.where('userId', '=', userId),
    };
  }
  
  // Removed: identityByUserAndCup and identitiesByCup - all identities are now universal

  // ========================================
  // VOTE QUERIES
  // ========================================
  
  if (name === 'allVotes') {
    z.tuple([]).parse(args);
    return {
      query: builder.vote.orderBy('createdAt', 'desc'),
    };
  }
  
  if (name === 'votesByUser') {
    z.tuple([z.string()]).parse(args);
    const [userId] = args as [string];
    return {
      query: builder.vote
        .where('userId', '=', userId)
        .orderBy('createdAt', 'desc'),
    };
  }
  
  if (name === 'votesByMatch') {
    z.tuple([z.string()]).parse(args);
    const [matchId] = args as [string];
    return {
      query: builder.vote.where('matchId', '=', matchId),
    };
  }

  // ========================================
  // CUP MATCH QUERIES
  // ========================================
  
  if (name === 'allMatches') {
    z.tuple([]).parse(args);
    return {
      query: builder.cupMatch.orderBy('position', 'asc'),
    };
  }
  
  if (name === 'matchesByCup') {
    z.tuple([z.string()]).parse(args);
    const [cupId] = args as [string];
    return {
      query: builder.cupMatch
        .where('cupId', '=', cupId)
        .orderBy('position', 'asc'),
    };
  }

  // ========================================
  // CUP QUERIES
  // ========================================
  
  if (name === 'allCups') {
    z.tuple([]).parse(args);
    return {
      query: builder.cup,
    };
  }
  
  if (name === 'cupById') {
    z.tuple([z.string()]).parse(args);
    const [cupId] = args as [string];
    return {
      query: builder.cup.where('id', '=', cupId),
    };
  }
  
  throw new Error(`No such query: ${name}`);
}

// Handle CORS preflight requests
export const OPTIONS: RequestHandler = async ({ request }) => {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = {};
  
  if (origin && isTrustedOrigin(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, Cookie';
    headers['Access-Control-Max-Age'] = '86400'; // 24 hours
  }
  
  return new Response(null, { status: 204, headers });
};

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Extract auth data from cookies using centralized auth context
    const authData = await extractAuthData(request);

    // Log for debugging
    if (authData) {
      console.log('[get-queries] Authenticated user:', authData.sub, 'isAdmin:', authData.isAdmin);
    } else {
      console.log('[get-queries] Anonymous request');
    }

    // SvelteKit request is compatible with standard Request interface
    // Zero forwards cookies automatically for get-queries requests (no env var needed)
    const result = await handleGetQueriesRequest(getQuery, schema, request);
    
    // Add CORS headers to allow cross-origin requests (handles both www and non-www)
    const origin = request.headers.get('origin');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (origin && isTrustedOrigin(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
      headers['Access-Control-Allow-Credentials'] = 'true';
      headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Content-Type, Cookie';
    }
    
    return json(result, { headers });
  } catch (error) {
    console.error('Error handling get-queries request:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

