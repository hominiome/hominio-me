import { json } from "@sveltejs/kit";
import { getSession, requireExplorerIdentity } from "$lib/api-helpers.server.js";
import { isAdmin } from "$lib/admin.server";
import { zeroDb } from "$lib/db.server.js";
import { uploadImage, getImageUrl, isTigrisConfigured } from "$lib/storage.server.js";
import sharp from "sharp";
import { nanoid } from "nanoid";
import { dev } from "$app/environment";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];

/**
 * Validate file type and size
 */
function validateFile(file) {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit` };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}` };
  }

  // Check file extension
  const fileName = file.name.toLowerCase();
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => fileName.endsWith(ext));
  if (!hasValidExtension) {
    return { valid: false, error: `Invalid file extension. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}` };
  }

  return { valid: true };
}

/**
 * Check if user has founder identity
 */
async function hasFounderIdentity(userId) {
  try {
    const identities = await zeroDb
      .selectFrom("userIdentities")
      .selectAll()
      .where("userId", "=", userId)
      .where("identityType", "=", "founder")
      .execute();
    
    return identities.length > 0;
  } catch (error) {
    console.error("Error checking founder identity:", error);
    return false;
  }
}

/**
 * Generate storage key for image
 */
function generateImageKey(userId, originalFilename) {
  const timestamp = Date.now();
  const randomId = nanoid(8);
  const sanitizedFilename = originalFilename
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .toLowerCase();
  const baseName = sanitizedFilename.replace(/\.[^/.]+$/, ""); // Remove extension
  
  // Append user ID as suffix: basename-userid.webp
  return {
    original: `images/${userId}/${timestamp}-${randomId}-${baseName}-${userId}.webp`,
    thumbnail: `thumbnails/${userId}/${timestamp}-${randomId}-${baseName}-${userId}.webp`,
  };
}

/**
 * POST /alpha/api/upload-image
 * Upload and process an image to Tigris
 */
export async function POST({ request }) {
  try {
    // Check if Tigris is configured
    if (!isTigrisConfigured()) {
      const message = dev
        ? "Tigris storage is not configured for local development. See docs/tigris-local-setup.md for setup instructions."
        : "Tigris storage is not configured. Contact administrator.";
      return json({ error: message }, { status: 503 });
    }

    // Require explorer identity
    await requireExplorerIdentity(request);
    
    // Authenticate user
    const session = await getSession(request);
    if (!session?.user?.id) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Check if user is admin or has founder identity
    const userIsAdmin = isAdmin(userId);
    const userHasFounderIdentity = await hasFounderIdentity(userId);

    if (!userIsAdmin && !userHasFounderIdentity) {
      return json(
        { error: "Forbidden: Only admins and users with founder identity can upload images" },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("image");

    if (!file || !(file instanceof File)) {
      return json({ error: "No image file provided" }, { status: 400 });
    }

    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return json({ error: validation.error }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Check if it's an SVG file
    const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

    // Process image with Sharp (or handle SVG separately)
    let processedBuffer;
    let thumbnailBuffer;
    let contentType = "image/webp";

    try {
      if (isSvg) {
        // For SVG files, we'll convert them to PNG/WebP for consistency
        // Sharp can rasterize SVG files
        const sharpInstance = sharp(buffer);
        
        // Get SVG dimensions (or use defaults)
        const metadata = await sharpInstance.metadata();
        const width = metadata.width || 2000;
        const height = metadata.height || 2000;

        // Process original: resize if needed, convert to WebP
        if (width > 2000 || height > 2000) {
          processedBuffer = await sharpInstance
            .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
        } else {
          processedBuffer = await sharpInstance
            .webp({ quality: 85 })
            .toBuffer();
        }

        // Generate thumbnail
        thumbnailBuffer = await sharp(buffer)
          .resize(400, 400, { fit: "cover" })
          .webp({ quality: 80 })
          .toBuffer();
      } else {
        // Regular raster image processing
        const metadata = await sharp(buffer).metadata();
        const { width, height } = metadata;

        // Process original image (resize if needed, convert to WebP)
        const sharpInstance = sharp(buffer);
        
        if (width > 2000 || height > 2000) {
          // Resize to max 2000x2000px maintaining aspect ratio
          processedBuffer = await sharpInstance
            .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
            .webp({ quality: 85 })
            .toBuffer();
        } else {
          // Just convert to WebP
          processedBuffer = await sharpInstance
            .webp({ quality: 85 })
            .toBuffer();
        }

        // Generate thumbnail (400x400px, cover fit)
        thumbnailBuffer = await sharp(buffer)
          .resize(400, 400, { fit: "cover" })
          .webp({ quality: 80 })
          .toBuffer();
      }
    } catch (error) {
      console.error("Image processing error:", error);
      return json(
        { error: `Failed to process image: ${error.message}` },
        { status: 500 }
      );
    }

    // Generate storage keys
    const keys = generateImageKey(userId, file.name);

    // Upload both original and thumbnail to Tigris
    try {
      const [originalResult, thumbnailResult] = await Promise.all([
        uploadImage(processedBuffer, keys.original, {
          ContentType: contentType,
          CacheControl: "public, max-age=31536000",
        }),
        uploadImage(thumbnailBuffer, keys.thumbnail, {
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000",
        }),
      ]);

      // Get public URLs (assuming public bucket)
      const [originalUrl, thumbnailUrl] = await Promise.all([
        getImageUrl(keys.original, true),
        getImageUrl(keys.thumbnail, true),
      ]);

      return json({
        success: true,
        image: {
          original: {
            key: keys.original,
            url: originalUrl,
            size: processedBuffer.length,
          },
          thumbnail: {
            key: keys.thumbnail,
            url: thumbnailUrl,
            size: thumbnailBuffer.length,
          },
        },
      });
    } catch (error) {
      console.error("Tigris upload error:", error);
      return json(
        { error: `Failed to upload image: ${error.message}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Upload API error:", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Failed to upload image",
        details: error instanceof Error ? error.toString() : String(error),
      },
      { status: 500 }
    );
  }
}

