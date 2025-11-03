<script lang="ts">
  import Icon from "@iconify/svelte";

  interface Props {
    name: string;
    size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
    color?: string;
    class?: string;
  }

  let { name, size = "md", color, class: className = "" }: Props = $props();

  const sizeMap = {
    xs: 12,
    sm: 16,
    md: 20,
    lg: 24,
    xl: 32,
  };

  const iconSize = typeof size === "number" ? size : sizeMap[size];
</script>

<Icon icon={name} width={iconSize} height={iconSize} color={color} class={className} />

