<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { browser } from "$app/environment";
  import { goto } from "$app/navigation";

  let scannerId = "qr-scanner";
  let html5QrCode: any = $state(null);
  let scanning = $state(false);
  let error = $state<string | null>(null);

  onMount(async () => {
    if (!browser) return;

    try {
      // Dynamically import Html5Qrcode only in browser
      const { Html5Qrcode } = await import("html5-qrcode");
      html5QrCode = new Html5Qrcode(scannerId);
      await startScanning();
    } catch (err) {
      console.error("Failed to initialize scanner:", err);
      error = err instanceof Error ? err.message : "Failed to initialize scanner";
    }
  });

  async function startScanning() {
    if (!html5QrCode) return;

    try {
      // Request camera permission and start scanning
      await html5QrCode.start(
        { facingMode: "environment" }, // Use back camera
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          handleScanResult(decodedText);
        },
        (errorMessage) => {
          // Ignore parsing errors, they're normal
        }
      );
      scanning = true;
      error = null;
    } catch (err) {
      console.error("Failed to start scanning:", err);
      error = err instanceof Error ? err.message : "Failed to start camera";
      scanning = false;
    }
  }

  function handleScanResult(decodedText: string) {
    if (!html5QrCode) return;

    // Stop scanning
    html5QrCode.stop().then(() => {
      scanning = false;
    });

    // Try to parse as URL
    try {
      const url = new URL(decodedText);
      // Check if it's a user profile URL
      const userMatch = url.pathname.match(/\/alpha\/user\/([^\/]+)/);
      if (userMatch) {
        const userId = userMatch[1];
        goto(`/alpha/user/${userId}`);
      } else {
        // If it's a valid URL but not a user profile, navigate to it
        window.location.href = decodedText;
      }
    } catch {
      // If not a URL, try to navigate to it as a path
      if (decodedText.startsWith("/")) {
        goto(decodedText);
      } else {
        error = "Invalid QR code format";
        // Restart scanning after a delay
        setTimeout(() => {
          startScanning();
        }, 2000);
      }
    }
  }

  async function stopScanning() {
    if (html5QrCode && scanning) {
      try {
        await html5QrCode.stop();
        scanning = false;
      } catch (err) {
        console.error("Failed to stop scanning:", err);
      }
    }
  }

  onDestroy(() => {
    stopScanning();
  });
</script>

<div class="scanner-container">
  <div id={scannerId} class="scanner"></div>
  {#if error}
    <div class="error-message">
      <p>{error}</p>
      <button onclick={startScanning} class="retry-button">Retry</button>
    </div>
  {/if}
  {#if scanning}
    <div class="scanning-indicator">Scanning...</div>
  {/if}
</div>

<style>
  .scanner-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2rem;
  }

  .scanner {
    width: 100%;
    max-width: 500px;
    height: 500px;
    border-radius: 12px;
    overflow: hidden;
    border: 2px solid rgba(78, 205, 196, 0.3);
  }

  .error-message {
    text-align: center;
    padding: 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #dc2626;
  }

  .error-message p {
    margin: 0 0 0.5rem 0;
  }

  .retry-button {
    background: #1a1a4e;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }

  .retry-button:hover {
    background: #4ecdc4;
    transform: translateY(-1px);
  }

  .scanning-indicator {
    padding: 0.5rem 1rem;
    background: rgba(78, 205, 196, 0.1);
    border: 1px solid rgba(78, 205, 196, 0.3);
    border-radius: 8px;
    color: #1a1a4e;
    font-weight: 600;
  }
</style>

