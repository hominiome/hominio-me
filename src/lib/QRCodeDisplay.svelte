<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";

  let { data } = $props<{ data: string }>();
  let qrContainer: HTMLDivElement | null = $state(null);
  let qrCode: any = $state(null);

  // QR code settings (copied from qr-code-settings.json, image removed)
  const qrSettings = {
    type: "canvas" as const,
    shape: "square" as const,
    width: 500,
    height: 500,
    margin: 5,
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
  };

  onMount(async () => {
    if (!qrContainer || !browser) return;

    // Dynamically import QRCodeStyling only in browser
    const { default: QRCodeStyling } = await import("qr-code-styling");

    // Calculate responsive size based on viewport width
    const calculateSize = () => {
      const viewportWidth = window.innerWidth;
      // Use 80% of viewport width on mobile, max 500px on desktop
      const maxSize = Math.min(viewportWidth * 0.8, 500);
      // Ensure minimum size for readability
      return Math.max(maxSize, 250);
    };

    const qrSize = calculateSize();

    // Get the full URL for the logo image
    const imageUrl = browser ? `${window.location.origin}/logo_clean.png` : "";

    // Create QR code with responsive settings
    qrCode = new QRCodeStyling({
      type: qrSettings.type,
      shape: qrSettings.shape,
      width: qrSize,
      height: qrSize,
      data: data,
      margin: qrSettings.margin,
      qrOptions: qrSettings.qrOptions,
      imageOptions: qrSettings.imageOptions,
      dotsOptions: qrSettings.dotsOptions,
      backgroundOptions: qrSettings.backgroundOptions,
      cornersSquareOptions: qrSettings.cornersSquareOptions,
      cornersDotOptions: qrSettings.cornersDotOptions,
      image: imageUrl,
    });

    qrCode.append(qrContainer);

    // Handle window resize for responsive updates
    const handleResize = () => {
      if (!qrCode || !qrContainer) return;
      const newSize = calculateSize();
      qrCode.update({
        width: newSize,
        height: newSize,
      });
    };

    window.addEventListener("resize", handleResize);
    
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  });

  $effect(() => {
    if (qrCode && data && browser) {
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
    max-width: 100%;
  }

  .qr-container :global(canvas) {
    max-width: 100%;
    height: auto;
    display: block;
  }

  @media (max-width: 768px) {
    .qr-container {
      padding: 0 1rem;
    }
  }

  @media (max-width: 480px) {
    .qr-container {
      padding: 0 0.5rem;
    }
  }
</style>

