import { json } from "@sveltejs/kit";
import { getSession, requireExplorerIdentity } from "$lib/api-helpers.server.js";
import { isAdmin } from "$lib/admin.server.js";
import { zeroDb } from "$lib/db.server.js";

export async function POST({ request }) {
  // Require explorer identity
  await requireExplorerIdentity(request);
  
  const { projectId } = await request.json();

  if (!projectId) {
    return json({ error: "Project ID is required" }, { status: 400 });
  }

  try {
    // Get session
    const session = await getSession(request);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the project to verify it exists
    const project = await zeroDb
      .selectFrom("project")
      .selectAll()
      .where("id", "=", projectId)
      .executeTakeFirst();

    if (!project) {
      return json({ error: "Project not found" }, { status: 404 });
    }

    // Check if user is admin
    const userIsAdmin = isAdmin(session.user.id);

    // Only admins can delete projects
    if (!userIsAdmin) {
      return json(
        { error: "Forbidden: Only admins can delete projects" },
        { status: 403 }
      );
    }

    // Delete project
    await zeroDb.deleteFrom("project").where("id", "=", projectId).execute();

    return json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error) {
    console.error("Delete project error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);

    return json(
      {
        error: "Failed to delete project",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
