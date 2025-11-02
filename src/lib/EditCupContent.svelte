<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { useZero } from "$lib/zero-utils";
  import { showError } from "$lib/toastStore.js";
  import TigrisImageUpload from "$lib/components/TigrisImageUpload.svelte";
  
  let { cupId, onSuccess } = $props<{
    cupId: string;
    onSuccess?: () => void;
  }>();
  
  const zeroContext = useZero();
  const session = authClient.useSession();
  
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
      showError("You don't have permission to edit this cup");
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

      onSuccess?.();
    } catch (error) {
      console.error("Failed to update cup:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      showError(`Failed to update cup: ${message}`);
    } finally {
      saving = false;
    }
  }
  
  // Form validation
  const canEditCup = $derived(cup && name.trim().length > 0 && !saving);
  
  // Expose for layout
  if (typeof window !== "undefined") {
    $effect(() => {
      (window as any).__cupModalActions = {
        canEditCup,
        saving,
        handleEditSubmit: () => {
          const form = document.getElementById("edit-cup-form") as HTMLFormElement;
          if (form && canEditCup) {
            form.requestSubmit();
          }
        },
      };
    });
  }
</script>

<div class="edit-cup-content">
  <h2 class="text-3xl font-bold text-navy mb-6">Edit Cup</h2>
  
  {#if loading || checking}
    <div class="text-center py-8">
      <p class="text-navy/70">Loading cup...</p>
    </div>
  {:else if !cup}
    <div class="text-center py-8">
      <p class="text-navy/70">Cup not found</p>
    </div>
  {:else}
    <form
      id="edit-cup-form"
      onsubmit={(e) => {
        e.preventDefault();
        updateCup();
      }}
      class="space-y-5"
    >
      <!-- Cup Name -->
      <div>
        <label for="edit-cup-name" class="block text-navy/80 font-medium mb-2">Cup Name *</label>
        <input
          id="edit-cup-name"
          type="text"
          bind:value={name}
          placeholder="e.g., Hominio Cup #1"
          class="input w-full"
          required
          maxlength="100"
        />
      </div>

      <!-- Description -->
      <div>
        <label for="edit-cup-description" class="block text-navy/80 font-medium mb-2">Description (Optional)</label>
        <textarea
          id="edit-cup-description"
          bind:value={description}
          placeholder="Describe your tournament..."
          class="input w-full"
          rows="4"
          maxlength="500"
        ></textarea>
      </div>

      <!-- Logo Image -->
      <div>
        <label class="block text-navy/80 font-medium mb-2">Logo Image (Optional)</label>
        <TigrisImageUpload
          uploadButtonLabel="Upload Logo"
          showPreview={false}
          existingImageUrl={logoImageUrl || null}
          onUploadSuccess={(image) => {
            logoImageUrl = image.original.url;
          }}
          onUploadError={(error) => {
            showError(`Failed to upload logo: ${error}`);
          }}
          onChange={() => {
            // Allow changing the logo
          }}
          onClear={() => {
            logoImageUrl = "";
          }}
        />
      </div>
    </form>
  {/if}
</div>

<style>
  .edit-cup-content {
    width: 100%;
    overflow: visible;
  }
  
  .edit-cup-content form {
    overflow: visible;
    max-height: none;
  }
  
  .input {
    padding: 0.875rem 1rem;
    background: white;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 10px;
    color: #1a1a4e;
    transition: all 0.2s ease;
    font-size: 0.9375rem;
    width: 100%;
  }

  .input:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  }
  
  .text-navy {
    color: #1a1a4e;
  }
</style>

