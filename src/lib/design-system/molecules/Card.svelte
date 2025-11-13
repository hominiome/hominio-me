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

  // Base classes following UX Planet principles: rounded corners, soft shadows, whitespace
  const baseClasses =
    "rounded-2xl transition-all duration-300 overflow-hidden";

  // Variant classes with brand colors and organic shadows (not pure black)
  const variantClasses = {
    default:
      "bg-white border border-brand-navy-200/60 shadow-[0_2px_8px_rgba(8,27,71,0.06)] hover:border-secondary-300/60 hover:shadow-[0_8px_24px_rgba(45,166,180,0.12),0_2px_8px_rgba(45,166,180,0.08)] hover:-translate-y-1",
    elevated:
      "bg-white border border-brand-navy-200/60 shadow-[0_4px_16px_rgba(8,27,71,0.08)] hover:border-secondary-300/60 hover:shadow-[0_12px_32px_rgba(45,166,180,0.15),0_4px_12px_rgba(45,166,180,0.1)] hover:-translate-y-1.5",
    floating:
      "bg-white border border-brand-navy-200/40 shadow-[0_8px_32px_rgba(8,27,71,0.12),0_2px_8px_rgba(8,27,71,0.06)] hover:border-secondary-300/60 hover:shadow-[0_16px_48px_rgba(45,166,180,0.18),0_4px_16px_rgba(45,166,180,0.12)] hover:-translate-y-2",
  };

  const glassClasses = {
    light: "backdrop-blur-sm bg-white/95",
    medium: "backdrop-blur-md bg-white/90",
    heavy: "backdrop-blur-lg bg-white/85",
  };

  const cardClasses = `${baseClasses} ${variantClasses[effectiveVariant]} ${glassClasses[effectiveGlassIntensity]} ${config?.customClasses || ""} ${className}`;
</script>

<div class={cardClasses}>
  {#if children}
    {@render children()}
  {/if}
</div>
