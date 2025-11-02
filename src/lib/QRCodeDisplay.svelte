<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";

  let { data } = $props<{ data: string }>();
  let qrContainer: HTMLDivElement | null = $state(null);
  let qrCode: any = $state(null);
  let qrSize = $state(500);

  // Calculate responsive size based on viewport width
  const calculateSize = () => {
    if (!browser) return 500;
    const viewportWidth = window.innerWidth;
    // Use 80% of viewport width on mobile, max 500px on desktop
    const maxSize = Math.min(viewportWidth * 0.8, 500);
    // Ensure minimum size for readability
    return Math.max(maxSize, 250);
  };

  // QR code settings
  const getQrSettings = (size: number) => ({
    type: "canvas" as const,
    shape: "square" as const,
    width: size,
    height: size,
    margin: 5,
    data: data,
    qrOptions: {
      typeNumber: "0",
      mode: "Byte",
      errorCorrectionLevel: "Q",
    },
    imageOptions: {
      saveAsBlob: true,
      hideBackgroundDots: true,
      imageSize: 0.5,
      margin: 14,
    },
    dotsOptions: {
      type: "extra-rounded",
      color: "#200a4b",
      roundSize: true,
    },
    backgroundOptions: {
      round: 0,
      color: "#ffffff",
    },
    cornersSquareOptions: {
      type: "dot",
      color: "#259fa6",
    },
    cornersDotOptions: {
      type: "dot",
      color: "#200a4b",
    },
    image: browser ? `${window.location.origin}/logo_clean.png` : "",
  });

  let resizeHandler: (() => void) | null = null;

  onMount(async () => {
    if (!qrContainer || !browser) return;

    // Dynamically import QRCodeStyling only in browser
    const { default: QRCodeStyling } = await import("qr-code-styling");

    // Calculate initial size
    qrSize = calculateSize();

    // Create QR code with calculated size
    qrCode = new QRCodeStyling(getQrSettings(qrSize));
    qrCode.append(qrContainer);

    // Handle window resize - update QR code size dynamically
    resizeHandler = () => {
      if (!qrCode || !qrContainer) return;
      const newSize = calculateSize();
      if (newSize !== qrSize) {
        qrSize = newSize;
        // Update QR code with new size using the library's update method
        qrCode.update({
          width: qrSize,
          height: qrSize,
        });
      }
    };

    window.addEventListener("resize", resizeHandler);
  });

  onDestroy(() => {
    if (resizeHandler) {
      window.removeEventListener("resize", resizeHandler);
    }
  });

  $effect(() => {
    if (qrCode && data && browser && qrContainer) {
      const currentSize = qrSize;
      // Update data without changing size
      qrCode.update({ data });
    }
  });
</script>

<div bind:this={qrContainer} class="qr-container"></div>

<style>
  .qr-container {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }
</style>

