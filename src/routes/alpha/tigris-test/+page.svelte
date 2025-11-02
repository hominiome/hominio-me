<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import TigrisImageUpload from "$lib/components/TigrisImageUpload.svelte";

  let { data } = $props<{ data: { session: { id: string; name: string | null } | null } }>();

  let uploadedImages = $state<Array<{
    original: { key: string; url: string; size: number };
    thumbnail: { key: string; url: string; size: number };
  }>>([]);
  let loadingImages = $state(false);

  function handleUploadSuccess(image: {
    original: { key: string; url: string; size: number };
    thumbnail: { key: string; url: string; size: number };
  }) {
    // Reload images after successful upload
    loadImages();
  }

  // Load images on mount
  onMount(() => {
    loadImages();
  });

  async function loadImages() {
    if (!browser) return;
    
    loadingImages = true;
    try {
      const response = await fetch("/alpha/api/list-images");
      if (response.ok) {
        const result = await response.json();
        console.log("📸 Loaded images:", result);
        console.log("📸 Image keys:", result.images.map((img: { key: string }) => img.key));
        
        // Group images by their base name (without timestamp and extension)
        // Extract thumbnails and match with originals
        // Note: keys are like "thumbnails/userId/..." or "images/userId/..." (no leading slash)
        const thumbnails = result.images.filter((img: { key: string }) => 
          img.key.startsWith("thumbnails/") || img.key.includes("/thumbnails/")
        );
        
        const originals = result.images.filter((img: { key: string }) => 
          (img.key.startsWith("images/") || img.key.includes("/images/")) && 
          !img.key.includes("thumbnails")
        );
        
        console.log("📸 Thumbnails found:", thumbnails.length);
        console.log("📸 Originals found:", originals.length);
        
        // Match thumbnails with originals by extracting the base filename
        // Format: images/userId/timestamp-nanoid-basename.webp
        // Format: thumbnails/userId/timestamp-nanoid-basename.webp
        uploadedImages = thumbnails.map((thumb: { key: string; url: string; size: number }) => {
          // Extract everything after the second hyphen (timestamp-nanoid-basename.webp)
          // Split by /, get last part, then extract everything after the second hyphen
          const thumbFilename = thumb.key.split("/").pop() || "";
          const thumbParts = thumbFilename.split("-");
          // Remove first two parts (timestamp and nanoid), rejoin the rest
          const thumbBaseName = thumbParts.slice(2).join("-");
          
          // Find matching original by base name
          const original = originals.find((orig: { key: string }) => {
            const origFilename = orig.key.split("/").pop() || "";
            const origParts = origFilename.split("-");
            const origBaseName = origParts.slice(2).join("-");
            return origBaseName === thumbBaseName;
          });
          
          return {
            thumbnail: { key: thumb.key, url: thumb.url, size: thumb.size },
            original: original || { 
              key: thumb.key.replace("thumbnails/", "images/"), 
              url: thumb.url.replace("thumbnails/", "images/"), 
              size: 0 
            },
          };
        });
        
        // Also include originals that don't have thumbnails (fallback)
        const thumbKeys = new Set(thumbnails.map((t: { key: string }) => {
          const filename = t.key.split("/").pop() || "";
          const parts = filename.split("-");
          return parts.slice(2).join("-");
        }));
        
        const unmatchedOriginals = originals.filter((orig: { key: string }) => {
          const filename = orig.key.split("/").pop() || "";
          const parts = filename.split("-");
          const baseName = parts.slice(2).join("-");
          return !thumbKeys.has(baseName);
        });
        
        // Add unmatched originals (show original as both thumbnail and original)
        unmatchedOriginals.forEach((orig: { key: string; url: string; size: number }) => {
          uploadedImages.push({
            thumbnail: { key: orig.key, url: orig.url, size: orig.size },
            original: { key: orig.key, url: orig.url, size: orig.size },
          });
        });
        
        console.log("✅ Processed images:", uploadedImages.length);
        console.log("✅ Image pairs:", JSON.parse(JSON.stringify(uploadedImages)));
      } else {
        const errorData = await response.json().catch(() => ({ error: "Failed to load images" }));
        console.error("❌ List images error:", errorData.error || "Failed to load images");
      }
    } catch (err) {
      console.error("Failed to load images:", err);
    } finally {
      loadingImages = false;
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }
</script>

<div class="container">
  <h1>Tigris Image Upload Test</h1>
  <p class="subtitle">Test image upload, processing, and storage with Tigris</p>

  <div class="upload-section">
    <TigrisImageUpload onUploadSuccess={handleUploadSuccess} />
  </div>

  <div class="images-section">
    <h2>Uploaded Images</h2>
    {#if loadingImages}
      <p>Loading images...</p>
    {:else if uploadedImages.length === 0}
      <p class="empty-state">No images uploaded yet.</p>
    {:else}
      <div class="image-grid">
        {#each uploadedImages as image}
          <div class="image-card">
            <img src={image.thumbnail.url} alt="Thumbnail" class="thumbnail" />
            <div class="image-info">
              <p class="image-url" onclick={() => copyToClipboard(image.original.url)}>
                {image.original.url}
              </p>
              <div class="image-actions">
                <a href={image.original.url} target="_blank" class="btn-link">View Original</a>
                <button
                  class="btn-copy"
                  onclick={() => copyToClipboard(image.original.url)}
                >
                  Copy URL
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  h1 {
    font-size: 2rem;
    font-weight: bold;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: #666;
    margin-bottom: 2rem;
  }

  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .alert-error {
    background-color: #fee;
    border: 1px solid #fcc;
    color: #c33;
  }

  .alert-success {
    background-color: #efe;
    border: 1px solid #cfc;
    color: #3c3;
  }

  .upload-section {
    margin-bottom: 3rem;
  }

  .upload-area {
    border: 2px dashed #ccc;
    border-radius: 0.5rem;
    padding: 3rem;
    text-align: center;
    background-color: #fafafa;
    transition: all 0.3s;
  }

  .upload-area.drag-over {
    border-color: #4caf50;
    background-color: #f0f8f0;
  }

  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .upload-icon {
    width: 4rem;
    height: 4rem;
    color: #999;
  }

  .btn-select {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background-color: #4caf50;
    color: white;
    border-radius: 0.5rem;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .btn-select:hover {
    background-color: #45a049;
  }

  .hint {
    font-size: 0.875rem;
    color: #666;
    margin-top: 0.5rem;
  }

  .preview-container {
    display: flex;
    gap: 2rem;
    align-items: center;
  }

  .preview-image {
    max-width: 300px;
    max-height: 300px;
    border-radius: 0.5rem;
    object-fit: contain;
  }

  .preview-info {
    text-align: left;
    flex: 1;
  }

  .preview-info p {
    margin: 0.5rem 0;
  }

  .upload-actions {
    margin-top: 1.5rem;
  }

  .btn-upload {
    padding: 0.75rem 2rem;
    background-color: #2196f3;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .btn-upload:hover:not(:disabled) {
    background-color: #1976d2;
  }

  .btn-upload:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .progress-bar {
    margin-top: 1rem;
    height: 8px;
    background-color: #e0e0e0;
    border-radius: 4px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background-color: #4caf50;
    transition: width 0.3s;
  }

  .images-section {
    margin-top: 3rem;
  }

  .images-section h2 {
    font-size: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .empty-state {
    color: #999;
    text-align: center;
    padding: 2rem;
  }

  .image-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.5rem;
  }

  .image-card {
    border: 1px solid #e0e0e0;
    border-radius: 0.5rem;
    overflow: hidden;
    background-color: white;
  }

  .thumbnail {
    width: 100%;
    height: 200px;
    object-fit: cover;
  }

  .image-info {
    padding: 1rem;
  }

  .image-url {
    font-size: 0.75rem;
    color: #666;
    word-break: break-all;
    margin-bottom: 0.75rem;
    cursor: pointer;
    padding: 0.5rem;
    background-color: #f5f5f5;
    border-radius: 0.25rem;
  }

  .image-url:hover {
    background-color: #eeeeee;
  }

  .image-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-link {
    flex: 1;
    padding: 0.5rem;
    background-color: #2196f3;
    color: white;
    text-align: center;
    text-decoration: none;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    transition: background-color 0.2s;
  }

  .btn-link:hover {
    background-color: #1976d2;
  }

  .btn-copy {
    padding: 0.5rem 1rem;
    background-color: #666;
    color: white;
    border: none;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .btn-copy:hover {
    background-color: #555;
  }
</style>

