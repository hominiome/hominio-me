<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import TigrisImageUpload from "$lib/components/TigrisImageUpload.svelte";
  import { showSuccess, showError } from "$lib/toastStore.js";

  let { data } = $props();

  const session = authClient.useSession();
  let isAdmin = $state(false);
  let checkingAdmin = $state(true);

  let title = $state("");
  let previewTitle = $state("");
  let message = $state("");
  let imageUrl = $state("");
  let actionsJson = $state("[]");
  let sending = $state(false);
  let uploadImageUrl = $state<string | null>(null);
  
  const actionsPlaceholder = '[{"label": "Learn More", "url": "/alpha"}]';

  onMount(() => {
    (async () => {
      // Wait for session to load
      while ($session.isPending) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!$session.data?.user) {
        goto("/alpha");
        return;
      }

      // Check if user is admin
      try {
        const response = await fetch("/alpha/api/is-admin");
        if (response.ok) {
          const adminData = await response.json();
          isAdmin = adminData.isAdmin;
          checkingAdmin = false;

          if (!isAdmin) {
            goto("/alpha");
            return;
          }
        } else {
          goto("/alpha");
          return;
        }
      } catch (error) {
        console.error("Failed to check admin status:", error);
        goto("/alpha");
        return;
      }
    })();
  });

  function handleImageUploadSuccess(result: {
    original: { key: string; url: string; size: number };
    thumbnail: { key: string; url: string; size: number };
  }) {
    uploadImageUrl = result.original.url;
    imageUrl = result.original.url;
  }

  function handleImageUploadError(error: string) {
    showError(`Image upload failed: ${error}`);
  }

  function handleImageClear() {
    uploadImageUrl = null;
    imageUrl = "";
  }

  async function sendNewsletter() {
    if (!title.trim() || !message.trim()) {
      showError("Please fill in title and message");
      return;
    }

    sending = true;

    try {
      // Parse actions JSON if provided
      let actions = [];
      if (actionsJson.trim()) {
        try {
          actions = JSON.parse(actionsJson);
        } catch (e) {
          showError("Invalid JSON format for actions");
          sending = false;
          return;
        }
      }

      const response = await fetch("/alpha/api/send-newsletter", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          previewTitle: previewTitle.trim() || "",
          message: message.trim(),
          imageUrl: imageUrl.trim() || undefined,
          actions: actions.length > 0 ? actions : undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send newsletter");
      }

      showSuccess(
        `Newsletter sent successfully to ${result.count} user${result.count === 1 ? "" : "s"}!`
      );

      // Reset form
      title = "";
      previewTitle = "";
      message = "";
      imageUrl = "";
      uploadImageUrl = null;
      actionsJson = "[]";
    } catch (error) {
      console.error("Send newsletter error:", error);
      showError(
        error instanceof Error ? error.message : "Failed to send newsletter"
      );
    } finally {
      sending = false;
    }
  }
</script>

{#if checkingAdmin}
  <div class="container">
    <div class="card">
      <p>Checking admin access...</p>
    </div>
  </div>
{:else if isAdmin}
  <div class="container">
    <div class="card">
      <h1>Send Newsletter Notification</h1>
      <p class="subtitle">
        Send a global announcement notification to all users who have
        subscribed to newsletter notifications.
      </p>

      <form
        onsubmit={(e) => {
          e.preventDefault();
          sendNewsletter();
        }}
        class="newsletter-form"
      >
        <div class="form-group">
          <label for="title">Title *</label>
          <input
            id="title"
            type="text"
            bind:value={title}
            placeholder="Newsletter title"
            required
            disabled={sending}
          />
        </div>

        <div class="form-group">
          <label for="previewTitle">Preview Title</label>
          <input
            id="previewTitle"
            type="text"
            bind:value={previewTitle}
            placeholder="Optional preview text"
            disabled={sending}
          />
        </div>

        <div class="form-group">
          <label for="message">Message *</label>
          <textarea
            id="message"
            bind:value={message}
            placeholder="Newsletter content"
            rows="6"
            required
            disabled={sending}
          ></textarea>
        </div>

        <div class="form-group">
          <label>Newsletter Image (Optional)</label>
          <p class="form-help">
            Upload an image or enter an image URL. If provided, the image will
            be displayed at the top of the notification modal.
          </p>
          <TigrisImageUpload
            existingImageUrl={uploadImageUrl}
            onUploadSuccess={handleImageUploadSuccess}
            onUploadError={handleImageUploadError}
            onClear={handleImageClear}
            uploadButtonLabel="Upload Image"
            disabled={sending}
          />
          <div class="url-input-wrapper">
            <input
              type="url"
              bind:value={imageUrl}
              placeholder="Or enter image URL directly"
              disabled={sending}
              class="url-input"
            />
          </div>
        </div>

        <div class="form-group">
          <label for="actions">Action Buttons (JSON, Optional)</label>
          <p class="form-help">
            JSON array of action buttons. Example: [&#123;"label": "Learn More", "url": "/alpha"&#125;]
          </p>
          <textarea
            id="actions"
            bind:value={actionsJson}
            placeholder={actionsPlaceholder}
            rows="3"
            disabled={sending}
          ></textarea>
        </div>

        <div class="form-actions">
          <button type="submit" disabled={sending} class="btn-primary">
            {sending ? "Sending..." : "Send Newsletter"}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
  .container {
    min-height: 100vh;
    padding: 2rem;
    background: linear-gradient(135deg, #f0fffe 0%, #fff9e6 100%);
  }

  .card {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    border-radius: 24px;
    padding: 3rem;
    box-shadow: 0 8px 32px rgba(79, 195, 195, 0.15),
      0 2px 8px rgba(0, 0, 0, 0.05);
    border: 2px solid #4fc3c3;
  }

  h1 {
    font-size: 2rem;
    font-weight: 800;
    color: #1a1a4e;
    margin: 0 0 0.5rem 0;
  }

  .subtitle {
    color: rgba(26, 26, 78, 0.7);
    margin: 0 0 2rem 0;
    line-height: 1.6;
  }

  .newsletter-form {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-weight: 600;
    color: #1a1a4e;
    font-size: 0.9375rem;
  }

  .form-help {
    font-size: 0.875rem;
    color: rgba(26, 26, 78, 0.6);
    margin: 0;
  }

  input[type="text"],
  input[type="url"],
  textarea {
    padding: 0.75rem;
    border: 2px solid rgba(78, 205, 196, 0.3);
    border-radius: 8px;
    font-size: 1rem;
    font-family: inherit;
    transition: border-color 0.2s;
  }

  input[type="text"]:focus,
  input[type="url"]:focus,
  textarea:focus {
    outline: none;
    border-color: #4ecdc4;
  }

  input:disabled,
  textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  textarea {
    resize: vertical;
    min-height: 100px;
  }

  .url-input-wrapper {
    margin-top: 0.5rem;
  }

  .url-input {
    width: 100%;
  }

  .form-actions {
    margin-top: 1rem;
  }

  .btn-primary {
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    color: white;
    padding: 0.875rem 2rem;
    border: none;
    border-radius: 999px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }

    .card {
      padding: 2rem 1.5rem;
    }

    h1 {
      font-size: 1.75rem;
    }
  }
</style>

