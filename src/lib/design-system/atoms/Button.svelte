<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { ComponentProps } from "svelte";

  type ButtonVariant =
    | "primary"
    | "secondary"
    | "success"
    | "info"
    | "warning"
    | "alert"
    | "outline"
    | "inverted"
    | "footer";

  type ButtonSize = "sm" | "md" | "lg";

  interface ButtonConfig {
    variant?: ButtonVariant;
    size?: ButtonSize;
    glassIntensity?: "light" | "medium" | "heavy";
    customClasses?: string;
  }

  interface Props {
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: string;
    iconPosition?: "left" | "right";
    fullWidth?: boolean;
    disabled?: boolean;
    config?: ButtonConfig;
    class?: string;
    children?: import("svelte").Snippet;
    onclick?: (e: MouseEvent) => void;
    type?: "button" | "submit" | "reset";
  }

  let {
    variant = "primary",
    size = "md",
    icon,
    iconPosition = "left",
    fullWidth = false,
    disabled = false,
    config,
    class: className = "",
    children,
    onclick,
    type = "button",
    ...restProps
  }: Props = $props();

  // Merge config with props (config takes precedence)
  const effectiveVariant = config?.variant || variant;
  const effectiveSize = config?.size || size;
  const glassIntensity = config?.glassIntensity || "medium";

  // Base classes
  const baseClasses =
    "inline-flex items-center justify-center font-semibold transition-all duration-200 cursor-pointer border-none focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl";

  // Size classes
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  // Variant classes with glass effects - using semantic color classes
  // Primary = Marine Blue, Secondary = Teal, Accent = Yellow
  // All solid buttons use super light (100/200) text color matching their background
  const variantClasses: Record<ButtonVariant, string> = {
    primary: `bg-primary-500 text-primary-100 hover:bg-primary-600 hover:text-primary-50 focus:ring-primary-500 shadow-lg shadow-primary-500/40 hover:shadow-xl hover:shadow-primary-500/50 hover:-translate-y-0.5 backdrop-blur-sm`,
    secondary: `bg-secondary-500 text-secondary-100 hover:bg-secondary-600 hover:text-secondary-50 focus:ring-secondary-500 shadow-lg shadow-secondary-500/40 hover:shadow-xl hover:shadow-secondary-500/50 hover:-translate-y-0.5 backdrop-blur-sm`,
    success: `bg-success-500 text-success-100 hover:bg-success-600 hover:text-success-50 focus:ring-success-500 shadow-lg shadow-success-500/30 hover:shadow-xl hover:shadow-success-500/40 hover:-translate-y-0.5`,
    info: `bg-info-500 text-info-100 hover:bg-info-600 hover:text-info-50 focus:ring-info-500 shadow-lg shadow-info-500/30 hover:shadow-xl hover:shadow-info-500/40 hover:-translate-y-0.5`,
    warning: `bg-warning-500 text-warning-100 hover:bg-warning-600 hover:text-warning-50 focus:ring-warning-500 shadow-lg shadow-warning-500/30 hover:shadow-xl hover:shadow-warning-500/40 hover:-translate-y-0.5`,
    alert: `bg-alert-500 text-alert-100 hover:bg-alert-600 hover:text-alert-50 focus:ring-alert-500 shadow-lg shadow-alert-500/30 hover:shadow-xl hover:shadow-alert-500/40 hover:-translate-y-0.5`,
    outline: `bg-secondary-500 text-secondary-100 hover:bg-secondary-600 hover:text-secondary-50 focus:ring-secondary-500 shadow-lg shadow-secondary-500/40 hover:shadow-xl hover:shadow-secondary-500/50 hover:-translate-y-0.5 backdrop-blur-sm`,
    inverted: `bg-white/70 border border-white/40 text-primary-900 hover:bg-white/90 hover:border-white/60 focus:ring-primary-500 shadow-lg hover:shadow-xl hover:-translate-y-0.5`,
    footer: `bg-transparent text-secondary-100 hover:text-secondary-50 hover:bg-secondary-500/10 focus:ring-secondary-500 transition-all duration-200 rounded-xl flex flex-col items-center justify-center gap-1 px-3 py-2`,
  };

  // Glass intensity adjustments (backdrop blur)
  const glassClasses = {
    light: "backdrop-blur-sm",
    medium: "backdrop-blur-md",
    heavy: "backdrop-blur-lg",
  };

  // Get icon color based on variant
  const iconColor = $derived(() => {
    if (["primary", "success", "info", "warning", "alert"].includes(effectiveVariant)) {
      return "currentColor"; // Inherit white text color
    }
    return "currentColor"; // Inherit text color for all variants
  });

  const fullWidthClass = fullWidth ? "w-full" : "";
  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";

  const buttonClasses = `${baseClasses} ${sizeClasses[effectiveSize]} ${variantClasses[effectiveVariant]} ${glassClasses[glassIntensity]} ${fullWidthClass} ${disabledClass} ${config?.customClasses || ""} ${className}`;
</script>

<button
  type={type}
  class={buttonClasses}
  onclick={onclick}
  disabled={disabled}
  {...restProps}
>
  {#if icon && iconPosition === "left"}
    <Icon name={icon} size="sm" color={iconColor()} class="mr-1.5" />
  {/if}
  {#if children}
    {@render children()}
  {/if}
  {#if icon && iconPosition === "right"}
    <Icon name={icon} size="sm" color={iconColor()} class="ml-1.5" />
  {/if}
</button>

