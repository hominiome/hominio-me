<script>
  import { onMount } from "svelte";
  import { page } from "$app/stores";

  let checkoutId = null;
  let loading = true;

  onMount(() => {
    // Get checkout_id from URL query params
    const urlParams = new URLSearchParams(window.location.search);
    checkoutId = urlParams.get("checkout_id");
    loading = false;
  });
</script>

<div class="container mx-auto px-4 py-8 max-w-2xl">
  <div class="bg-white shadow-md rounded-lg p-8 text-center">
    <div class="mb-6">
      <svg
        class="mx-auto h-16 w-16 text-green-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    </div>

    <h1 class="text-3xl font-bold mb-4 text-green-600">Checkout Successful!</h1>

    {#if loading}
      <p class="text-gray-600">Loading checkout details...</p>
    {:else if checkoutId}
      <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <p class="text-sm text-gray-600 mb-2">Checkout ID:</p>
        <p class="font-mono text-lg font-semibold text-green-700">{checkoutId}</p>
      </div>

      <p class="text-gray-600 mb-6">
        Your checkout was completed successfully. Check your email for confirmation and check the
        server logs for webhook events.
      </p>

      <div class="flex gap-4 justify-center">
        <a
          href="/alpha/polar-test"
          class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          Test Another Checkout
        </a>
        <a
          href="/alpha"
          class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors"
        >
          Go Home
        </a>
      </div>
    {:else}
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p class="text-yellow-800">
          ⚠️ No checkout ID found in URL. You may have arrived here directly.
        </p>
      </div>

      <a
        href="/alpha/polar-test"
        class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors inline-block"
      >
        Start Checkout
      </a>
    {/if}
  </div>

  <div class="mt-6 bg-gray-50 rounded-lg p-6">
    <h3 class="font-semibold mb-2">What happened:</h3>
    <ol class="list-decimal list-inside space-y-2 text-sm text-gray-600">
      <li>You clicked "Start Checkout" on the test page</li>
      <li>You were redirected to Polar's checkout page</li>
      <li>You completed the payment (or used test mode)</li>
      <li>Polar redirected you back to this success page</li>
      <li>Polar sent webhook events to your server (check console logs)</li>
    </ol>
  </div>
</div>

