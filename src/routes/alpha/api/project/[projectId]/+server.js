import { json } from "@sveltejs/kit";
import { zeroDb } from "$lib/db.server.js";

export async function GET({ params }) {
  const { projectId } = params;

  if (!projectId) {
    return json({ error: "Project ID is required" }, { status: 400 });
  }

  try {
    // Get project details
    const project = await zeroDb
      .selectFrom("project")
      .selectAll()
      .where("id", "=", projectId)
      .executeTakeFirst();

    if (!project) {
      return json({ error: "Project not found" }, { status: 404 });
    }

    return json(project);
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return json({ error: "Failed to fetch project" }, { status: 500 });
  }
}

