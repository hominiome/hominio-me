import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import {
  getSession,
  requireExplorerIdentity,
} from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";
import { getNotificationConfig } from "$lib/notification-helpers.server.js";

// Package definitions
const PACKAGES = {
  hominio: {
    packageType: "hominio",
    votingWeight: 1,
    name: "❤︎ I am Hominio",
    price: 1200, // Price in cents: 1200 = 12.00€/year (~14$ incl. taxes + VAT)
    isUniversal: true, // Universal identity - applies to all cups (cupId = null)
    description: "Yearly Membership - Unlimited voting access to all cups",
  },
  founder: {
    packageType: "founder",
    votingWeight: 5,
    name: "Hominio Founder",
    price: 1000, // Price in cents: 1000 = 10.00€
    isUniversal: false, // Cup-specific identity
  },
  angel: {
    packageType: "angel",
    votingWeight: 10,
    name: "Hominio Angel",
    price: 10000, // Price in cents: 10000 = 100.00€
    isUniversal: false, // Cup-specific identity
  },
};

// Valid upgrade paths (from -> to)
const UPGRADE_PATHS = {
  hominio: ["founder", "angel"],
  founder: ["angel"],
  angel: [], // Cannot upgrade from angel
};

export async function POST({ request }) {
  // Require explorer identity
  await requireExplorerIdentity(request);

  // Get session
  const session = await getSession(request);

  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const { packageType, cupId } = await request.json();

  if (!packageType || !PACKAGES[packageType]) {
    return json(
      {
        error:
          "Invalid identity type. Must be 'hominio', 'founder', or 'angel'",
      },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const now = new Date().toISOString();
  const selectedPackage = PACKAGES[packageType];
  const isUniversal = selectedPackage.isUniversal === true;

  // For universal identities (hominio), cupId is not required
  // For cup-specific identities (founder, angel), cupId is required
  if (!isUniversal && !cupId) {
    return json(
      { error: "cupId is required for cup-specific identities" },
      { status: 400 }
    );
  }

  try {
    let updatedCup = null;

    // For cup-specific identities, validate cup exists
    if (!isUniversal) {
      const cup = await zeroDb
        .selectFrom("cup")
        .selectAll()
        .where("id", "=", cupId)
        .executeTakeFirst();

      if (!cup) {
        return json({ error: "Cup not found" }, { status: 404 });
      }

      // Check if cup has expired and close it if needed
      const { checkAndCloseExpiredCups } = await import(
        "$lib/expiry-checker.server.js"
      );
      await checkAndCloseExpiredCups([cup]);

      // Re-fetch cup in case it was just closed
      updatedCup = await zeroDb
        .selectFrom("cup")
        .selectAll()
        .where("id", "=", cupId)
        .executeTakeFirst();
    }

    // Check if user already has an identity
    // For universal: check for universal identity (cupId IS NULL)
    // For cup-specific: check for cup-specific identity OR universal identity
    let existingIdentity = null;

    if (isUniversal) {
      // Check for existing universal identity
      existingIdentity = await zeroDb
        .selectFrom("userIdentities")
        .selectAll()
        .where("userId", "=", userId)
        .where("cupId", "is", null)
        .where("identityType", "=", "hominio")
        .executeTakeFirst();
    } else {
      // Check for cup-specific identity first
      existingIdentity = await zeroDb
        .selectFrom("userIdentities")
        .selectAll()
        .where("userId", "=", userId)
        .where("cupId", "=", cupId)
        .executeTakeFirst();

      // If no cup-specific identity, check for universal identity
      if (!existingIdentity) {
        const universalIdentity = await zeroDb
          .selectFrom("userIdentities")
          .selectAll()
          .where("userId", "=", userId)
          .where("cupId", "is", null)
          .where("identityType", "=", "hominio")
          .executeTakeFirst();

        // Universal identity grants access to all cups, so user can vote
        // But they can still purchase cup-specific upgrade if they want
        // For now, allow purchasing cup-specific even if they have universal
      }
    }

    if (existingIdentity) {
      // User already has an identity - check if this is a valid upgrade
      const currentIdentityType = existingIdentity.identityType;

      // Cannot select the same identity
      if (currentIdentityType === packageType) {
        return json(
          { error: `You already have ${selectedPackage.name}` },
          { status: 400 }
        );
      }

      // Check if this is a valid upgrade path
      const validUpgrades = UPGRADE_PATHS[currentIdentityType] || [];
      if (!validUpgrades.includes(packageType)) {
        return json(
          {
            error: `Cannot downgrade from ${PACKAGES[currentIdentityType].name} to ${selectedPackage.name}. Valid upgrades: ${validUpgrades.map((p) => PACKAGES[p].name).join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Update existing identity (upgrade)
      // Handle both universal (cupId IS NULL) and cup-specific identities
      const updateQuery = zeroDb
        .updateTable("userIdentities")
        .set({
          identityType: selectedPackage.packageType,
          votingWeight: selectedPackage.votingWeight,
          upgradedFrom: currentIdentityType,
          selectedAt: now, // Update selection time on upgrade
        })
        .where("userId", "=", userId)
        .where("id", "=", existingIdentity.id);

      await updateQuery.execute();

      // Create purchase record for upgrade
      const purchaseId = nanoid();
      await zeroDb
        .insertInto("identityPurchase")
        .values({
          id: purchaseId,
          userId,
          cupId: isUniversal ? null : cupId, // Null for universal identities
          identityType: selectedPackage.packageType,
          price: selectedPackage.price,
          purchasedAt: now,
          userIdentityId: existingIdentity.id,
        })
        .execute();

      // Create notification for identity purchase
      const notificationId = nanoid();
      const isHominio = selectedPackage.name.includes("I am Hominio");
      const isFounder = selectedPackage.packageType === "founder";
      const identityName = isHominio
        ? "Hominio"
        : selectedPackage.name.replace("Hominio ", "");

      // Get notification config based on identity type
      const notificationSubtype = isHominio
        ? "hominio"
        : isFounder
          ? "founder"
          : "other";
      const notificationConfig = getNotificationConfig(
        "identityPurchase",
        notificationSubtype,
        {
          identityName,
          cupName: updatedCup?.name || (isUniversal ? "All Cups" : ""),
        }
      );

      await zeroDb
        .insertInto("notification")
        .values({
          id: notificationId,
          userId,
          resourceType: "identityPurchase",
          resourceId: purchaseId,
          title: notificationConfig.title,
          previewTitle: notificationConfig.previewTitle || null,
          message: notificationConfig.message,
          read: "false",
          createdAt: now,
          actions: JSON.stringify(notificationConfig.actions),
          sound: notificationConfig.sound || null,
          icon: notificationConfig.icon || null,
          displayComponent: notificationConfig.displayComponent || null,
          priority: notificationConfig.priority ? "true" : "false",
        })
        .execute();

      return json({
        success: true,
        identity: {
          identityType: selectedPackage.packageType,
          votingWeight: selectedPackage.votingWeight,
          name: selectedPackage.name,
          upgradedFrom: currentIdentityType,
        },
        message: `Successfully upgraded to ${selectedPackage.name}`,
      });
    } else {
      // No existing identity - create new one
      const identityId = nanoid();

      await zeroDb
        .insertInto("userIdentities")
        .values({
          id: identityId,
          userId,
          cupId: isUniversal ? null : cupId, // Null for universal identities
          identityType: selectedPackage.packageType,
          votingWeight: selectedPackage.votingWeight,
          selectedAt: now,
          upgradedFrom: null,
        })
        .execute();

      // Create purchase record
      const purchaseId = nanoid();
      await zeroDb
        .insertInto("identityPurchase")
        .values({
          id: purchaseId,
          userId,
          cupId: isUniversal ? null : cupId, // Null for universal identities
          identityType: selectedPackage.packageType,
          price: selectedPackage.price,
          purchasedAt: now,
          userIdentityId: identityId,
        })
        .execute();

      // Create notification for identity purchase
      const notificationId = nanoid();
      const isHominio = selectedPackage.name === "I am Hominio";
      const isFounder = selectedPackage.packageType === "founder";
      const identityName = isHominio
        ? "Hominio"
        : selectedPackage.name.replace("Hominio ", "");

      // Get notification config based on identity type
      const notificationSubtype = isHominio
        ? "hominio"
        : isFounder
          ? "founder"
          : "other";
      const notificationConfig = getNotificationConfig(
        "identityPurchase",
        notificationSubtype,
        {
          identityName,
          cupName: updatedCup.name,
        }
      );

      await zeroDb
        .insertInto("notification")
        .values({
          id: notificationId,
          userId,
          resourceType: "identityPurchase",
          resourceId: purchaseId,
          title: notificationConfig.title,
          previewTitle: notificationConfig.previewTitle || null,
          message: notificationConfig.message,
          read: "false",
          createdAt: now,
          actions: JSON.stringify(notificationConfig.actions),
          sound: notificationConfig.sound || null,
          icon: notificationConfig.icon || null,
          displayComponent: notificationConfig.displayComponent || null,
          priority: notificationConfig.priority ? "true" : "false",
        })
        .execute();

      return json({
        success: true,
        identity: {
          identityType: selectedPackage.packageType,
          votingWeight: selectedPackage.votingWeight,
          name: selectedPackage.name,
        },
        message: `Successfully purchased ${selectedPackage.name}`,
      });
    }
  } catch (error) {
    console.error("Purchase package error:", error);
    return json({ error: "Purchase failed" }, { status: 500 });
  }
}
