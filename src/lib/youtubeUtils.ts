/**
 * YouTube URL utilities
 * Handles conversion of various YouTube URL formats to embed URLs
 */

const DEFAULT_VIDEO_ID = "vHfVI_4unYY"; // Fallback hardcoded video

/**
 * Extract YouTube video ID from various URL formats
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - Just the VIDEO_ID itself
 */
export function extractYouTubeVideoId(url: string | null | undefined): string | null {
  if (!url || !url.trim()) {
    return null;
  }

  const trimmedUrl = url.trim();

  // If it's already just a video ID (no URL), return it
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmedUrl)) {
    return trimmedUrl;
  }

  // Try different YouTube URL patterns
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Get YouTube embed URL from a YouTube URL or video ID
 * Falls back to default video if no valid URL provided
 */
export function getYouTubeEmbedUrl(
  videoUrl: string | null | undefined,
  autoplay: boolean = true
): string {
  const videoId = extractYouTubeVideoId(videoUrl) || DEFAULT_VIDEO_ID;
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
  });

  if (autoplay) {
    params.set("autoplay", "1");
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

