import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import { getSession } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";

// Package definitions
const PACKAGES = {
  hominio: {
    packageType: "hominio",
    votingWeight: 1,
    name: "I am Hominio",
    price: 100, // Price in cents: 100 = 1.00€
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
  // Get session
  const session = await getSession(request);

  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const { packageType, cupId } = await request.json();

  if (!packageType || !PACKAGES[packageType]) {
    return json(
      { error: "Invalid identity type. Must be 'hominio', 'founder', or 'angel'" },
      { status: 400 }
    );
  }

  if (!cupId) {
    return json(
      { error: "cupId is required" },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const now = new Date().toISOString();
  const selectedPackage = PACKAGES[packageType];

  try {
    // Validate cup exists
    const cup = await zeroDb
      .selectFrom("cup")
      .selectAll()
      .where("id", "=", cupId)
      .executeTakeFirst();

    if (!cup) {
      return json(
        { error: "Cup not found" },
        { status: 404 }
      );
    }

    // Check if user already has an identity for this cup
    const existingIdentity = await zeroDb
      .selectFrom("userIdentities")
      .selectAll()
      .where("userId", "=", userId)
      .where("cupId", "=", cupId)
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
      await zeroDb
        .updateTable("userIdentities")
        .set({
          identityType: selectedPackage.packageType,
          votingWeight: selectedPackage.votingWeight,
          upgradedFrom: currentIdentityType,
          selectedAt: now, // Update selection time on upgrade
        })
        .where("userId", "=", userId)
        .where("cupId", "=", cupId)
        .execute();

      // Create purchase record for upgrade
      const purchaseId = nanoid();
      await zeroDb
        .insertInto("identityPurchase")
        .values({
          id: purchaseId,
          userId,
          cupId,
          identityType: selectedPackage.packageType,
          price: selectedPackage.price,
          purchasedAt: now,
          userIdentityId: existingIdentity.id,
        })
        .execute();

      // Create notification for identity purchase
      const notificationId = nanoid();
      const isHominio = selectedPackage.name === "I am Hominio";
      const isFounder = selectedPackage.packageType === "founder";
      const identityName = isHominio ? "Hominio" : selectedPackage.name.replace("Hominio ", "");
      const title = isHominio ? "You are now Hominio" : `You are now an ${identityName}`;
      
      // Founder notifications get different action and message
      let actions, message;
      if (isFounder) {
        actions = JSON.stringify([
          { label: "Create Project", url: "/alpha/projects?create=true" }
        ]);
        message = `Welcome to the founder circle! You can now create and submit your project to compete in the "${cup.name}" competition.`;
      } else {
        actions = JSON.stringify([
          { label: "Open Matches", url: "/alpha" }
        ]);
        message = `May the wisdom be with you. You can now vote in the "${cup.name}" competition matches.`;
      }
      
      await zeroDb
        .insertInto("notification")
        .values({
          id: notificationId,
          userId,
          resourceType: "identityPurchase",
          resourceId: purchaseId,
          title: title,
          message: message,
          read: "false",
          createdAt: now,
          actions: actions,
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
      // No existing identity for this cup - create new one
      const identityId = nanoid();

      await zeroDb
        .insertInto("userIdentities")
        .values({
          id: identityId,
          userId,
          cupId,
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
          cupId,
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
      const identityName = isHominio ? "Hominio" : selectedPackage.name.replace("Hominio ", "");
      const title = isHominio ? "You are now Hominio" : `You are now an ${identityName}`;
      
      // Founder notifications get different action and message
      let actions, message;
      if (isFounder) {
        actions = JSON.stringify([
          { label: "Create Project", url: "/alpha/projects?create=true" }
        ]);
        message = `Welcome to the founder circle! You can now create and submit your project to compete in the "${cup.name}" competition.`;
      } else {
        actions = JSON.stringify([
          { label: "Open Matches", url: "/alpha" }
        ]);
        message = `May the wisdom be with you. You can now vote in the "${cup.name}" competition matches.`;
      }
      
      await zeroDb
        .insertInto("notification")
        .values({
          id: notificationId,
          userId,
          resourceType: "identityPurchase",
          resourceId: purchaseId,
          title: title,
          message: message,
          read: "false",
          createdAt: now,
          actions: actions,
          sound: "/purchase-effect.mp3",
          icon: "mdi:account-check", // Iconify icon name
          displayComponent: "PrizePoolDisplay", // Display component for all identity purchases
        })
        .execute();

      return json({
        success: true,
        identity: {
          identityType: selectedPackage.packageType,
          votingWeight: selectedPackage.votingWeight,
          name: selectedPackage.name,
        },
        message: `Successfully selected ${selectedPackage.name}`,
      });
    }
  } catch (error) {
    console.error("Purchase package error:", error);
    return json({ error: "Purchase failed" }, { status: 500 });
  }
}

