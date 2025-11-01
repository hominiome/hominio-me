import { json } from "@sveltejs/kit";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";

export async function POST({ request }) {
    // Require admin access (throws 401/403 if not authenticated/admin)
    await requireAdmin(request);

    const { cupId } = await request.json();

    if (!cupId) {
        return json({ error: "Cup ID required" }, { status: 400 });
    }

    const now = new Date().toISOString();

    try {
        // Get cup
        const cup = await zeroDb
            .selectFrom("cup")
            .selectAll()
            .where("id", "=", cupId)
            .executeTakeFirst();

        if (!cup) {
            return json({ error: "Cup not found" }, { status: 404 });
        }

        if (cup.status !== "draft") {
            return json({ error: "Cup already started" }, { status: 400 });
        }

        // Check if cup has matches
        // Retry up to 3 times with delays to account for Zero sync lag
        let matchCount = null;
        let retries = 3;
        let delay = 500; // Start with 500ms delay
        
        while (retries > 0) {
            matchCount = await zeroDb
                .selectFrom("cupMatch")
                .select(zeroDb.fn.count("id").as("count"))
                .where("cupId", "=", cupId)
                .executeTakeFirst();

            const count = matchCount ? Number(matchCount.count) : 0;
            
            if (count > 0) {
                break; // Found matches, exit retry loop
            }
            
            retries--;
            if (retries > 0) {
                // Wait before retrying (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Double the delay for next retry
            }
        }

        const finalCount = matchCount ? Number(matchCount.count) : 0;
        if (finalCount === 0) {
            console.error(`No matches found for cup ${cupId} after retries`);
            return json({ 
                error: "Cup has no matches. Add projects first.",
                details: "Matches may still be syncing. Please wait a moment and try again."
            }, { status: 400 });
        }

        // Update cup status
        await zeroDb
            .updateTable("cup")
            .set({
                status: "active",
                currentRound: "round_16",
                startedAt: now,
            })
            .where("id", "=", cupId)
            .execute();

        return json({
            success: true,
            status: "active",
            currentRound: "round_16",
            startedAt: now,
        });
    } catch (error) {
        console.error("Start cup error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return json({ 
            error: "Failed to start cup",
            details: errorMessage 
        }, { status: 500 });
    }
}

