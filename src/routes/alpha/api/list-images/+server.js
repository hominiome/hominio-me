import { json } from "@sveltejs/kit";
import { getSession } from "$lib/api-helpers.server.js";
import { listImages, isTigrisConfigured } from "$lib/storage.server.js";
import { dev } from "$app/environment";

/**
 * GET /alpha/api/list-images
 * List images from Tigris bucket
 * Optional query params:
 * - prefix: Filter by prefix (e.g., "images/user123/")
 * - userId: Filter by user ID (will use "images/{userId}/" prefix)
 * - maxKeys: Maximum number of images to return (default: 100)
 */
export async function GET({ request, url }) {
  try {
    // Check if Tigris is configured
    if (!isTigrisConfigured()) {
      const message = dev
        ? "Tigris storage is not configured for local development. See docs/tigris-local-setup.md for setup instructions."
        : "Tigris storage is not configured. Contact administrator.";
      return json({ error: message }, { status: 503 });
    }

    // Authenticate user
    const session = await getSession(request);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Get query parameters
    const prefixParam = url.searchParams.get("prefix");
    const userIdParam = url.searchParams.get("userId");
    const maxKeysParam = url.searchParams.get("maxKeys");

    // Determine prefix
    let prefix = "";
    if (prefixParam) {
      // Use explicit prefix if provided
      prefix = prefixParam;
    } else if (userIdParam) {
      // Use userId prefix if provided
      prefix = `images/${userIdParam}/`;
    } else {
      // Default to current user's images
      prefix = `images/${userId}/`;
    }

    // Parse maxKeys
    const maxKeys = maxKeysParam ? parseInt(maxKeysParam, 10) : 100;
    if (isNaN(maxKeys) || maxKeys < 1 || maxKeys > 1000) {
      return json(
        { error: "maxKeys must be between 1 and 1000" },
        { status: 400 }
      );
    }

    // List images from Tigris
    // We need to list both images/ and thumbnails/ prefixes
    try {
      const imagesPrefix = `images/${userId}/`;
      const thumbnailsPrefix = `thumbnails/${userId}/`;
      
      // Fetch both images and thumbnails in parallel
      const [imagesList, thumbnailsList] = await Promise.all([
        listImages(imagesPrefix, maxKeys),
        listImages(thumbnailsPrefix, maxKeys),
      ]);

      // Combine both lists
      const allImages = [...imagesList, ...thumbnailsList];

      return json({
        success: true,
        images: allImages,
        count: allImages.length,
        prefix: `images/${userId}/ and thumbnails/${userId}/`,
      });
    } catch (error) {
      console.error("Tigris list error:", error);
      return json(
        { error: `Failed to list images: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("List images API error:", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Failed to list images",
        details: error instanceof Error ? error.toString() : String(error),
      },
      { status: 500 }
    );
  }
}

