import { json } from "@sveltejs/kit";
import { getSession } from "$lib/api-helpers.server.js";
import { isAdmin } from "$lib/admin.server.js";
import { zeroDb } from "$lib/db.server.js";

/**
 * @deprecated This API endpoint is deprecated in favor of Zero custom mutators.
 * New code should use `zero.mutate.project.update()` instead.
 * See: src/lib/mutators.ts and src/lib/mutators.server.ts
 * 
 * Migration Status:
 * ✅ /alpha/projects/[projectId]/edit - migrated to custom mutators
 * ✅ /alpha/projects (inline edit modal) - migrated to custom mutators
 * 
 * This endpoint can be removed once all usages are confirmed migrated.
 */
export async function POST({ request }) {
  const { projectId, title, description, country, city, videoUrl, bannerImage, profileImageUrl, sdgs, userId } = await request.json();

  if (!projectId || !title || !description || !country || !city) {
    return json({ error: "Project ID, title, description, country, and city are required" }, { status: 400 });
  }

  try {
    // Get session
    const session = await getSession(request);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the project to check ownership
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

    // Only admins can update projects
    if (!userIsAdmin) {
      return json({ error: "Forbidden: Only admins can update projects" }, { status: 403 });
    }

    // Prepare update data
    const updateData = {
      title: title.trim(),
      description: description.trim(),
      country: country.trim(),
      city: city.trim(),
      videoUrl: (videoUrl || "").trim(),
      bannerImage: (bannerImage || "").trim(),
      profileImageUrl: (profileImageUrl || "").trim(),
      sdgs: sdgs || "",
    };

    // Admins can change the userId (project owner)
    if (userId) {
      updateData.userId = userId;
    }

    // Update project
    await zeroDb
      .updateTable("project")
      .set(updateData)
      .where("id", "=", projectId)
      .execute();

    return json({
      success: true,
      message: "Project updated successfully",
    });
  } catch (error) {
    console.error("Update project error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return json({
      error: "Failed to update project",
      details: errorMessage
    }, { status: 500 });
  }
}

