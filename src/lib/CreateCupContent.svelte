<script lang="ts">
  import { authClient } from "$lib/auth.client.js";
  import { showSuccess, showError } from "$lib/toastStore.js";
  import { useZero } from "$lib/zero-utils";
  import { nanoid } from "nanoid";
  import { onMount } from "svelte";

  let { onSuccess } = $props<{
    onSuccess?: (cupId: string) => void;
  }>();

  const zeroContext = useZero();
  const session = authClient.useSession();

  let zero: any = null;
  let name = $state("");
  let description = $state("");
  let logoImageUrl = $state("");
  let size = $state(16); // Default to 16
  let creating = $state(false);

  onMount(() => {
    (async () => {
      // Wait for Zero to be ready
      while (!zeroContext.isReady() || !zeroContext.getInstance()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      zero = zeroContext.getInstance();
    })();
  });

  async function createCup() {
    if (!$session.data?.user || creating || !name.trim() || !zero) {
      return;
    }

    creating = true;

    try {
      const now = new Date().toISOString();
      const cupId = nanoid();

      // Use Zero custom mutator for cup creation (admin-only)
      // Fire and forget - Zero handles optimistic updates
      zero.mutate.cup.create({
        id: cupId,
        name: name.trim(),
        description: description.trim() || "",
        logoImageUrl: logoImageUrl.trim() || "",
        size: size,
        creatorId: $session.data.user.id,
        selectedProjectIds: "[]",
        status: "draft",
        currentRound: "",
        winnerId: "",
        createdAt: now,
        startedAt: "",
        completedAt: "",
        updatedAt: now,
        endDate: "",
      });

      showSuccess("Cup created successfully!");
      onSuccess?.(cupId);
    } catch (error) {
      console.error("Failed to create cup:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      showError(`Failed to create cup: ${message}`);
    } finally {
      creating = false;
    }
  }

  // Form validation
  const canCreateCup = $derived(name.trim().length > 0);

  // Expose for layout - use requestAnimationFrame to debounce updates
  let rafId: number | null = null;
  if (typeof window !== "undefined") {
    $effect(() => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        (window as any).__cupModalActions = {
          canCreateCup,
          creating,
          handleCreateSubmit: () => {
            const form = document.getElementById(
              "create-cup-form"
            ) as HTMLFormElement;
            if (form && canCreateCup) {
              form.requestSubmit();
            }
          },
        };
        rafId = null;
      });
      return () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      };
    });
  }
</script>

<div class="create-cup-content">
  <h2 class="text-3xl font-bold text-navy mb-6">Create Cup</h2>

  {#if !$session.data}
    <div class="text-center py-8">
      <p class="text-navy/70">Please sign in to create a cup.</p>
    </div>
  {:else}
    <form
      id="create-cup-form"
      onsubmit={(e) => {
        e.preventDefault();
        createCup();
      }}
      class="space-y-5"
    >
      <!-- Cup Name -->
      <div>
        <label for="cup-name" class="block text-navy/80 font-medium mb-2"
          >Cup Name *</label
        >
        <input
          id="cup-name"
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
        <label for="cup-description" class="block text-navy/80 font-medium mb-2"
          >Description (Optional)</label
        >
        <textarea
          id="cup-description"
          bind:value={description}
          placeholder="Describe your tournament..."
          class="input w-full"
          rows="4"
          maxlength="500"
        ></textarea>
      </div>

      <!-- Cup Size -->
      <div>
        <div class="block text-navy/80 font-medium mb-2">Cup Size *</div>
        <div class="size-selector">
          {#each [4, 8, 16, 32, 64, 128] as optionSize}
            <label class="size-option">
              <input
                type="radio"
                name="size"
                value={optionSize}
                bind:group={size}
                required
              />
              <span class="size-label">{optionSize}</span>
            </label>
          {/each}
        </div>
        <p class="text-sm text-navy/60 mt-2">
          Select the number of participants for this tournament bracket
        </p>
      </div>

      <!-- Logo Image URL -->
      <div>
        <label
          for="cup-logoImageUrl"
          class="block text-navy/80 font-medium mb-2"
          >Logo Image URL (Optional)</label
        >
        <input
          id="cup-logoImageUrl"
          type="url"
          bind:value={logoImageUrl}
          placeholder="https://example.com/logo.png"
          class="input w-full"
          maxlength="500"
        />
        <p class="text-sm text-navy/60 mt-1">
          Add a logo image URL for your cup tournament
        </p>
      </div>

      <!-- Info Box -->
      <div class="info-box">
        <svg class="w-5 h-5 text-teal" fill="currentColor" viewBox="0 0 24 24">
          <path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
          />
        </svg>
        <div>
          <p class="text-navy font-semibold mb-1">After creating:</p>
          <ul class="text-navy/70 text-sm space-y-1">
            <li>• Add exactly {size} projects to your tournament</li>
            <li>• Matches will be automatically generated</li>
            <li>• Users can vote with hearts on each match</li>
            <li>• Advance winners through each round</li>
          </ul>
        </div>
      </div>
    </form>
  {/if}
</div>

<style>
  .create-cup-content {
    width: 100%;
    overflow: visible;
  }

  .create-cup-content form {
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
  }

  .size-selector {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .size-option {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.875rem 1rem;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    background: white;
  }

  .size-option:hover {
    border-color: #4ecdc4;
    background: rgba(78, 205, 196, 0.05);
  }

  .size-option input[type="radio"] {
    display: none;
  }

  .size-option:has(input[type="radio"]:checked) {
    border-color: #4ecdc4;
    background: rgba(78, 205, 196, 0.1);
  }

  .size-label {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1a1a4e;
    cursor: pointer;
  }

  .info-box {
    background: rgba(78, 205, 196, 0.05);
    border: 1px solid rgba(78, 205, 196, 0.2);
    border-radius: 12px;
    padding: 1rem;
    display: flex;
    gap: 0.75rem;
  }

  .text-teal {
    color: #4ecdc4;
  }

  .text-navy {
    color: #1a1a4e;
  }
</style>
