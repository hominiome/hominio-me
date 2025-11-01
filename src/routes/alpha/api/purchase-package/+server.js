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
    price: 1,
  },
  founder: {
    packageType: "founder",
    votingWeight: 5,
    name: "Hominio Founder",
    price: 10,
  },
  angel: {
    packageType: "angel",
    votingWeight: 10,
    name: "Hominio Angel",
    price: 100,
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

  const { packageType } = await request.json();

  if (!packageType || !PACKAGES[packageType]) {
    return json(
      { error: "Invalid identity type. Must be 'hominio', 'founder', or 'angel'" },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const now = new Date().toISOString();
  const selectedPackage = PACKAGES[packageType];

  try {
    // Check if user already has an identity
    const existingIdentity = await zeroDb
      .selectFrom("userIdentities")
      .selectAll()
      .where("userId", "=", userId)
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
          identityType: selectedPackage.packageType,
          votingWeight: selectedPackage.votingWeight,
          selectedAt: now,
          upgradedFrom: null,
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

