import { json } from "@sveltejs/kit";
import { getSession } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";

export async function POST({ request }) {
  const session = await getSession(request);

  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    // Mark all non-priority notifications as read for this user
    await zeroDb
      .updateTable("notification")
      .set({ read: "true" })
      .where("userId", "=", userId)
      .where("read", "=", "false")
      .where("priority", "!=", "true")
      .execute();

    return json({ success: true });
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    return json({ error: "Failed to mark all notifications as read" }, { status: 500 });
  }
}

