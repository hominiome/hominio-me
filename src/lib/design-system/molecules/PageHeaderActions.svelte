<script lang="ts">
  interface Props {
    children?: import("svelte").Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="shrink-0">
  {#if children}
    {@render children()}
  {/if}
</div>
