<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { useZero } from "$lib/zero-utils";

  const zeroContext = useZero();
  const session = authClient.useSession();
  const cupId = $page.params.cupId;

  let zero: any = null;
  let cup = $state<any>(null);
  let loading = $state(true);
  let saving = $state(false);
  let isAdmin = $state(false);
  let isCreator = $state(false);
  let checking = $state(true);

  // Form state
  let name = $state("");
  let description = $state("");
  let logoImageUrl = $state("");

  // Check if user is admin
  $effect(() => {
    (async () => {
      if (!$session.isPending && $session.data?.user) {
        try {
          const response = await fetch("/alpha/api/is-admin");
          if (response.ok) {
            const data = await response.json();
            isAdmin = data.isAdmin;
          }
        } catch (error) {
          console.error("Failed to check admin status:", error);
        }
      }
      checking = false;
    })();
  });

  onMount(() => {
    let cupView: any;

    (async () => {
      // Wait for Zero to be ready
      while (!zeroContext.isReady() || !zeroContext.getInstance()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      zero = zeroContext.getInstance();

      // Query cup
      const cupQuery = zero.query.cup.where("id", "=", cupId);
      cupView = cupQuery.materialize();

      cupView.addListener((data: any) => {
        const cups = Array.from(data);
        if (cups.length > 0) {
          cup = cups[0];
          // Populate form
          name = cup.name || "";
          description = cup.description || "";
          logoImageUrl = cup.logoImageUrl || "";
          
          // Check if user is creator
          isCreator = cup.creatorId === $session.data?.user?.id;
          
          // Check permissions
          if (!isAdmin && !isCreator) {
            goto(`/alpha/cups/${cupId}`);
            return;
          }
          
          loading = false;
        } else if (cup === null) {
          loading = false;
        }
      });
    })();

    return () => {
      if (cupView) cupView.destroy();
    };
  });

  async function updateCup() {
    if (!cup || saving || !name.trim()) {
      return;
    }

    if (!isAdmin && !isCreator) {
      alert("You don't have permission to edit this cup");
      return;
    }

    saving = true;

    try {
      const response = await fetch("/alpha/api/update-cup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cupId: cup.id,
          name: name.trim(),
          description: description.trim() || "",
          logoImageUrl: logoImageUrl.trim() || "",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update cup");
      }

      // Redirect back to cup page
      goto(`/alpha/cups/${cupId}`);
    } catch (error) {
      console.error("Failed to update cup:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to update cup: ${message}`);
    } finally {
      saving = false;
    }
  }
</script>

<div class="min-h-screen bg-cream p-8">
  <div class="max-w-2xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <a href="/alpha/cups/{cupId}" class="text-teal hover:underline mb-4 inline-block">
        ← Back to Cup
      </a>
      <h1 class="text-6xl font-bold text-navy mb-3">Edit Cup</h1>
      <p class="text-navy/60 text-lg">
        Update your tournament cup details
      </p>
    </div>

    {#if loading || checking}
      <div class="card p-8 text-center">
        <p class="text-navy/70">Loading cup...</p>
      </div>
    {:else if !cup}
      <div class="card p-8 text-center">
        <p class="text-navy/70">Cup not found</p>
      </div>
    {:else}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          updateCup();
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

        <!-- Actions -->
        <div class="flex gap-4">
          <button
            type="submit"
            disabled={saving || !name.trim()}
            class="btn-primary flex-1"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <a href="/alpha/cups/{cupId}" class="btn-secondary">Cancel</a>
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

  .btn-primary {
    padding: 0.75rem 2rem;
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
    padding: 0.75rem 2rem;
    background: white;
    color: #1a1a4e;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 12px;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
    display: inline-block;
  }

  .btn-secondary:hover {
    border-color: #4ecdc4;
    color: #4ecdc4;
  }

  .text-teal {
    color: #4ecdc4;
  }

  .text-navy {
    color: #1a1a4e;
  }
</style>

