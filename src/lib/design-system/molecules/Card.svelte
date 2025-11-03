<script lang="ts">
  interface CardConfig {
    variant?: "default" | "elevated" | "floating";
    glassIntensity?: "light" | "medium" | "heavy";
    customClasses?: string;
  }

  interface Props {
    variant?: "default" | "elevated" | "floating";
    glassIntensity?: "light" | "medium" | "heavy";
    config?: CardConfig;
    class?: string;
    children?: import("svelte").Snippet;
  }

  let {
    variant = "default",
    glassIntensity = "medium",
    config,
    class: className = "",
    children,
  }: Props = $props();

  const effectiveVariant = config?.variant || variant;
  const effectiveGlassIntensity = config?.glassIntensity || glassIntensity;

  const baseClasses =
    "rounded-2xl border transition-all duration-300 overflow-hidden";

  const variantClasses = {
    default:
      "bg-white border-2 border-brand-navy-500/6 hover:border-brand-teal-500/40 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(78,205,196,0.15)]",
    elevated:
      "bg-white border-2 border-brand-navy-500/6 hover:border-brand-teal-500/40 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(78,205,196,0.15)]",
    floating:
      "bg-white border-2 border-brand-navy-500/6 hover:border-brand-teal-500/40 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(78,205,196,0.15)]",
  };

  const glassClasses = {
    light: "",
    medium: "",
    heavy: "",
  };

  const cardClasses = `${baseClasses} ${variantClasses[effectiveVariant]} ${glassClasses[effectiveGlassIntensity]} ${config?.customClasses || ""} ${className}`;
</script>

<div class={cardClasses}>
  {#if children}
    {@render children()}
  {/if}
</div>
