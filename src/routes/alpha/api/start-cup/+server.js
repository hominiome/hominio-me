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
        const matchCount = await zeroDb
            .selectFrom("cupMatch")
            .select(zeroDb.fn.count("id").as("count"))
            .where("cupId", "=", cupId)
            .executeTakeFirst();

        if (!matchCount || Number(matchCount.count) === 0) {
            return json({ error: "Cup has no matches. Add projects first." }, { status: 400 });
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
        return json({ error: "Failed to start cup" }, { status: 500 });
    }
}

