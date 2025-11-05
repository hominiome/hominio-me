import { json } from "@sveltejs/kit";
import { getSession, requireExplorerIdentity, requireAdmin } from "$lib/api-helpers.server.js";
import { getZeroDbInstance } from "$lib/db.server.js";
import { polarClient } from "$lib/auth.server.js";
import { isAdmin } from "$lib/admin.server.js";

/**
 * Renew subscription directly via Polar API (without checkout round trip)
 * Uses Polar SDK to uncancel a subscription by setting cancel_at_period_end: false
 * 
 * Only admins or the subscription owner can renew
 * 
 * POST /alpha/api/renew-subscription
 * Body: { packageType: "hominio", userId?: string } // userId optional, only for admins
 */
export async function POST({ request }) {
  // Require explorer identity
  await requireExplorerIdentity(request);

  // Get session
  const session = await getSession(request);
  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const isUserAdmin = isAdmin(session.user.id);

  // Get package type and optional userId from request
  const body = await request.json();
  const { packageType, userId: targetUserId } = body;

  if (packageType !== "hominio") {
    return json(
      { error: "Only hominio subscriptions can be renewed via this endpoint" },
      { status: 400 }
    );
  }

  // Determine target user ID
  // Admins can renew for any user, regular users can only renew their own
  const targetUserIdFinal = targetUserId && isUserAdmin ? targetUserId : session.user.id;

  // Authorization check: only admins can renew for other users
  if (targetUserIdFinal !== session.user.id && !isUserAdmin) {
    return json(
      { error: "You can only renew your own subscription" },
      { status: 403 }
    );
  }

  // Check if Polar client is available
  if (!polarClient) {
    return json(
      { error: "Polar integration not configured" },
      { status: 500 }
    );
  }

  try {
    const zeroDb = getZeroDbInstance();

    // Find target user's hominio identity with subscription ID
    const identities = await zeroDb
      .selectFrom("userIdentities")
      .selectAll()
      .where("userId", "=", targetUserIdFinal)
      .where("identityType", "=", "hominio")
      .execute();

    const hominioIdentity = identities[0];

    if (!hominioIdentity) {
      return json(
        { error: "No hominio identity found. Please purchase first." },
        { status: 404 }
      );
    }

    if (!hominioIdentity.subscriptionId) {
      return json(
        { error: "No subscription ID found. Cannot renew without subscription." },
        { status: 400 }
      );
    }

    // Use Polar SDK to uncancel the subscription
    const result = await polarClient.subscriptions.update({
      id: hominioIdentity.subscriptionId,
      subscriptionUpdate: {
        cancelAtPeriodEnd: false,
      },
    });

    // Check for error - Polar SDK returns { ok: boolean, error?: Error, value?: T }
    // If ok is false or error exists, treat as error
    if (result.error || (result.ok === false)) {
      console.error("[Renew Subscription] Polar API error:", result.error || "Unknown error");
      return json(
        { error: "Failed to renew subscription. Please try again or contact support." },
        { status: 500 }
      );
    }

    // Success - the webhook will handle updating the identity
    // But we can also update it optimistically here
    await zeroDb
      .updateTable("userIdentities")
      .set({
        expiresAt: null,
      })
      .where("id", "=", hominioIdentity.id)
      .execute();

    return json({
      success: true,
      message: "Subscription renewed successfully",
    });
  } catch (error) {
    console.error("[Renew Subscription] Error:", error);
    return json(
      { error: error.message || "Failed to renew subscription" },
      { status: 500 }
    );
  }
}

