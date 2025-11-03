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
    "aria-label"?: string;
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
    "aria-label": ariaLabel,
    ...restProps
  }: Props = $props();

  // Merge config with props (config takes precedence)
  const effectiveVariant = config?.variant || variant;
  const effectiveSize = config?.size || size;
  const glassIntensity = config?.glassIntensity || "medium";

  // Base classes
  const baseClasses =
    "inline-flex items-center justify-center font-semibold transition-all duration-200 border-2 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-xl";

  // Cursor class - disabled overrides pointer
  const cursorClass = $derived(
    disabled ? "cursor-not-allowed" : "cursor-pointer"
  );

  // Size classes
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-5 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  // Check if this is an icon-only button (no children content)
  const isIconOnly = $derived(!children);

  // Variant classes with glass effects - using semantic color classes
  // Primary = Marine Blue, Secondary = Teal, Accent = Yellow
  // All solid buttons use super light (100/200) text color matching their background
  // Hover states use outline style (transparent bg with colored border/text)
  const variantClasses: Record<ButtonVariant, string> = {
    primary: `bg-primary-500 text-primary-100 border-primary-500 hover:bg-transparent hover:border-primary-500 hover:text-primary-500 focus:ring-primary-500 backdrop-blur-sm`,
    secondary: `bg-secondary-500 text-secondary-100 border-secondary-500 hover:bg-transparent hover:border-secondary-500 hover:text-secondary-500 focus:ring-secondary-500 backdrop-blur-sm`,
    success: `bg-success-500 text-success-100 border-success-500 hover:bg-transparent hover:border-success-500 hover:text-success-500 focus:ring-success-500`,
    info: `bg-info-500 text-info-100 border-info-500 hover:bg-transparent hover:border-info-500 hover:text-info-500 focus:ring-info-500`,
    warning: `bg-warning-500 text-warning-100 border-warning-500 hover:bg-transparent hover:border-warning-500 hover:text-warning-500 focus:ring-warning-500`,
    alert: `bg-alert-500 text-alert-100 border-alert-500 hover:bg-transparent hover:border-alert-500 hover:text-alert-500 focus:ring-alert-500`,
    outline: `bg-secondary-500 text-secondary-100 border-secondary-500 hover:bg-transparent hover:border-secondary-500 hover:text-secondary-500 focus:ring-secondary-500 backdrop-blur-sm`,
    inverted: `bg-white/70 border border-white/40 text-primary-900 hover:bg-white/90 hover:border-white/60 focus:ring-primary-500`,
    footer: `bg-transparent text-secondary-100 hover:text-secondary-50 hover:bg-secondary-500/10 focus:ring-secondary-500 transition-all duration-200 rounded-xl flex flex-col items-center justify-center gap-1 px-3 py-2 border-transparent`,
  };

  // Glass intensity adjustments (backdrop blur)
  const glassClasses = {
    light: "backdrop-blur-sm",
    medium: "backdrop-blur-md",
    heavy: "backdrop-blur-lg",
  };

  // Get icon color based on variant
  const iconColor = $derived(() => {
    if (
      ["primary", "success", "info", "warning", "alert"].includes(
        effectiveVariant
      )
    ) {
      return "currentColor"; // Inherit white text color
    }
    return "currentColor"; // Inherit text color for all variants
  });

  const fullWidthClass = fullWidth ? "w-full" : "";

  // Disabled state classes - variant-specific styling
  const disabledClasses = $derived(() => {
    if (!disabled) return "";

    // Variant-specific disabled styles - use !important to override hover states
    switch (effectiveVariant) {
      case "secondary":
        return "!bg-secondary-500 !border-secondary-500 !text-secondary-300 opacity-60 cursor-not-allowed hover:!bg-secondary-500 hover:!border-secondary-500 hover:!text-secondary-300";
      case "alert":
        return "!bg-alert-500 !border-alert-500 !text-alert-300 opacity-60 cursor-not-allowed hover:!bg-alert-500 hover:!border-alert-500 hover:!text-alert-300";
      default:
        return "opacity-50 cursor-not-allowed";
    }
  });

  // For icon-only buttons, reduce padding
  const iconOnlyPadding = $derived(isIconOnly ? "!px-2" : "");

  const buttonClasses = $derived(
    `${baseClasses} ${sizeClasses[effectiveSize]} ${variantClasses[effectiveVariant]} ${glassClasses[glassIntensity]} ${fullWidthClass} ${cursorClass} ${disabledClasses()} ${iconOnlyPadding} ${config?.customClasses || ""} ${className}`
  );
</script>

<button
  {type}
  class={buttonClasses}
  {onclick}
  {disabled}
  aria-label={ariaLabel}
  {...restProps}
>
  {#if icon && iconPosition === "left"}
    <Icon
      name={icon}
      size="sm"
      color={iconColor()}
      class={children ? "mr-1.5" : ""}
    />
  {/if}
  {#if children}
    {@render children()}
  {/if}
  {#if icon && iconPosition === "right"}
    <Icon
      name={icon}
      size="sm"
      color={iconColor()}
      class={children ? "ml-1.5" : ""}
    />
  {/if}
</button>
