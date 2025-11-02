import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "$env/dynamic/private";
import { dev } from "$app/environment";

let s3ClientInstance = null;
let isConfigured = false;

/**
 * Check if Tigris is configured (secrets available)
 */
export function isTigrisConfigured() {
  return !!(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.BUCKET_NAME);
}

/**
 * Get or create S3Client for Tigris
 * Uses environment variables set by `fly storage create`:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_ENDPOINT_URL_S3
 * - AWS_REGION
 * - BUCKET_NAME
 * 
 * In local development, these may not be available unless set in .env file
 */
function getS3Client() {
  if (!isTigrisConfigured()) {
    if (dev) {
      throw new Error(
        "Tigris storage is not configured for local development.\n\n" +
        "To enable Tigris locally, create a .env file with:\n" +
        "AWS_ACCESS_KEY_ID=your_key\n" +
        "AWS_SECRET_ACCESS_KEY=your_secret\n" +
        "AWS_ENDPOINT_URL_S3=https://fly.storage.tigris.dev\n" +
        "AWS_REGION=auto\n" +
        "BUCKET_NAME=hominio-profile-images\n\n" +
        "Get secrets via: fly ssh console -a hominio-me (then run: env | grep -E '(AWS_|BUCKET_)')\n" +
        "See docs/tigris-local-setup.md for full instructions."
      );
    }
    throw new Error("Tigris storage is not configured. Run 'fly storage create' first.");
  }

  if (!s3ClientInstance) {
    const endpoint = env.AWS_ENDPOINT_URL_S3 || "https://fly.storage.tigris.dev";
    const region = env.AWS_REGION || "auto";
    const accessKeyId = env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = env.AWS_SECRET_ACCESS_KEY;

    s3ClientInstance = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: false, // Use virtual hosting style
    });
    isConfigured = true;
  }
  return s3ClientInstance;
}

/**
 * Get bucket name from environment variable
 */
function getBucketName() {
  const bucketName = env.BUCKET_NAME;
  if (!bucketName) {
    throw new Error("BUCKET_NAME environment variable is required. Run 'fly storage create' first.");
  }
  return bucketName;
}

/**
 * Generate public URL for an object (works for public buckets)
 * Tigris uses virtual hosting style for public URLs
 */
function getPublicUrl(key) {
  const bucketName = getBucketName();
  // For public buckets, use virtual hosting style: bucket-name.t3.storage.dev
  // This is the public CDN endpoint for Tigris
  return `https://${bucketName}.t3.storage.dev/${key}`;
}

/**
 * Upload an image to Tigris
 * @param {Buffer} buffer - Image buffer
 * @param {string} key - Object key (path) in bucket
 * @param {object} options - Optional metadata (ContentType, CacheControl, etc.)
 * @returns {Promise<object>} Upload result
 */
export async function uploadImage(buffer, key, options = {}) {
  const bucketName = getBucketName();
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: buffer,
    ContentType: options.ContentType || "image/webp",
    CacheControl: options.CacheControl || "public, max-age=31536000", // 1 year
    ...options,
  });

  try {
    const result = await getS3Client().send(command);
    return {
      success: true,
      key,
      etag: result.ETag,
    };
  } catch (error) {
    console.error("Tigris upload error:", error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }
}

/**
 * Get URL for an image
 * For public buckets, returns public URL
 * For private buckets, generates pre-signed URL (expires in 1 hour)
 * @param {string} key - Object key
 * @param {boolean} isPublic - Whether bucket is public (default: true)
 * @returns {Promise<string>} Image URL
 */
export async function getImageUrl(key, isPublic = true) {
  if (isPublic) {
    return getPublicUrl(key);
  }

  // Generate pre-signed URL for private buckets
  const bucketName = getBucketName();
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    const url = await getSignedUrl(getS3Client(), command, { expiresIn: 3600 }); // 1 hour
    return url;
  } catch (error) {
    console.error("Error generating pre-signed URL:", error);
    throw new Error(`Failed to generate image URL: ${error.message}`);
  }
}

/**
 * Delete an image from Tigris
 * @param {string} key - Object key to delete
 * @returns {Promise<object>} Delete result
 */
export async function deleteImage(key) {
  const bucketName = getBucketName();
  
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  });

  try {
    await getS3Client().send(command);
    return {
      success: true,
      key,
    };
  } catch (error) {
    console.error("Tigris delete error:", error);
    throw new Error(`Failed to delete image: ${error.message}`);
  }
}

/**
 * List images in Tigris bucket
 * @param {string} prefix - Optional prefix to filter by (e.g., "images/user123/")
 * @param {number} maxKeys - Maximum number of objects to return (default: 100)
 * @returns {Promise<Array>} Array of image metadata
 */
export async function listImages(prefix = "", maxKeys = 100) {
  const bucketName = getBucketName();
  
  const command = new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
    MaxKeys: maxKeys,
  });

  try {
    const response = await getS3Client().send(command);
    const images = (response.Contents || []).map((object) => ({
      key: object.Key,
      size: object.Size,
      lastModified: object.LastModified,
      etag: object.ETag,
      url: getPublicUrl(object.Key), // Assume public bucket
    }));
    
    return images;
  } catch (error) {
    console.error("Tigris list error:", error);
    throw new Error(`Failed to list images: ${error.message}`);
  }
}

