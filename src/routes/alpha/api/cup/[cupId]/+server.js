import { json } from "@sveltejs/kit";
import { zeroDb } from "$lib/db.server.js";

export async function GET({ params }) {
  const { cupId } = params;

  if (!cupId) {
    return json({ error: "Cup ID is required" }, { status: 400 });
  }

  try {
    const cup = await zeroDb
      .selectFrom("cup")
      .selectAll()
      .where("id", "=", cupId)
      .executeTakeFirst();

    if (!cup) {
      return json({ error: "Cup not found" }, { status: 404 });
    }

    return json(cup);
  } catch (error) {
    console.error("Failed to fetch cup:", error);
    return json({ error: "Failed to fetch cup" }, { status: 500 });
  }
}

