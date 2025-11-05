<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";

  let { data } = $props<{ data: { user: { id: string; name: string | null; image: string | null } } }>();
  
  const session = authClient.useSession();
  let onboarding = $state(false);
  let successMessage = $state("");
  let errorMessage = $state("");
  let imageFailed = $state(false);

  async function onboardUser() {
    if (onboarding) return;

    onboarding = true;
    successMessage = "";
    errorMessage = "";

    try {
      const response = await fetch("/alpha/api/onboard-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: data.user.id,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Onboarding failed");
      }

      const result = await response.json();
      successMessage = result.message || "User successfully onboarded as explorer!";

      // Redirect after 2 seconds
      setTimeout(() => {
        goto("/alpha/scan");
      }, 2000);
    } catch (error) {
      console.error("Onboarding failed:", error);
      errorMessage = error instanceof Error ? error.message : "Onboarding failed. Please try again.";
    } finally {
      onboarding = false;
    }
  }
</script>

<div class="container">
  {#if data.user}
    <div class="onboard-card">
      <div class="profile-header">
        {#if data.user.image && !imageFailed}
          <img 
            src={data.user.image} 
            alt={data.user.name || "User"} 
            class="profile-avatar"
            onerror={() => (imageFailed = true)}
          />
        {:else}
          <div class="profile-avatar-placeholder">
            {data.user.name?.[0]?.toUpperCase() || "?"}
          </div>
        {/if}
        <h1 class="profile-name">{data.user.name || "Anonymous"}</h1>
        <p class="profile-subtitle">Onboard this user as an Explorer</p>
      </div>

      {#if successMessage}
        <div class="success-message">
          {successMessage}
        </div>
      {/if}

      {#if errorMessage}
        <div class="error-message">
          {errorMessage}
        </div>
      {/if}

      <button
        onclick={onboardUser}
        disabled={onboarding || !!successMessage}
        class="onboard-button"
      >
        {#if onboarding}
          Onboarding...
        {:else if successMessage}
          Onboarded!
        {:else}
          Onboard Now
        {/if}
      </button>

      <a href="/alpha/scan" class="back-link">← Back to Scanner</a>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 4rem 1rem;
    min-height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .onboard-card {
    background: white;
    padding: 3rem;
    border-radius: 24px;
    border: 2px solid rgba(78, 205, 196, 0.2);
    text-align: center;
    width: 100%;
    box-shadow: 0 4px 20px rgba(78, 205, 196, 0.1);
  }

  .profile-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .profile-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 4px solid #4ecdc4;
    object-fit: cover;
  }

  .profile-avatar-placeholder {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    border: 4px solid #4ecdc4;
    background: linear-gradient(135deg, #4ecdc4, #f4d03f);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 900;
    font-size: 3rem;
    text-transform: uppercase;
  }

  .profile-name {
    color: #1a1a4e;
    font-size: 2rem;
    font-weight: 700;
    margin: 0;
  }

  .profile-subtitle {
    color: rgba(26, 26, 78, 0.7);
    font-size: 1rem;
    margin: 0;
  }

  .onboard-button {
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    color: white;
    padding: 1rem 2rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1.125rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    margin-top: 1rem;
  }

  .onboard-button:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(78, 205, 196, 0.3);
  }

  .onboard-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .success-message {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #16a34a;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
    text-align: center;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #dc2626;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
    text-align: center;
  }

  .back-link {
    display: inline-block;
    margin-top: 1.5rem;
    color: rgba(26, 26, 78, 0.7);
    text-decoration: none;
    font-size: 0.875rem;
    transition: color 0.2s;
  }

  .back-link:hover {
    color: #1a1a4e;
  }

  @media (max-width: 768px) {
    .onboard-card {
      padding: 2rem 1.5rem;
    }

    .profile-name {
      font-size: 1.5rem;
    }
  }
</style>

