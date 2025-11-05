import { json } from "@sveltejs/kit";
import { requireAuth } from "$lib/api-helpers.server.js";
import { checkAndCleanupExpiredIdentities } from "$lib/api-helpers.server.js";

/**
 * API endpoint to trigger lazy expiration cleanup for user identities
 * Called from client-side to ensure expired identities are cleaned up
 */
export async function POST({ request }) {
  try {
    const user = await requireAuth(request);
    const { userId } = await request.json().catch(() => ({}));

    // Validate that the user is checking their own identity expiry
    if (userId && userId !== user.id) {
      return json({ error: "Unauthorized" }, { status: 403 });
    }

    // Use authenticated user's ID
    const targetUserId = userId || user.id;

    // Trigger cleanup
    await checkAndCleanupExpiredIdentities(targetUserId);

    return json({
      success: true,
      message: "Identity expiry check completed",
    });
  } catch (error) {
    console.error("Check identity expiry error:", error);
    return json(
      {
        error: "Failed to check identity expiry",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

