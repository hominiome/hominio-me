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
    name: "❤︎ I am Hominio",
    price: 1200, // Price in cents: 1200 = 12.00€/year (~14$ incl. taxes + VAT)
    description: "Yearly Membership",
  },
  founder: {
    packageType: "founder",
    name: "Hominio Founder",
    price: 1000, // Price in cents: 1000 = 10.00€
  },
  angel: {
    packageType: "angel",
    name: "Hominio Angel",
    price: 10000, // Price in cents: 10000 = 100.00€
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

  try {
    // Check for all identities (explorer and voting identities can coexist)
    const existingIdentities = await zeroDb
      .selectFrom("userIdentities")
      .selectAll()
      .where("userId", "=", userId)
      .execute();

    // Find specific identity types
    const existingVotingIdentity = existingIdentities.find(id => 
      id.identityType === packageType || 
      (["hominio", "founder", "angel"].includes(id.identityType))
    );

    if (existingVotingIdentity) {
      // User already has a voting identity - check if this is the same one
      if (existingVotingIdentity.identityType === packageType) {
        return json(
          { error: `You already have ${selectedPackage.name}` },
          { status: 400 }
        );
      }

      // Check if this is a valid upgrade path (founder/angel upgrades)
      const currentIdentityType = existingVotingIdentity.identityType;
      const validUpgrades = UPGRADE_PATHS[currentIdentityType] || [];
      if (!validUpgrades.includes(packageType)) {
        return json(
          {
            error: `Cannot downgrade from ${PACKAGES[currentIdentityType].name} to ${selectedPackage.name}. Valid upgrades: ${validUpgrades.map((p) => PACKAGES[p].name).join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Update existing identity (upgrade from hominio to founder/angel)
      const updateQuery = zeroDb
        .updateTable("userIdentities")
        .set({
          identityType: selectedPackage.packageType,
          upgradedFrom: currentIdentityType,
          selectedAt: now, // Update selection time on upgrade
          expiresAt: null, // Clear expiration on upgrade (new purchase)
        })
        .where("userId", "=", userId)
        .where("id", "=", existingVotingIdentity.id);

      await updateQuery.execute();

      // Create purchase record for upgrade
      const purchaseId = nanoid();
      await zeroDb
        .insertInto("identityPurchase")
        .values({
          id: purchaseId,
          userId,
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
          identityType: selectedPackage.packageType,
          selectedAt: now,
          upgradedFrom: null,
          expiresAt: null, // No expiration for direct purchases
        })
        .execute();

      // Create purchase record
      const purchaseId = nanoid();
      await zeroDb
        .insertInto("identityPurchase")
        .values({
          id: purchaseId,
          userId,
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
