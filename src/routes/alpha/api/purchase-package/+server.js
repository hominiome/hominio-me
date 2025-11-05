import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import {
  getSession,
  requireExplorerIdentity,
} from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";
import { getNotificationConfig } from "$lib/notification-helpers.server.js";

// Package definitions - All identities are now universal (cupId = null)
const PACKAGES = {
  hominio: {
    packageType: "hominio",
    votingWeight: 1,
    name: "❤︎ I am Hominio",
    price: 1200, // Price in cents: 1200 = 12.00€/year (~14$ incl. taxes + VAT)
    description: "Yearly Membership - Unlimited voting access to all cups",
  },
  founder: {
    packageType: "founder",
    votingWeight: 5,
    name: "Hominio Founder",
    price: 1000, // Price in cents: 1000 = 10.00€
  },
  angel: {
    packageType: "angel",
    votingWeight: 10,
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

  // All identities are now universal (cupId = null)
  // Ignore cupId from request if provided
  const identityCupId = null;

  try {
    // Check if user already has a universal identity (all identities are universal now)
    const existingIdentity = await zeroDb
      .selectFrom("userIdentities")
      .selectAll()
      .where("userId", "=", userId)
      .where("cupId", "is", null)
      .executeTakeFirst();

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
          cupId: null, // All identities are universal
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
          cupName: "All Cups", // All identities are universal now
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
          cupId: null, // All identities are universal
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
          cupId: null, // All identities are universal
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
          cupId: null, // All identities are universal
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
          cupName: "All Cups", // All identities are universal now
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
          cupId: null, // All identities are universal
        },
        message: `Successfully purchased ${selectedPackage.name}`,
      });
    }
  } catch (error) {
    console.error("Purchase package error:", error);
    return json({ error: "Purchase failed" }, { status: 500 });
  }
}
