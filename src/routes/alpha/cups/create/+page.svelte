<script lang="ts">
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { showSuccess, showError } from "$lib/toastStore.js";
  const session = authClient.useSession();
  let name = $state("");
  let description = $state("");
  let logoImageUrl = $state("");
  let creating = $state(false);

  // Redirect to home if not authenticated
  $effect(() => {
    if (!$session.isPending && !$session.data) {
      goto("/alpha");
    }
  });

  async function createCup() {
    if (!$session.data?.user || creating || !name.trim()) {
      return;
    }

    creating = true;

    try {
      // Use server-side API to create cup directly in database
      const response = await fetch("/alpha/api/create-cup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || "",
          logoImageUrl: logoImageUrl.trim() || "",
          creatorId: $session.data.user.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create cup");
      }

      const result = await response.json();
      console.log("✅ Cup created:", result.cupId);

      showSuccess("Cup created successfully!");
      
      // Redirect to cup admin page
      goto(`/alpha/cups/${result.cupId}/admin`);
    } catch (error) {
      console.error("Failed to create cup:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      showError(`Failed to create cup: ${message}`);
    } finally {
      creating = false;
    }
  }
</script>

<div class="min-h-screen bg-cream p-8">
  <div class="max-w-2xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <a href="/alpha/cups" class="text-teal hover:underline mb-4 inline-block">
        ← Back to Cups
      </a>
      <h1 class="text-6xl font-bold text-navy mb-3">Create Cup</h1>
      <p class="text-navy/60 text-lg">
        Set up a new tournament bracket for project competition
      </p>
    </div>

    {#if !$session.data}
      <div class="card p-8 text-center">
        <p class="text-navy/70">Please sign in to create a cup.</p>
      </div>
    {:else}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          createCup();
        }}
        class="card p-8"
      >
        <!-- Cup Name -->
        <div class="form-group">
          <label for="name" class="form-label">Cup Name *</label>
          <input
            type="text"
            id="name"
            bind:value={name}
            placeholder="e.g., Hominio Cup #1"
            class="form-input"
            required
            maxlength="100"
          />
        </div>

        <!-- Description -->
        <div class="form-group">
          <label for="description" class="form-label"
            >Description (Optional)</label
          >
          <textarea
            id="description"
            bind:value={description}
            placeholder="Describe your tournament..."
            class="form-textarea"
            rows="4"
            maxlength="500"
          ></textarea>
        </div>

        <!-- Logo Image URL -->
        <div class="form-group">
          <label for="logoImageUrl" class="form-label"
            >Logo Image URL (Optional)</label
          >
          <input
            type="url"
            id="logoImageUrl"
            bind:value={logoImageUrl}
            placeholder="https://example.com/logo.png"
            class="form-input"
            maxlength="500"
          />
          <p class="text-sm text-navy/60 mt-1">
            Add a logo image URL for your cup tournament
          </p>
        </div>

        <!-- Info Box -->
        <div class="info-box">
          <svg
            class="w-5 h-5 text-teal"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
            />
          </svg>
          <div>
            <p class="text-navy font-semibold mb-1">After creating:</p>
            <ul class="text-navy/70 text-sm space-y-1">
              <li>• Add up to 16 projects to your tournament</li>
              <li>• Matches will be automatically generated</li>
              <li>• Users can vote with hearts on each match</li>
              <li>• Advance winners through each round</li>
            </ul>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-4">
          <button
            type="submit"
            disabled={creating || !name.trim()}
            class="btn-primary flex-1"
          >
            {creating ? "Creating..." : "Create Cup"}
          </button>
          <a href="/alpha/cups" class="btn-secondary">Cancel</a>
        </div>
      </form>
    {/if}
  </div>
</div>

<style>
  .bg-cream {
    background-color: #fef9f0;
  }

  .card {
    background: white;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(26, 26, 78, 0.06);
    border: 1px solid rgba(26, 26, 78, 0.08);
  }

  .form-group {
    margin-bottom: 1.5rem;
  }

  .form-label {
    display: block;
    color: #1a1a4e;
    font-weight: 600;
    margin-bottom: 0.5rem;
    font-size: 1rem;
  }

  .form-input,
  .form-textarea {
    width: 100%;
    padding: 0.875rem 1rem;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 12px;
    font-size: 1rem;
    color: #1a1a4e;
    transition: all 0.2s;
    font-family: inherit;
  }

  .form-input:focus,
  .form-textarea:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  }

  .form-textarea {
    resize: vertical;
    min-height: 100px;
  }

  .info-box {
    background: rgba(78, 205, 196, 0.05);
    border: 1px solid rgba(78, 205, 196, 0.2);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1.5rem;
    display: flex;
    gap: 0.75rem;
  }

  .btn-primary {
    padding: 0.875rem 2rem;
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    color: white;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-block;
    text-align: center;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(78, 205, 196, 0.3);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    padding: 0.875rem 2rem;
    background: white;
    color: #1a1a4e;
    border: 2px solid rgba(26, 26, 78, 0.2);
    border-radius: 12px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-block;
    text-align: center;
  }

  .btn-secondary:hover {
    background: rgba(26, 26, 78, 0.05);
    border-color: rgba(26, 26, 78, 0.3);
  }

  .text-teal {
    color: #4ecdc4;
  }

  .text-navy {
    color: #1a1a4e;
  }

  .flex {
    display: flex;
  }

  .gap-4 {
    gap: 1rem;
  }

  .flex-1 {
    flex: 1;
  }
</style>
