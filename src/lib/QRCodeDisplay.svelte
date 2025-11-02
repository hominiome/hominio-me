<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";

  let { data } = $props<{ data: string }>();
  let qrContainer: HTMLDivElement | null = $state(null);
  let qrCode: any = $state(null);
  let qrSize = $state(500);

  // Calculate responsive size based on container or viewport width
  const calculateSize = () => {
    if (!browser) return 500;
    
    // Get container width if available, otherwise use viewport
    const containerWidth = qrContainer?.clientWidth || window.innerWidth;
    const viewportWidth = window.innerWidth;
    
    // Use container width if available, otherwise 80% of viewport
    const baseWidth = containerWidth > 0 ? containerWidth : viewportWidth * 0.8;
    
    // Use 80% of available width on mobile, max 500px on desktop
    const maxSize = Math.min(baseWidth * 0.95, 500);
    
    // Ensure minimum size for readability
    return Math.max(maxSize, 250);
  };

  // QR code settings - account for device pixel ratio for crisp rendering
  const getQrSettings = (displaySize: number) => {
    if (!browser) {
      return {
        type: "canvas" as const,
        shape: "square" as const,
        width: displaySize,
        height: displaySize,
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
        image: "",
      };
    }

    // Get device pixel ratio for high-DPI displays
    const dpr = window.devicePixelRatio || 1;
    
    // Render at higher resolution for crisp display on retina screens
    const renderSize = Math.round(displaySize * dpr);
    
    return {
      type: "canvas" as const,
      shape: "square" as const,
      width: renderSize,
      height: renderSize,
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
      image: `${window.location.origin}/logo_clean.png`,
    };
  };

  let resizeHandler: (() => void) | null = null;

  onMount(async () => {
    if (!qrContainer || !browser) return;

    // Dynamically import QRCodeStyling only in browser
    const { default: QRCodeStyling } = await import("qr-code-styling");

    // Wait a tick to ensure container has dimensions
    await new Promise(resolve => setTimeout(resolve, 0));

    // Calculate initial size
    qrSize = calculateSize();

    // Create QR code with calculated size
    qrCode = new QRCodeStyling(getQrSettings(qrSize));
    qrCode.append(qrContainer);

    // Scale canvas CSS to display size (rendered at higher DPR resolution)
    const canvas = qrContainer.querySelector('canvas');
    if (canvas) {
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${qrSize}px`;
      canvas.style.height = `${qrSize}px`;
    }

    // Handle window resize - update QR code size dynamically
    resizeHandler = () => {
      if (!qrCode || !qrContainer) return;
      const newSize = calculateSize();
      if (Math.abs(newSize - qrSize) > 1) { // Only update if size changed significantly
        qrSize = newSize;
        
        // Update QR code with new size
        const settings = getQrSettings(qrSize);
        qrCode.update({
          width: settings.width,
          height: settings.height,
        });

        // Update canvas CSS scaling
        const canvas = qrContainer.querySelector('canvas');
        if (canvas) {
          canvas.style.width = `${qrSize}px`;
          canvas.style.height = `${qrSize}px`;
        }
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
      // Update data without changing size
      qrCode.update({ data });
      
      // Ensure canvas is properly scaled after update
      setTimeout(() => {
        const canvas = qrContainer?.querySelector('canvas');
        if (canvas) {
          canvas.style.width = `${qrSize}px`;
          canvas.style.height = `${qrSize}px`;
        }
      }, 0);
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

