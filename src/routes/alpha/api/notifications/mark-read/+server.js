import { json } from "@sveltejs/kit";
import { getSession } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";

export async function POST({ request }) {
  const session = await getSession(request);

  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { notificationId } = await request.json();

  if (!notificationId) {
    return json({ error: "notificationId is required" }, { status: 400 });
  }

  try {
    // Verify the notification belongs to the user
    const notification = await zeroDb
      .selectFrom("notification")
      .selectAll()
      .where("id", "=", notificationId)
      .where("userId", "=", userId)
      .executeTakeFirst();

    if (!notification) {
      return json({ error: "Notification not found" }, { status: 404 });
    }

    // Mark as read
    await zeroDb
      .updateTable("notification")
      .set({ read: "true" })
      .where("id", "=", notificationId)
      .where("userId", "=", userId)
      .execute();

    return json({ success: true });
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return json({ error: "Failed to mark notification as read" }, { status: 500 });
  }
}


