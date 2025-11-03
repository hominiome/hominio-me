<script lang="ts">
  import { browser } from "$app/environment";

  interface Props {
    /** Maximum file size in bytes (default: 10MB) */
    maxSize?: number;
    /** Allowed MIME types (default: image/*) */
    accept?: string;
    /** API endpoint for upload (default: /alpha/api/upload-image) */
    uploadEndpoint?: string;
    /** Show preview of uploaded image after upload */
    showPreview?: boolean;
    /** Callback when upload succeeds */
    onUploadSuccess?: (result: {
      original: { key: string; url: string; size: number };
      thumbnail: { key: string; url: string; size: number };
    }) => void;
    /** Callback when upload fails */
    onUploadError?: (error: string) => void;
    /** Custom label for upload button */
    uploadButtonLabel?: string;
    /** Disable the component */
    disabled?: boolean;
    /** Show URL upload option (default: true) */
    showUrlUpload?: boolean;
    /** Existing image URL - if provided, shows image with Change button instead of upload UI */
    existingImageUrl?: string | null;
    /** Callback when user wants to change existing image */
    onChange?: () => void;
    /** Callback when user wants to clear existing image */
    onClear?: () => void;
  }

  let {
    maxSize = 10 * 1024 * 1024, // 10MB default
    accept = "image/*",
    uploadEndpoint = "/alpha/api/upload-image",
    showPreview = true,
    onUploadSuccess,
    onUploadError,
    uploadButtonLabel = "Upload Image",
    disabled = false,
    showUrlUpload = true,
    existingImageUrl = null,
    onChange,
    onClear,
  }: Props = $props();

  // Track if we should show upload UI (false if existing image, true if no image or user clicked Change)
  let showUploadUI = $state(false);
  
  // Sync showUploadUI with existingImageUrl prop changes
  $effect(() => {
    const hasExistingImage = existingImageUrl && existingImageUrl.trim();
    // Only auto-hide upload UI if there's an existing image and we're not actively uploading/changing
    if (hasExistingImage && !uploading && !selectedFile && !urlPreviewUrl) {
      showUploadUI = false;
    } else if (!hasExistingImage) {
      showUploadUI = true;
    }
  });

  let selectedFile = $state<File | null>(null);
  let previewUrl = $state<string | null>(null);
  let uploading = $state(false);
  let uploadProgress = $state(0);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);
  let dragOver = $state(false);
  let uploadMode = $state<"file" | "url">("file"); // Default to file upload
  let imageUrl = $state<string>("");
  let urlPreviewUrl = $state<string | null>(null);
  let uploadedImage = $state<{
    original: { key: string; url: string; size: number };
    thumbnail: { key: string; url: string; size: number };
  } | null>(null);

  // Generate unique ID for file input
  const fileInputId = `tigris-file-input-${Math.random().toString(36).substring(7)}`;

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      processFile(file);
    }
  }

  function handleDrop(event: DragEvent) {
    if (disabled) return;
    event.preventDefault();
    dragOver = false;
    
    const file = event.dataTransfer?.files[0];
    if (file) {
      processFile(file);
    }
  }

  function handleDragOver(event: DragEvent) {
    if (disabled) return;
    event.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  async function processFile(file: File) {
    if (disabled) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      error = "Please select an image file";
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      error = `File size must be less than ${formatFileSize(maxSize)}`;
      return;
    }

    selectedFile = file;
    error = null;
    success = null;

    // Create preview
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    previewUrl = URL.createObjectURL(file);
    
    // Auto-upload immediately after file is selected/dropped
    await uploadImage();
  }

  async function uploadImage() {
    if (!selectedFile || disabled) return;

    uploading = true;
    uploadProgress = 0;
    error = null;
    success = null;

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);

      // Simulate progress
      const progressInterval = setInterval(() => {
        uploadProgress = Math.min(uploadProgress + 10, 90);
      }, 100);

      const response = await fetch(uploadEndpoint, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      uploadProgress = 100;

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      success = "Image uploaded successfully!";
      uploadedImage = result.image;
      
      // Clean up preview
      selectedFile = null;
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
      }

      // Call success callback to update parent state
      if (onUploadSuccess && result.image) {
        onUploadSuccess(result.image);
      }
      
      // Hide upload UI - parent will update existingImageUrl prop which will trigger $effect
      showUploadUI = false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload image";
      error = errorMessage;
      
      // Call error callback
      if (onUploadError) {
        onUploadError(errorMessage);
      }
    } finally {
      uploading = false;
      uploadProgress = 0;
    }
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function clearSelection() {
    selectedFile = null;
    error = null;
    success = null;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
  }

  function switchMode(mode: "file" | "url") {
    uploadMode = mode;
    error = null;
    success = null;
    clearSelection();
    imageUrl = "";
    if (urlPreviewUrl) {
      URL.revokeObjectURL(urlPreviewUrl);
      urlPreviewUrl = null;
    }
  }
  
  function handleChangeClick() {
    showUploadUI = true;
    onChange?.();
  }
  
  function handleClearClick() {
    onClear?.();
    showUploadUI = true;
  }

  async function validateImageUrl(url: string): Promise<boolean> {
    try {
      const urlObj = new URL(url);
      // Check if it's http or https
      if (!["http:", "https:"].includes(urlObj.protocol)) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  async function loadImageFromUrl() {
    if (!imageUrl.trim()) {
      error = "Please enter an image URL";
      return;
    }

    error = null;
    success = null;

    // Validate URL format
    const isValidUrl = await validateImageUrl(imageUrl);
    if (!isValidUrl) {
      error = "Please enter a valid HTTP/HTTPS URL";
      return;
    }

    try {
      // Try HEAD request first to validate without downloading
      let contentType: string | null = null;
      try {
        const headResponse = await fetch(imageUrl, { method: "HEAD" });
        if (headResponse.ok) {
          contentType = headResponse.headers.get("content-type");
        }
      } catch {
        // HEAD might fail due to CORS, that's okay - we'll validate on upload
      }

      // If HEAD succeeded and content-type is available, validate it
      if (contentType && !contentType.startsWith("image/")) {
        error = "URL does not point to an image";
        return;
      }

      // Create preview - try to load the image directly
      // If it fails, we'll catch it during upload
      if (urlPreviewUrl) {
        urlPreviewUrl = null;
      }
      
      // Use the URL directly for preview
      // Browser will handle CORS - if it fails, image won't load but that's okay
      urlPreviewUrl = imageUrl;
      
      // Auto-upload immediately after preview is loaded
      await uploadFromUrl();
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to load image from URL";
    }
  }

  async function uploadFromUrl() {
    if (!imageUrl.trim() || disabled) return;

    uploading = true;
    uploadProgress = 0;
    error = null;
    success = null;

    try {
      // Validate URL
      const isValidUrl = await validateImageUrl(imageUrl);
      if (!isValidUrl) {
        throw new Error("Please enter a valid HTTP/HTTPS URL");
      }

      // Fetch the image
      uploadProgress = 20;
      const response = await fetch(imageUrl);
      
      if (!response.ok) {
        throw new Error("Could not download image from URL");
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.startsWith("image/")) {
        throw new Error("URL does not point to an image");
      }

      uploadProgress = 40;
      const blob = await response.blob();
      
      // Check file size
      if (blob.size > maxSize) {
        throw new Error(`Image size (${formatFileSize(blob.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`);
      }

      uploadProgress = 60;
      
      // Create a File object from the blob
      const filename = imageUrl.split("/").pop() || "image.jpg";
      const file = new File([blob], filename, { type: contentType });

      // Upload using the same endpoint
      const formData = new FormData();
      formData.append("image", file);

      uploadProgress = 70;
      const uploadResponse = await fetch(uploadEndpoint, {
        method: "POST",
        body: formData,
      });

      uploadProgress = 90;
      const result = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(result.error || "Upload failed");
      }

          uploadProgress = 100;
          success = "Image uploaded successfully!";
          uploadedImage = result.image;
          
          // Clear URL input
          imageUrl = "";
          if (urlPreviewUrl) {
            URL.revokeObjectURL(urlPreviewUrl);
            urlPreviewUrl = null;
          }

          // Call success callback to update parent state
          if (onUploadSuccess && result.image) {
            onUploadSuccess(result.image);
          }
          
          // Hide upload UI - parent will update existingImageUrl prop which will trigger $effect
          showUploadUI = false;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to upload image from URL";
      error = errorMessage;
      
      // Call error callback
      if (onUploadError) {
        onUploadError(errorMessage);
      }
    } finally {
      uploading = false;
      uploadProgress = 0;
    }
  }
</script>

<div class="tigris-image-upload">
  {#if error}
    <div class="alert alert-error">
      <strong>Error:</strong> {error}
    </div>
  {/if}

  {#if success}
    <div class="alert alert-success">
      {success}
    </div>
  {/if}

  {#if existingImageUrl && existingImageUrl.trim() && !showUploadUI}
    <!-- Show existing image with Change button -->
    <div class="existing-image-container">
      <div class="existing-image-preview">
        <img src={existingImageUrl} alt="" class="existing-image" />
        <div class="existing-image-actions">
          <button
            type="button"
            class="btn-change"
            onclick={handleChangeClick}
            {disabled}
          >
            Change Image
          </button>
          {#if onClear}
            <button
              type="button"
              class="btn-clear-existing"
              onclick={handleClearClick}
              {disabled}
            >
              Clear
            </button>
          {/if}
        </div>
      </div>
    </div>
  {:else if showUploadUI}
    <!-- Show upload UI -->
    {#if showUrlUpload}
    <div class="mode-toggle">
      <button
        class="toggle-btn"
        class:active={uploadMode === "file"}
        onclick={() => switchMode("file")}
        {disabled}
      >
        <svg class="toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        File Upload
      </button>
      <button
        class="toggle-btn"
        class:active={uploadMode === "url"}
        onclick={() => switchMode("url")}
        {disabled}
      >
        <svg class="toggle-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        From URL
      </button>
    </div>
  {/if}

  {#if uploadMode === "file"}
    <div
      class="upload-area"
      class:drag-over={dragOver}
      class:disabled={disabled}
      role="button"
      tabindex="0"
      aria-label="Drop zone for image upload"
      ondrop={handleDrop}
      ondragover={handleDragOver}
      ondragleave={handleDragLeave}
    >
    <input
      type="file"
      id={fileInputId}
      {accept}
      onchange={handleFileSelect}
      {disabled}
      style="display: none"
    />
    
    {#if previewUrl}
      <div class="preview-container">
        <img src={previewUrl} alt="Preview" class="preview-image" />
        <div class="preview-info">
          <p><strong>File:</strong> {selectedFile?.name}</p>
          <p><strong>Size:</strong> {selectedFile ? formatFileSize(selectedFile.size) : ""}</p>
          <p><strong>Type:</strong> {selectedFile?.type}</p>
        </div>
        {#if !disabled}
          <button class="btn-clear" onclick={clearSelection}>×</button>
        {/if}
      </div>
    {:else}
      <div class="upload-placeholder">
        <svg class="upload-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <p>Drag and drop an image here, or</p>
        <label for={fileInputId} class="btn-select" class:disabled={disabled}>
          Select File
        </label>
        <p class="hint">Supports: JPEG, PNG, WebP, GIF, SVG (max {formatFileSize(maxSize)})</p>
      </div>
    {/if}
    </div>

    {#if selectedFile && !disabled}
      <div class="upload-actions">
        <button
          class="btn-upload"
          onclick={uploadImage}
          disabled={uploading}
        >
          {uploading ? "Uploading..." : uploadButtonLabel}
        </button>
        {#if uploading}
          <div class="progress-bar">
            <div class="progress-fill" style="width: {uploadProgress}%"></div>
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <!-- URL Upload Mode -->
    <div class="url-upload-area">
      <div class="url-input-group">
        <input
          type="url"
          bind:value={imageUrl}
          placeholder="https://example.com/image.jpg"
          class="url-input"
          {disabled}
          onkeydown={(e) => {
            if (e.key === "Enter" && !disabled) {
              loadImageFromUrl();
            }
          }}
        />
        <button
          class="btn-preview"
          onclick={loadImageFromUrl}
          disabled={disabled || !imageUrl.trim()}
        >
          Preview
        </button>
      </div>
      
      {#if urlPreviewUrl}
        <div class="preview-container">
          <img src={urlPreviewUrl} alt="URL Preview" class="preview-image" />
          <div class="preview-info">
            <p><strong>URL:</strong> {imageUrl}</p>
          </div>
          <button class="btn-clear" onclick={() => { urlPreviewUrl = null; imageUrl = ""; }}>×</button>
        </div>
      {/if}

      {#if uploading}
        <div class="upload-progress-container">
          <div class="progress-bar">
            <div class="progress-fill" style="width: {uploadProgress}%"></div>
          </div>
          <p class="upload-status">Uploading...</p>
        </div>
      {/if}
    </div>
  {/if}
  {/if}

  {#if showPreview && uploadedImage && !existingImageUrl}
    <div class="uploaded-preview">
      <h3>Uploaded Image</h3>
      <div class="preview-card">
        <img src={uploadedImage.thumbnail.url} alt="Uploaded thumbnail" class="thumbnail" />
        <div class="preview-details">
          <p><strong>Original:</strong> <a href={uploadedImage.original.url} target="_blank" rel="noopener noreferrer">View</a></p>
          <p><strong>Size:</strong> {formatFileSize(uploadedImage.original.size)}</p>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .tigris-image-upload {
    width: 100%;
  }

  .alert {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.875rem;
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

  .mode-toggle {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    border-bottom: 2px solid #e0e0e0;
    padding-bottom: 0.5rem;
  }

      .toggle-btn {
        flex: 1;
        padding: 0.75rem 1rem;
        background-color: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        color: #666;
        transition: all 0.2s;
        margin-bottom: -2px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
      }

      .toggle-icon {
        width: 1rem;
        height: 1rem;
      }

  .toggle-btn:hover:not(:disabled) {
    color: #333;
    background-color: #f5f5f5;
  }

  .toggle-btn.active {
    color: #2196f3;
    border-bottom-color: #2196f3;
  }

  .toggle-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .url-upload-area {
    border: 2px dashed #ccc;
    border-radius: 0.5rem;
    padding: 1.5rem;
    background-color: #fafafa;
  }

  .url-input-group {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .url-input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #ddd;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .url-input:focus {
    outline: none;
    border-color: #2196f3;
  }

  .url-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-preview {
    padding: 0.75rem 1.5rem;
    background-color: #666;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
    white-space: nowrap;
  }

  .btn-preview:hover:not(:disabled) {
    background-color: #555;
  }

  .btn-preview:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .upload-area {
    border: 2px dashed #ccc;
    border-radius: 0.5rem;
    padding: 2rem;
    text-align: center;
    background-color: #fafafa;
    transition: all 0.3s;
    position: relative;
  }

  .upload-area.drag-over {
    border-color: #4caf50;
    background-color: #f0f8f0;
  }

  .upload-area.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .upload-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }

  .upload-icon {
    width: 3rem;
    height: 3rem;
    color: #999;
  }

  .btn-select {
    display: inline-block;
    padding: 0.5rem 1.5rem;
    background-color: #4caf50;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
  }

  .btn-select:hover:not(.disabled) {
    background-color: #45a049;
  }

  .btn-select.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .hint {
    font-size: 0.875rem;
    color: #666;
    margin-top: 0.5rem;
  }

  .preview-container {
    position: relative;
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .preview-image {
    max-width: 200px;
    max-height: 200px;
    border-radius: 0.5rem;
    object-fit: contain;
  }

  .preview-info {
    flex: 1;
    text-align: left;
    font-size: 0.875rem;
  }

  .preview-info p {
    margin: 0.25rem 0;
  }

  .btn-clear {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: none;
    background-color: rgba(0, 0, 0, 0.5);
    color: white;
    cursor: pointer;
    font-size: 1.5rem;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
  }

  .btn-clear:hover {
    background-color: rgba(0, 0, 0, 0.7);
  }

  .upload-actions {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .btn-upload {
    padding: 0.75rem 1.5rem;
    background-color: #2196f3;
    color: white;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-weight: 500;
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
    width: 100%;
    height: 0.5rem;
    background-color: #e0e0e0;
    border-radius: 0.25rem;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background-color: #4caf50;
    transition: width 0.3s;
  }

  .uploaded-preview {
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e0e0e0;
  }

  .uploaded-preview h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 1rem;
  }

  .preview-card {
    display: flex;
    gap: 1rem;
    align-items: center;
    padding: 1rem;
    background-color: #f9f9f9;
    border-radius: 0.5rem;
  }

  .preview-card .thumbnail {
    width: 100px;
    height: 100px;
    object-fit: cover;
    border-radius: 0.375rem;
  }

  .preview-details {
    flex: 1;
    font-size: 0.875rem;
  }

  .preview-details p {
    margin: 0.25rem 0;
  }

  .preview-details a {
    color: #2196f3;
    text-decoration: none;
  }

      .preview-details a:hover {
        text-decoration: underline;
      }

      .existing-image-container {
        margin-bottom: 1rem;
      }

      .existing-image-preview {
        position: relative;
        display: inline-block;
        border: 1px solid #e0e0e0;
        border-radius: 0.5rem;
        padding: 1rem;
        background-color: #fafafa;
      }

      .existing-image {
        max-width: 200px;
        max-height: 200px;
        display: block;
        border-radius: 0.25rem;
        margin-bottom: 0.75rem;
      }

      .existing-image-actions {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
      }

      .btn-change {
        padding: 0.5rem 1rem;
        background-color: #2196f3;
        color: white;
        border: none;
        border-radius: 0.375rem;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        transition: background-color 0.2s;
      }

      .btn-change:hover:not(:disabled) {
        background-color: #1976d2;
      }

      .btn-change:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .btn-clear-existing {
        padding: 0.5rem 1rem;
        background-color: #f44336;
        color: white;
        border: none;
        border-radius: 0.375rem;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        transition: background-color 0.2s;
      }

      .btn-clear-existing:hover:not(:disabled) {
        background-color: #d32f2f;
      }

      .btn-clear-existing:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    </style>

