import { json } from '@sveltejs/kit';
import { handleGetQueriesRequest, type ReadonlyJSONValue } from '@rocicorp/zero/server';
import { schema } from '../../../../../zero-schema';
import { builder } from '../../../../../zero-schema';
import { extractAuthData } from '$lib/server/auth-context';
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
  
  throw new Error(`No such query: ${name}`);
}

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
    // Zero will forward cookies automatically if ZERO_GET_QUERIES_FORWARD_COOKIES=true
    const result = await handleGetQueriesRequest(getQuery, schema, request);
    return json(result);
  } catch (error) {
    console.error('Error handling get-queries request:', error);
    return json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

