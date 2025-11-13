<script lang="ts">
  interface Props {
    title: string;
    subtitle?: string;
    size?: "sm" | "md" | "lg"; // sm = projects size, md = live size, lg = champions size
  }

  let { title, subtitle, size = "md" }: Props = $props();

  const sizeClasses = {
    sm: {
      title: "text-2xl @md:text-3xl", // Projects size - more compact
      subtitle: "text-xs @md:text-sm",
    },
    md: {
      title: "text-3xl @md:text-4xl", // Live size - more compact
      subtitle: "text-sm @md:text-base",
    },
    lg: {
      title: "text-3xl @md:text-4xl @lg:text-5xl", // Champions size - more compact
      subtitle: "text-sm @md:text-base",
    },
  };

  const classes = sizeClasses[size];
</script>

<div class="text-center flex-1">
  <h1 class="{classes.title} font-bold text-brand-navy-700 mb-1">
    {title}
  </h1>
  {#if subtitle}
    <p class="{classes.subtitle} text-primary-700/70">
      {subtitle}
    </p>
  {/if}
</div>
