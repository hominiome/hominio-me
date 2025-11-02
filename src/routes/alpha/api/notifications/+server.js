import { json } from "@sveltejs/kit";
import { getSession } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";

export async function GET({ request }) {
  const session = await getSession(request);

  if (!session?.user?.id) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const notifications = await zeroDb
      .selectFrom("notification")
      .selectAll()
      .where("userId", "=", userId)
      .orderBy("createdAt", "desc")
      .execute();

    return json({ notifications });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}


