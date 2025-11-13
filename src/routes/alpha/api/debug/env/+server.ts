import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { env } from '$env/dynamic/public';

/**
 * Debug endpoint to check if PUBLIC_HUME_CONFIG_ID is available
 * GET /alpha/api/debug/env
 */
export const GET: RequestHandler = async () => {
  const humeConfigId = env.PUBLIC_HUME_CONFIG_ID || '';
  
  return json({
    PUBLIC_HUME_CONFIG_ID: humeConfigId ? '✅ Set' : '❌ Not set',
    value: humeConfigId ? `${humeConfigId.substring(0, 10)}...` : '(empty)',
    length: humeConfigId.length,
    allPublicEnvKeys: Object.keys(env).filter(key => key.includes('HUME') || key.includes('PUBLIC')).sort(),
  });
};

