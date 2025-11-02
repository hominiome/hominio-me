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

    // Get the full URL for the logo image
    const imageUrl = browser ? `${window.location.origin}/logo_clean.png` : "";

    // Create QR code with settings
    qrCode = new QRCodeStyling({
      type: qrSettings.type,
      shape: qrSettings.shape,
      width: qrSettings.width,
      height: qrSettings.height,
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
  }
</style>

