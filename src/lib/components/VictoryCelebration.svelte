<script lang="ts">
  import { onMount } from "svelte";
  import Icon from "@iconify/svelte";
  import { useZero } from "$lib/zero-utils";
  import { cupById } from "$lib/synced-queries";

  let {
    cupId = "",
    cupName: initialCupName = "",
  } = $props();

  let cupName = $state(initialCupName);
  let animationPhase = $state("confetti"); // confetti -> trophy -> celebrate
  let confettiParticles = $state([]);

  // Get Zero context
  const zeroContext = useZero();
  let zero: any = null;
  let cupView: any = null;

  onMount(async () => {
    // Create confetti particles
    const colors = ["#4ecdc4", "#1a1a4e", "#ffd700", "#ff6b6b", "#51cf66"];
    for (let i = 0; i < 50; i++) {
      confettiParticles.push({
        id: i,
        x: Math.random() * 100,
        y: -10 - Math.random() * 20,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.5,
        duration: 2 + Math.random() * 2,
      });
    }

    // Fetch cup name using Zero synced query if cupId is provided and we don't have it yet
    if (cupId && !cupName && zeroContext) {
      try {
        // Wait for Zero to be ready
        while (!zeroContext.isReady() || !zeroContext.getInstance()) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        zero = zeroContext.getInstance();

        // Use synced query to fetch cup
        const cupQuery = cupById(cupId);
        cupView = zero.materialize(cupQuery);
        
        cupView.addListener((data: any) => {
          const cups = Array.from(data);
          if (cups.length > 0 && cups[0]) {
            cupName = cups[0].name || "";
        }
        });
      } catch (error) {
        console.error("Failed to fetch cup name:", error);
      }
    }

    // Phase 1: Confetti (2 seconds)
    setTimeout(() => {
      animationPhase = "trophy";
    }, 2000);

    // Phase 2: Trophy (1 second)
    setTimeout(() => {
      animationPhase = "celebrate";
    }, 3000);

    // Cleanup
    return () => {
      if (cupView) {
        cupView.destroy();
      }
    };
  });
</script>

<div class="victory-celebration-container">
  {#if animationPhase === "confetti"}
    <!-- Confetti Phase -->
    <div class="confetti-phase">
      {#each confettiParticles as particle (particle.id)}
        <div
          class="confetti-particle"
          style="--x: {particle.x}%; --color: {particle.color}; --delay: {particle.delay}s; --duration: {particle.duration}s;"
        >
        </div>
      {/each}
      <div class="celebration-text-large">🎉</div>
    </div>
  {:else if animationPhase === "trophy"}
    <!-- Trophy Phase -->
    <div class="trophy-phase">
      <div class="trophy-icon">🏆</div>
      <h2 class="victory-title">Champion!</h2>
    </div>
  {:else}
    <!-- Final Celebration Phase -->
    <div class="celebrate-phase">
      <div class="trophy-large">🏆</div>
      <h1 class="champion-title">You Are The Champion!</h1>
      {#if cupName}
        <p class="cup-name">{cupName}</p>
      {/if}
      <div class="celebration-icons">
        <div class="celebration-icon">🎉</div>
        <div class="celebration-icon">⭐</div>
        <div class="celebration-icon">🎊</div>
        <div class="celebration-icon">🌟</div>
      </div>
    </div>
  {/if}
</div>

<style>
  .victory-celebration-container {
    width: 100%;
    min-height: 400px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    padding: 2rem;
  }

  /* Confetti Phase */
  .confetti-phase {
    width: 100%;
    height: 100%;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .confetti-particle {
    position: absolute;
    width: 12px;
    height: 12px;
    background: var(--color);
    left: var(--x);
    top: var(--y);
    border-radius: 2px;
    animation: fall var(--duration) linear var(--delay) forwards;
    opacity: 0;
  }

  @keyframes fall {
    0% {
      opacity: 1;
      transform: translateY(0) rotate(0deg);
    }
    100% {
      opacity: 0;
      transform: translateY(600px) rotate(720deg);
    }
  }

  .celebration-text-large {
    font-size: 8rem;
    animation: bounce 0.6s ease-in-out infinite;
  }

  @keyframes bounce {
    0%, 100% {
      transform: translateY(0) scale(1);
    }
    50% {
      transform: translateY(-20px) scale(1.1);
    }
  }

  /* Trophy Phase */
  .trophy-phase {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    animation: scaleIn 0.5s ease-out;
  }

  .trophy-icon {
    font-size: 10rem;
    animation: rotateScale 1s ease-in-out;
  }

  @keyframes rotateScale {
    0% {
      transform: rotate(-180deg) scale(0);
    }
    100% {
      transform: rotate(0deg) scale(1);
    }
  }

  .victory-title {
    font-size: 3rem;
    font-weight: 700;
    color: #1a1a4e;
    margin-top: 1rem;
    animation: fadeInUp 0.5s ease-out 0.3s both;
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes scaleIn {
    from {
      transform: scale(0);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  /* Final Celebration Phase */
  .celebrate-phase {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.5s ease-out;
  }

  .trophy-large {
    font-size: 12rem;
    animation: pulse 2s ease-in-out infinite;
    filter: drop-shadow(0 10px 30px rgba(255, 215, 0, 0.5));
  }

  @keyframes pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }

  .champion-title {
    font-size: 3.5rem;
    font-weight: 700;
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin: 1.5rem 0;
    text-align: center;
    animation: fadeInUp 0.6s ease-out 0.2s both;
  }

  .cup-name {
    font-size: 1.5rem;
    color: rgba(26, 26, 78, 0.8);
    margin-bottom: 2rem;
    animation: fadeInUp 0.6s ease-out 0.4s both;
  }

  .celebration-icons {
    display: flex;
    gap: 2rem;
    margin-top: 1rem;
    animation: fadeInUp 0.6s ease-out 0.6s both;
  }

  .celebration-icon {
    font-size: 3rem;
    animation: float 2s ease-in-out infinite;
  }

  .celebration-icon:nth-child(1) {
    animation-delay: 0s;
  }
  .celebration-icon:nth-child(2) {
    animation-delay: 0.2s;
  }
  .celebration-icon:nth-child(3) {
    animation-delay: 0.4s;
  }
  .celebration-icon:nth-child(4) {
    animation-delay: 0.6s;
  }

  @keyframes float {
    0%, 100% {
      transform: translateY(0) rotate(0deg);
    }
    50% {
      transform: translateY(-15px) rotate(10deg);
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>

