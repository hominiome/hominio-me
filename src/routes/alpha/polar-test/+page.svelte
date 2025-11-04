<script>
  import { authClient } from "$lib/auth.client.js";
  import { onMount } from "svelte";
  import { env } from "$env/dynamic/public";

  let loading = false;
  let error = null;
  let session = null;
  
  // Get product ID from environment variable
  const productId = env.PUBLIC_POLAR_PRODUCT_ID_1 || "aa8e6119-7f7f-4ce3-abde-666720be9fb3";

  onMount(async () => {
    // Get current session
    const result = await authClient.getSession();
    session = result.data;
  });

  async function startCheckout() {
    loading = true;
    error = null;

    try {
      // Trigger checkout using the slug we configured
      await authClient.checkout({
        slug: "I-am-Hominio",
      });
      // Note: The checkout will redirect the user, so we won't reach here
    } catch (err) {
      console.error("Checkout error:", err);
      error = err.message || "Failed to start checkout";
      loading = false;
    }
  }

  async function startCheckoutByProductId() {
    loading = true;
    error = null;

    try {
      // Alternative: Trigger checkout using product ID directly
      await authClient.checkout({
        products: [productId],
      });
      // Note: The checkout will redirect the user, so we won't reach here
    } catch (err) {
      console.error("Checkout error:", err);
      error = err.message || "Failed to start checkout";
      loading = false;
    }
  }
</script>

<div class="container mx-auto px-4 py-8 max-w-2xl">
  <h1 class="text-3xl font-bold mb-6">Polar Checkout Test</h1>

  {#if !session?.user}
    <div class="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-6">
      <p class="font-semibold">⚠️ Authentication Required</p>
      <p>You need to be logged in to test the checkout flow.</p>
      <a href="/alpha/signup" class="text-blue-600 underline mt-2 inline-block">
        Sign up or log in
      </a>
    </div>
  {:else}
    <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
      <p class="font-semibold">✅ Logged in as: {session.user.email || session.user.name}</p>
    </div>
  {/if}

  <div class="bg-white shadow-md rounded-lg p-6 mb-6">
    <h2 class="text-xl font-semibold mb-4">Test Checkout</h2>
    <p class="text-gray-600 mb-4">
      Click the button below to start a Polar checkout flow for the product "I-am-Hominio".
    </p>

    {#if error}
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
        <p class="font-semibold">Error:</p>
        <p>{error}</p>
      </div>
    {/if}

    <div class="flex gap-4">
      <button
        on:click={startCheckout}
        disabled={loading || !session?.user}
        class="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition-colors"
      >
        {#if loading}
          Starting Checkout...
        {:else}
          Start Checkout (by Slug)
        {/if}
      </button>

      <button
        on:click={startCheckoutByProductId}
        disabled={loading || !session?.user}
        class="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition-colors"
      >
        {#if loading}
          Starting Checkout...
        {:else}
          Start Checkout (by Product ID)
        {/if}
      </button>
    </div>
  </div>

  <div class="bg-gray-50 rounded-lg p-6">
    <h3 class="font-semibold mb-2">Checkout Configuration:</h3>
    <ul class="list-disc list-inside space-y-1 text-sm text-gray-600">
      <li>Product ID: <code class="bg-gray-200 px-1 rounded">{productId}</code></li>
      <li>Slug: <code class="bg-gray-200 px-1 rounded">I-am-Hominio</code></li>
      <li>Success URL: <code class="bg-gray-200 px-1 rounded">/alpha/polar-test/success</code></li>
      <li>Authenticated Users Only: <code class="bg-gray-200 px-1 rounded">true</code></li>
    </ul>
  </div>
</div>

