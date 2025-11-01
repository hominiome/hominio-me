import { json } from "@sveltejs/kit";
import { getZeroStatus } from "$lib/zero-manager.server.js";
import type { RequestHandler } from "./$types";

/**
 * Health check endpoint
 * Returns the status of the application and Zero sync service
 */
export const GET: RequestHandler = async () => {
  const zeroStatus = getZeroStatus();

  // Try to connect to Zero to verify it's actually responsive
  let zeroResponsive = false;
  let zeroResponseTime = 0;
  try {
    const startTime = Date.now();
    const response = await fetch("http://localhost:4848/", {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    zeroResponseTime = Date.now() - startTime;
    zeroResponsive = response.ok || response.status === 404; // Zero might return 404 on root
  } catch (error) {
    // Connection failed
    zeroResponsive = false;
  }

  const healthy = zeroStatus.running && zeroResponsive;

  return json(
    {
      status: healthy ? "healthy" : "unhealthy",
      services: {
        sveltekit: "running",
        zero: {
          process: zeroStatus.running ? "running" : "stopped",
          responsive: zeroResponsive,
          responseTime: zeroResponseTime,
          restartAttempts: zeroStatus.restartAttempts,
          lastError: zeroStatus.lastError,
        },
      },
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
    }
  );
};

