<script>
  import { onMount, onDestroy } from "svelte";

  let { endDate = "", displayFormat = "full" } = $props();

  let timeRemaining = $state("");
  let intervalId = null;

  function calculateTimeRemaining() {
    if (!endDate) {
      timeRemaining = "";
      return;
    }

    const now = new Date();
    const end = new Date(endDate);

    if (end <= now) {
      timeRemaining = "Ended";
      return;
    }

    const diff = end - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (displayFormat === "compact") {
      // Format: h m s (no words, just numbers and spaces)
      const parts = [];
      if (days > 0) {
        parts.push(`${days * 24 + hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0 && parts.length < 2) parts.push(`${seconds}s`);
      } else {
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (seconds > 0) parts.push(`${seconds}s`);
      }
      timeRemaining = parts.join(" ");
    } else {
      const parts = [];
      if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
      if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
      if (minutes > 0)
        parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
      if (parts.length === 0)
        parts.push(`${seconds} second${seconds !== 1 ? "s" : ""}`);
      timeRemaining = parts.join(", ");
    }
  }

  onMount(() => {
    calculateTimeRemaining();
    intervalId = setInterval(calculateTimeRemaining, 1000);
  });

  onDestroy(() => {
    if (intervalId) {
      clearInterval(intervalId);
    }
  });

  // Recalculate when endDate changes
  $effect(() => {
    calculateTimeRemaining();
  });
</script>

{#if timeRemaining}
  <span class="countdown-timer" class:ended={timeRemaining === "Ended"}>
    {timeRemaining}
  </span>
{/if}

<style>
  .countdown-timer {
    font-weight: 600;
    color: #4ecdc4;
    font-size: 0.875rem;
  }

  .countdown-timer.ended {
    color: rgba(26, 26, 78, 0.5);
  }
</style>
