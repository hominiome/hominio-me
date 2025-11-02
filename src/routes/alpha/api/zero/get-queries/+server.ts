import { json } from '@sveltejs/kit';
import { handleGetQueriesRequest, type ReadonlyJSONValue } from '@rocicorp/zero/server';
import { schema } from '../../../../../zero-schema';
import { builder } from '../../../../../zero-schema';
import { auth } from '$lib/auth.server.js';
import z from 'zod';
import type { RequestHandler } from './$types';

// Server-side query implementations
// We can't import synced-queries.ts here because it uses syncedQuery (client-only)
// Instead, we implement the queries directly using the builder
function getQuery(name: string, args: readonly ReadonlyJSONValue[]) {
  if (name === 'allProjects') {
    // Validate args (same as client-side: z.tuple([]))
    z.tuple([]).parse(args);
    // Return the query (same implementation as client-side)
    return {
      query: builder.project.orderBy('createdAt', 'desc'),
    };
  }
  
  throw new Error(`No such query: ${name}`);
}

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    // Authenticate user using cookies (BetterAuth session)
    // Zero forwards cookies from the client, so we can read them here
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Log for debugging (can remove later)
    if (session?.user) {
      console.log('[get-queries] Authenticated user:', session.user.id);
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

