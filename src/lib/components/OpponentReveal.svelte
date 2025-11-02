<script>
  import { onMount } from "svelte";
  import { getUserProfile } from "$lib/userProfileCache";

  let {
    matchId = "",
    opponentProjectId = "",
  } = $props();

  let opponentProject = $state(null);
  let opponentProfile = $state({
    name: null,
    image: null,
  });
  let spinning = $state(true);
  let revealed = $state(false);
  let startTime = $state(null);

  onMount(async () => {
    // Start spinning immediately
    startTime = Date.now();
    
    // Always spin for 5.5 seconds regardless of load time
    setTimeout(() => {
      spinning = false;
      setTimeout(() => {
        revealed = true;
      }, 500); // Small delay for transition
    }, 5500);
    
    try {
      // Fetch project details in parallel
      const projectResponse = await fetch(`/alpha/api/project/${opponentProjectId}`);
      if (projectResponse.ok) {
        opponentProject = await projectResponse.json();
        
        // Fetch founder profile
        if (opponentProject?.userId) {
          const profile = await getUserProfile(opponentProject.userId);
          opponentProfile = { name: profile.name, image: profile.image };
        }
      }
    } catch (error) {
      console.error("Failed to load opponent:", error);
    }
  });
</script>

<div class="opponent-reveal-container">
  {#if spinning}
    <div class="spinning-card">
      <div class="spinner-back">
        <div class="spinner-icon">?</div>
      </div>
    </div>
  {:else if revealed && opponentProject}
    <div class="opponent-card" class:revealed={revealed}>
      <div class="opponent-header">
        <h3 class="opponent-title">Your Next Opponent</h3>
      </div>
      
      <div class="opponent-content">
        <div class="opponent-avatar">
          {#if opponentProfile.image}
            <img src={opponentProfile.image} alt={opponentProfile.name || "Opponent"} />
          {:else}
            <div class="avatar-placeholder">
              {opponentProfile.name?.[0]?.toUpperCase() || "?"}
            </div>
          {/if}
        </div>
        
        <div class="opponent-info">
          <h4 class="project-name">{opponentProject.title || "Unknown Project"}</h4>
          {#if opponentProfile.name}
            <p class="founder-name">by {opponentProfile.name}</p>
          {/if}
          {#if opponentProject.description}
            <p class="project-description">{opponentProject.description}</p>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div class="loading-state">Loading opponent...</div>
  {/if}
</div>

<style>
  .opponent-reveal-container {
    width: 100%;
    min-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .loading-state {
    color: rgba(26, 26, 78, 0.7);
    font-size: 1.125rem;
  }

  .spinning-card {
    width: 250px;
    height: 300px;
    perspective: 1000px;
    margin: 0 auto;
  }

  .spinner-back {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: spin 0.4s linear infinite;
    box-shadow: 0 8px 24px rgba(78, 205, 196, 0.4);
    transform-style: preserve-3d;
  }

  .spinner-icon {
    font-size: 5rem;
    color: white;
    font-weight: bold;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  @keyframes spin {
    0% {
      transform: rotateY(0deg) rotateX(0deg);
    }
    50% {
      transform: rotateY(180deg) rotateX(10deg);
    }
    100% {
      transform: rotateY(360deg) rotateX(0deg);
    }
  }

  .opponent-card {
    width: 100%;
    max-width: 500px;
    background: white;
    border-radius: 16px;
    padding: 2rem;
    box-shadow: 0 8px 24px rgba(26, 26, 78, 0.1);
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.5s ease;
  }

  .opponent-card.revealed {
    opacity: 1;
    transform: scale(1);
  }

  .opponent-header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .opponent-title {
    font-size: 1.75rem;
    font-weight: 700;
    color: #1a1a4e;
    margin: 0;
  }

  .opponent-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }

  .opponent-avatar {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    overflow: hidden;
    border: 4px solid #4ecdc4;
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
  }

  .opponent-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .avatar-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 3rem;
    font-weight: bold;
  }

  .opponent-info {
    text-align: center;
    width: 100%;
  }

  .project-name {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a4e;
    margin: 0 0 0.5rem 0;
  }

  .founder-name {
    font-size: 1rem;
    color: rgba(26, 26, 78, 0.7);
    margin: 0 0 1rem 0;
  }

  .project-description {
    font-size: 1rem;
    color: rgba(26, 26, 78, 0.8);
    line-height: 1.6;
    margin: 0;
  }
</style>

