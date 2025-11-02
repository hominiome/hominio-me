import { json } from "@sveltejs/kit";
import { zeroDb } from "$lib/db.server.js";
import { calculatePrizePool } from "$lib/prizePoolUtils.js";

export async function GET({ params }) {
  const { purchaseId } = params;
  
  if (!purchaseId) {
    return json({ error: "Purchase ID required" }, { status: 400 });
  }

  try {
    
    // Get the purchase record
    const purchase = await zeroDb
      .selectFrom("identityPurchase")
      .selectAll()
      .where("id", "=", purchaseId)
      .executeTakeFirst();

    if (!purchase) {
      return json({ error: "Purchase not found" }, { status: 404 });
    }

    // Get all purchases for this cup to calculate current pool
    const allPurchases = await zeroDb
      .selectFrom("identityPurchase")
      .selectAll()
      .where("cupId", "=", purchase.cupId)
      .execute();

    // Calculate current pool (including this purchase)
    const currentPool = calculatePrizePool(allPurchases);
    
    // Amount added is the price of this purchase
    const amountAdded = purchase.price || 0;

    return json({
      currentPool,
      amountAdded,
    });
  } catch (error) {
    console.error("Error fetching purchase data:", error);
    return json({ error: "Failed to fetch purchase data" }, { status: 500 });
  }
}

