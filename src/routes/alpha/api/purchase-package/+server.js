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
    price: 1, // Placeholder - adjust as needed
  },
  founder: {
    packageType: "founder",
    votingWeight: 5,
    name: "Founder",
    price: 5, // Placeholder - adjust as needed
  },
  angel: {
    packageType: "angel",
    votingWeight: 10,
    name: "Angel",
    price: 10, // Placeholder - adjust as needed
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
      { error: "Invalid package type. Must be 'hominio', 'founder', or 'angel'" },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const now = new Date().toISOString();
  const selectedPackage = PACKAGES[packageType];

  try {
    // Check if user already has a package
    const existingPackage = await zeroDb
      .selectFrom("userVotingPackage")
      .selectAll()
      .where("userId", "=", userId)
      .executeTakeFirst();

    if (existingPackage) {
      // User already has a package - check if this is a valid upgrade
      const currentPackageType = existingPackage.packageType;

      // Cannot purchase the same package
      if (currentPackageType === packageType) {
        return json(
          { error: `You already have the ${selectedPackage.name} package` },
          { status: 400 }
        );
      }

      // Check if this is a valid upgrade path
      const validUpgrades = UPGRADE_PATHS[currentPackageType] || [];
      if (!validUpgrades.includes(packageType)) {
        return json(
          {
            error: `Cannot downgrade from ${PACKAGES[currentPackageType].name} to ${selectedPackage.name}. Valid upgrades: ${validUpgrades.map((p) => PACKAGES[p].name).join(", ")}`,
          },
          { status: 400 }
        );
      }

      // Update existing package (upgrade)
      await zeroDb
        .updateTable("userVotingPackage")
        .set({
          packageType: selectedPackage.packageType,
          votingWeight: selectedPackage.votingWeight,
          upgradedFrom: currentPackageType,
          purchasedAt: now, // Update purchase time on upgrade
        })
        .where("userId", "=", userId)
        .execute();

      // Create purchase transaction for audit trail
      await zeroDb
        .insertInto("transaction")
        .values({
          id: nanoid(),
          fromWalletId: null, // System purchase
          toWalletId: null, // No wallet needed for voting packages
          amount: selectedPackage.votingWeight,
          type: "purchase",
          metadata: JSON.stringify({
            packageType: selectedPackage.packageType,
            votingWeight: selectedPackage.votingWeight,
            upgradedFrom: currentPackageType,
            timestamp: Date.now(),
          }),
          createdAt: now,
        })
        .execute();

      return json({
        success: true,
        package: {
          packageType: selectedPackage.packageType,
          votingWeight: selectedPackage.votingWeight,
          name: selectedPackage.name,
          upgradedFrom: currentPackageType,
        },
        message: `Successfully upgraded to ${selectedPackage.name} package`,
      });
    } else {
      // No existing package - create new one
      const packageId = nanoid();

      await zeroDb
        .insertInto("userVotingPackage")
        .values({
          id: packageId,
          userId,
          packageType: selectedPackage.packageType,
          votingWeight: selectedPackage.votingWeight,
          purchasedAt: now,
          upgradedFrom: null,
        })
        .execute();

      // Create purchase transaction for audit trail
      await zeroDb
        .insertInto("transaction")
        .values({
          id: nanoid(),
          fromWalletId: null, // System purchase
          toWalletId: null, // No wallet needed for voting packages
          amount: selectedPackage.votingWeight,
          type: "purchase",
          metadata: JSON.stringify({
            packageType: selectedPackage.packageType,
            votingWeight: selectedPackage.votingWeight,
            timestamp: Date.now(),
          }),
          createdAt: now,
        })
        .execute();

      return json({
        success: true,
        package: {
          packageType: selectedPackage.packageType,
          votingWeight: selectedPackage.votingWeight,
          name: selectedPackage.name,
        },
        message: `Successfully purchased ${selectedPackage.name} package`,
      });
    }
  } catch (error) {
    console.error("Purchase package error:", error);
    return json({ error: "Purchase failed" }, { status: 500 });
  }
}

