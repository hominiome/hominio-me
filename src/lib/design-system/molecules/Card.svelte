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
    children?: any;
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
    default: "bg-white border-2 border-brand-navy-500/6 shadow-md hover:shadow-lg hover:-translate-y-0.5",
    elevated:
      "bg-white border-2 border-brand-navy-500/10 shadow-lg hover:shadow-xl hover:-translate-y-1",
    floating:
      "bg-white border-2 border-brand-navy-500/8 shadow-xl hover:shadow-2xl hover:-translate-y-1.5",
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
    {children}
  {/if}
</div>

