<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { useZero } from "$lib/zero-utils";
  import { page } from "$app/stores";
  import { calculatePrizePool, formatPrizePool } from "$lib/prizePoolUtils.js";
  import CupHeader from "$lib/CupHeader.svelte";

  const zeroContext = useZero();
  const session = authClient.useSession();
  
  // Get return URL and cupId from query parameters
  const returnUrl = $derived(
    $page.url.searchParams.get("returnUrl") || "/alpha"
  );
  const cupIdFromQuery = $derived($page.url.searchParams.get("cupId") || "");
  

  // Package definitions
  const packages = [
    {
      packageType: "hominio",
      votingWeight: 1,
      name: "I am Hominio",
      price: 1,
      description: "",
    },
    {
      packageType: "founder",
      votingWeight: 5,
      name: "Hominio Founder",
      price: 10,
      description: "",
    },
    {
      packageType: "angel",
      votingWeight: 10,
      name: "Hominio Angel",
      price: 100,
      description: "",
    },
  ];

  let zero: any = null;
  let cups = $state<any[]>([]);
  let selectedCupId = $state<string>("");
  let selectedCup = $state<any>(null);
  let userIdentity = $state<any>(null);
  let purchases = $state<any[]>([]); // For prize pool calculation
  let matches = $state<any[]>([]); // For round info and countdown
  let loading = $state(true);
  let purchasing = $state(false);
  let successMessage = $state("");
  let errorMessage = $state("");
  let purchaseSound = $state<HTMLAudioElement | null>(null);
  let purchaseAnimation = $state<{
    packageType: string;
    previousPool: number;
    increase: number;
    newPool: number;
  } | null>(null);
  
  // Get prize pool for selected cup
  function getPrizePoolForCup(cupId: string): string {
    const cupPurchases = purchases.filter((p) => p.cupId === cupId);
    return formatPrizePool(calculatePrizePool(cupPurchases));
  }
  
  // Get prize pool amount in cents for calculation
  function getPrizePoolAmount(cupId: string): number {
    const cupPurchases = purchases.filter((p) => p.cupId === cupId);
    return calculatePrizePool(cupPurchases);
  }
  
  // Format prize pool amount (for display in animation)
  function formatPrizePoolAmount(cents: number): string {
    const euros = Math.floor(cents / 100);
    return `${euros.toLocaleString('de-DE')}€`;
  }

  // PURCHASE ROUTE IS DISABLED - INVITE-ONLY MODE
  // Redirect all purchase page visits to invite-only page
  $effect(() => {
    goto("/alpha/invite-only");
  });

  // Redirect to home if not authenticated
  $effect(() => {
    if (!$session.isPending && !$session.data) {
      goto("/alpha");
    }
  });

  let identityView: any = null;
  let cupsView: any = null;

  // Reactive effect to select cup from query params when cups are loaded
  $effect(() => {
    if (cups.length > 0 && cupIdFromQuery) {
      const cup = cups.find((c: any) => c.id === cupIdFromQuery);
      if (cup) {
        selectedCupId = cupIdFromQuery;
        selectedCup = cup;
      } else {
        // Cup not found in query params, redirect back
        errorMessage = "Cup not found. Please try voting again.";
        setTimeout(() => {
          goto(returnUrl);
        }, 2000);
      }
    } else if (cups.length > 0 && !cupIdFromQuery) {
      // No cupId in query params, redirect back
      errorMessage = "No cup selected. Please try voting again.";
      setTimeout(() => {
        goto(returnUrl);
      }, 2000);
    }
    // Ensure loading is false once cups are available
    if (cups.length > 0) {
      loading = false;
    }
  });

  // Reactive effect to update identity query when cup changes
  $effect(() => {
    if (!zero || !selectedCupId || !$session.data?.user) return;

    const userId = $session.data.user.id;

    // Clean up previous identity view
    if (identityView) {
      identityView.destroy();
      identityView = null;
    }

    // Query user's identity for selected cup
    const identityQuery = zero.query.userIdentities
      .where("userId", "=", userId)
      .where("cupId", "=", selectedCupId);
    identityView = identityQuery.materialize();

    identityView.addListener((data: any) => {
      const identities = Array.from(data);
      if (identities.length > 0) {
        userIdentity = identities[0];
      } else {
        userIdentity = null;
      }
      // Only set loading to false if cups are already loaded
      if (cups.length > 0) {
        loading = false;
      }
    });
  });

  onMount(() => {
    (async () => {
      // Wait for Zero to be ready
      while (!zeroContext.isReady() || !zeroContext.getInstance()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      zero = zeroContext.getInstance();

      // Wait for session to load
      while ($session.isPending) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!$session.data?.user) {
        goto("/alpha");
        return;
      }

      // Preload purchase sound effect
      purchaseSound = new Audio("/purchase-effect.mp3");
      purchaseSound.preload = "auto";

      // Query all cups
      const cupsQuery = zero.query.cup.orderBy("createdAt", "desc");
      cupsView = cupsQuery.materialize();

      cupsView.addListener((data: any) => {
        cups = Array.from(data || []);
        // Cup selection is handled by reactive $effect above
        // Set loading to false once cups are loaded
        if (cups.length > 0) {
          loading = false;
        }
      });

      // Query all identity purchases for prize pool calculation
      const purchasesQuery = zero.query.identityPurchase;
      const purchasesView = purchasesQuery.materialize();

      purchasesView.addListener((data: any) => {
        purchases = Array.from(data || []);
      });

      // Query matches for the selected cup to get round info
      const matchesQuery = zero.query.cupMatch;
      const matchesView = matchesQuery.materialize();

      matchesView.addListener((data: any) => {
        matches = Array.from(data || []);
      });

    return () => {
      if (identityView) identityView.destroy();
        if (cupsView) cupsView.destroy();
        if (purchasesView) purchasesView.destroy();
        if (matchesView) matchesView.destroy();
    };
    })();
  });

  function canUpgradeTo(packageType: string): boolean {
    if (!selectedCupId) return false; // Must select a cup first
    if (!userIdentity) return true; // Can select any identity if none exists for this cup

    const currentType = userIdentity.identityType;
    if (currentType === packageType) return false; // Already has this identity

    // Valid upgrade paths
    if (currentType === "hominio" && (packageType === "founder" || packageType === "angel")) {
      return true;
    }
    if (currentType === "founder" && packageType === "angel") {
      return true;
    }

    return false; // Cannot downgrade
  }

  function getPackageStatus(packageType: string): "current" | "available" | "unavailable" {
    if (!userIdentity) return "available";
    if (userIdentity.identityType === packageType) return "current";
    if (canUpgradeTo(packageType)) return "available";
    return "unavailable";
  }

  async function purchasePackage(packageType: string) {
    if (purchasing) return;

    if (!selectedCupId) {
      errorMessage = "Please select a cup first.";
      setTimeout(() => {
        errorMessage = "";
      }, 3000);
      return;
    }

    if (!canUpgradeTo(packageType)) {
      errorMessage = "Upgrade only.";
      setTimeout(() => {
        errorMessage = "";
      }, 3000);
      return;
    }

    purchasing = true;
    successMessage = "";
    errorMessage = "";
    
    // Calculate previous prize pool before purchase
    const previousPoolAmount = getPrizePoolAmount(selectedCupId);
    
    // Find the package to get its price
    const pkg = packages.find((p) => p.packageType === packageType);
    const purchasePrice = pkg ? pkg.price * 100 : 0; // Price in cents

    try {
      const response = await fetch("/alpha/api/purchase-package", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packageType, cupId: selectedCupId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Purchase failed");
      }

      const result = await response.json();
      console.log("✅ Purchase successful:", result);

      successMessage = result.message || `Selected`;

      // Immediately update userIdentity to reflect the purchase for instant UI state change
      if (result.identity) {
        userIdentity = {
          id: userIdentity?.id || `temp-${Date.now()}`,
          userId: $session.data?.user?.id || "",
          cupId: selectedCupId,
          identityType: result.identity.identityType,
          votingWeight: result.identity.votingWeight,
          upgradedFrom: result.identity.upgradedFrom || null,
          selectedAt: new Date().toISOString(),
        };
      }

      // Also add the new purchase to the purchases array for prize pool calculation
      // This ensures the prize pool updates immediately in the UI
      const newPurchase = {
        id: `temp-${Date.now()}`,
        userId: $session.data?.user?.id || "",
        cupId: selectedCupId,
        identityType: packageType,
        price: purchasePrice,
        purchasedAt: new Date().toISOString(),
      };
      purchases = [...purchases, newPurchase];

      // Get purchase price (increase amount)
      const increase = purchasePrice;
      
      // Trigger purchase animation immediately with purchase price
      purchaseAnimation = {
        packageType,
        previousPool: previousPoolAmount,
        increase,
        newPool: previousPoolAmount + increase, // Calculate expected new total
      };
      
      // Clear animation after it completes (4 seconds total)
      setTimeout(() => {
        purchaseAnimation = null;
      }, 4000);

      // Play purchase sound effect
      if (purchaseSound) {
        try {
          purchaseSound.currentTime = 0; // Reset to beginning
          const playPromise = purchaseSound.play();
          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.warn("Could not play purchase sound:", error);
            });
          }
        } catch (error) {
          console.warn("Could not play purchase sound:", error);
        }
      }

      // Redirect back to return URL after successful purchase (5.5 seconds - 1 sec longer)
      setTimeout(() => {
        goto(returnUrl);
      }, 5500); // Give user time to see animation
    } catch (error) {
      console.error("Purchase failed:", error);
      errorMessage = error instanceof Error ? error.message : "Purchase failed. Please try again.";
      setTimeout(() => {
        errorMessage = "";
      }, 5000);
    } finally {
      purchasing = false;
    }
  }
</script>

<div class="min-h-screen bg-cream p-4 md:p-8">
  {#if $session.isPending || loading}
    <div class="flex items-center justify-center min-h-screen">
      <div class="card p-8">
        <p class="text-navy/70">Loading...</p>
      </div>
    </div>
  {:else if $session.data}
    <div class="max-w-5xl mx-auto">
      <!-- Header -->
      <div class="header-section mb-8 md:mb-12">
        <div>
          <h1 class="text-6xl font-bold text-navy mb-3">Choose Your Voting Weight</h1>
          {#if !userIdentity}
            <p class="text-navy/70 text-lg">
              Select your voting weight to participate.
            </p>
          {/if}
        </div>
      </div>

      <div class="space-y-6 md:space-y-8">
        <!-- Success Message -->
        {#if successMessage}
          <div
            class="bg-teal/10 border-2 border-teal text-teal px-6 py-4 rounded-xl text-center font-medium"
          >
            {successMessage}
          </div>
        {/if}

        <!-- Error Message -->
        {#if errorMessage}
          <div
            class="bg-red/10 border-2 border-red text-red px-6 py-4 rounded-xl text-center font-medium"
          >
            {errorMessage}
          </div>
        {/if}

        <!-- Cup Title Card -->
        {#if selectedCup}
          <CupHeader cup={selectedCup} {purchases} {matches} />
        {/if}

        <!-- Options -->
        <div>
          <div
            class="package-grid mb-6 md:mb-8"
          >
            {#each packages as pkg}
              {@const status = getPackageStatus(pkg.packageType)}
              {@const isCurrent = status === "current"}
              {@const isAvailable = status === "available"}
              {@const isUnavailable = status === "unavailable"}

              <div
                class="package-card"
                class:current-package={isCurrent}
                class:unavailable-package={isUnavailable}
              >
                  {#if purchaseAnimation && purchaseAnimation.packageType === pkg.packageType}
                    <!-- Prize Pool Increase Overlay Animation -->
                    <div class="purchase-overlay">
                      <div class="purchase-overlay-content">
                        <div class="purchase-overlay-section">
                          <span class="purchase-overlay-label">Prize Pool:</span>
                          <span class="purchase-overlay-amount previous">{formatPrizePoolAmount(purchaseAnimation.newPool)}</span>
                        </div>
                        <div class="purchase-overlay-section increase">
                          <span class="purchase-overlay-plus">+</span>
                          <span class="purchase-overlay-amount increase">{formatPrizePoolAmount(purchaseAnimation.increase)}</span>
                        </div>
                      </div>
                    </div>
                  {/if}

                <svg class="heart-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  />
                </svg>

                <div class="heart-count-wrapper">
                  <div class="heart-count">{pkg.votingWeight}</div>
                  <div class="heart-label">
                    vote{pkg.votingWeight > 1 ? "s" : ""}
                  </div>
                </div>

                <h3 class="package-name">{pkg.name}</h3>

                <div class="price">
                  €{pkg.price}
                </div>

                <button
                  onclick={() => purchasePackage(pkg.packageType)}
                  disabled={purchasing || isCurrent || isUnavailable || !selectedCupId}
                  class="buy-label"
                  class:current-label={isCurrent}
                  class:unavailable-label={isUnavailable}
                >
                {#if isCurrent}
                    Current
                {:else if isAvailable}
                    Select
                {:else}
                    Unavailable
                {/if}
              </button>
              </div>
            {/each}
          </div>

        </div>

        <!-- Back to Cups -->
        <div class="text-center">
          <a href="/alpha/cups" class="btn-primary px-8 py-3">
            ← Back to Cups
          </a>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Colors */
  :global(.bg-cream) {
    background-color: #faf9f6;
  }

  :global(.text-navy) {
    color: #1a1a4e;
  }

  :global(.text-teal) {
    color: #4ecdc4;
  }

  :global(.text-yellow) {
    color: #f4d03f;
  }

  :global(.bg-teal\/10) {
    background-color: rgba(78, 205, 196, 0.1);
  }

  :global(.bg-red\/10) {
    background-color: rgba(239, 68, 68, 0.1);
  }

  :global(.border-teal) {
    border-color: #4ecdc4;
  }

  :global(.border-red) {
    border-color: #ef4444;
  }

  /* Header Section */
  .header-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }


  /* Card */
  .card {
    background: white;
    border-radius: 16px;
    border: 1px solid rgba(26, 26, 78, 0.08);
    box-shadow: 0 2px 12px rgba(26, 26, 78, 0.06);
  }

  /* Package Card */
  .package-card {
    background: white;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 20px;
    padding: 1.4rem 1.6rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.3s;
    text-align: center;
    position: relative;
  }

  .package-card.current-package {
    background: linear-gradient(
      135deg,
      rgba(244, 208, 63, 0.15) 0%,
      rgba(78, 205, 196, 0.15) 100%
    );
    border-color: #f4d03f;
    border-width: 3px;
    opacity: 1;
  }

  .package-card.unavailable-package {
    opacity: 0.6;
  }

  .heart-icon {
    width: 2.75rem;
    height: 2.75rem;
    color: #f4d03f;
  }

  .heart-count-wrapper {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.25rem;
  }

  .heart-count {
    font-size: 2.5rem;
    font-weight: 900;
    color: #1a1a4e;
    line-height: 1;
  }

  .heart-label {
    font-size: 1rem;
    color: rgba(26, 26, 78, 0.6);
    font-weight: 600;
    margin-bottom: 0;
  }

  .package-name {
    font-size: 1.125rem;
    font-weight: 700;
    color: #1a1a4e;
    margin: 0.5rem 0;
    min-height: 2.5rem;
    display: flex;
    align-items: center;
  }

  /* Unused package-description style removed */

  .price {
    font-size: 2rem;
    font-weight: 800;
    color: #f4d03f;
    margin-top: auto;
    padding-top: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .buy-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #4ecdc4;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.5rem 1.5rem;
    border: 2px solid #4ecdc4;
    border-radius: 8px;
    transition: all 0.2s;
    cursor: pointer;
    background: transparent;
    width: 100%;
  }

  .buy-label:hover:not(:disabled) {
    background: #4ecdc4;
    color: white;
  }

  .buy-label:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .buy-label.current-label {
    background: #f4d03f;
    color: #1a1a4e;
    border-color: #f4d03f;
    cursor: default;
  }

  .buy-label.current-label:hover {
    background: #f4d03f;
    color: #1a1a4e;
  }

  .buy-label.unavailable-label {
    background: rgba(26, 26, 78, 0.1);
    color: rgba(26, 26, 78, 0.5);
    border-color: rgba(26, 26, 78, 0.2);
    cursor: not-allowed;
  }

  .buy-label.unavailable-label:hover {
    background: rgba(26, 26, 78, 0.1);
    color: rgba(26, 26, 78, 0.5);
  }

  /* Button */
  .btn-primary {
    background: #1a1a4e;
    color: white;
    border-radius: 12px;
    font-weight: 600;
    transition: all 0.2s ease;
    border: none;
    text-decoration: none;
    display: inline-block;
  }

  .btn-primary:hover {
    background: #4ecdc4;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.3);
  }

  /* Package Grid */
  .package-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  @media (max-width: 640px) {
    .package-grid {
      gap: 0.625rem;
    }
  }

  @media (min-width: 768px) {
    .package-grid {
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
    }
  }

  @media (max-width: 768px) {
    .header-section {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .header-section h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .package-card {
      padding: 0.875rem 1rem;
      flex-direction: row;
      align-items: center;
      text-align: left;
      gap: 0.75rem;
      justify-content: space-between;
    }

    .package-card .heart-icon {
      order: 1;
      width: 2rem;
      height: 2rem;
      flex-shrink: 0;
    }

    .package-card .heart-count-wrapper {
      order: 2;
      flex-direction: row;
      gap: 0.125rem;
      flex-shrink: 0;
    }

    .package-card .heart-count {
      font-size: 1.375rem;
    }

    .package-card .heart-label {
      font-size: 0.8125rem;
    }

    .package-card .package-name {
      order: 4;
      flex: 1;
      margin: 0;
      min-height: auto;
      font-size: 0.9375rem;
      text-align: left;
      padding-right: 0.5rem;
    }

    .package-card .price {
      order: 6;
      margin-top: 0;
      padding-top: 0;
      flex-direction: row;
      align-items: baseline;
      gap: 0.5rem;
      font-size: 1.25rem;
      flex-shrink: 0;
    }

    .package-card .buy-label {
      order: 7;
      margin-left: 0;
      flex-shrink: 0;
      width: auto;
      min-width: fit-content;
      padding: 0.5rem 1rem;
      font-size: 0.6875rem;
    }
  }

  @media (max-width: 640px) {
    .header-section {
      margin-bottom: 1rem;
    }

    .header-section h1 {
      font-size: 1.75rem;
      margin-bottom: 0.375rem;
    }

    .header-section p {
      font-size: 0.8125rem;
    }

    .package-card {
      padding: 0.75rem 0.875rem;
      gap: 0.625rem;
    }

    .package-card .heart-icon {
      width: 1.75rem;
      height: 1.75rem;
    }

    .package-card .heart-count {
      font-size: 1.25rem;
    }

    .package-card .heart-label {
      font-size: 0.75rem;
    }

    .package-card .package-name {
      font-size: 0.875rem;
      padding-right: 0.375rem;
    }

    .package-card .price {
      font-size: 1.125rem;
    }

    .package-card .buy-label {
      font-size: 0.625rem;
      padding: 0.4375rem 0.875rem;
      width: auto;
      min-width: fit-content;
    }
  }

  /* Purchase Overlay Animation */
  .purchase-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(
      135deg,
      rgba(255, 215, 0, 0.95) 0%,
      rgba(255, 237, 78, 0.95) 100%
    );
    border-radius: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
    pointer-events: none;
    animation: fadeInOutPurchaseOverlay 4s ease-in-out;
    }

  .purchase-overlay-content {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    color: #1a1a4e;
    padding: 0.5rem;
    width: 100%;
    min-height: 100%;
    flex-wrap: wrap;
  }

  .purchase-overlay-section {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .purchase-overlay-section.increase {
    animation: countUpPurchase 1.5s ease-out;
  }

  .purchase-overlay-label {
    font-size: 0.875rem;
    font-weight: 600;
    opacity: 0.8;
    white-space: nowrap;
  }

  .purchase-overlay-amount {
    font-size: 2rem;
    line-height: 1;
    font-weight: 900;
    white-space: nowrap;
  }

  .purchase-overlay-amount.previous {
    color: #1a1a4e;
    font-size: 1.75rem;
  }

  .purchase-overlay-amount.increase {
    color: #1a1a4e;
    font-size: 2.5rem;
    animation: pulseIncrease 0.5s ease-out 0.5s;
  }

  .purchase-overlay-plus {
    font-size: 2rem;
    line-height: 1;
    font-weight: 900;
    color: #1a1a4e;
  }

  @media (max-width: 768px) {
    .purchase-overlay-content {
      gap: 1rem;
    }

    .purchase-overlay-section {
      gap: 0.375rem;
    }

    .purchase-overlay-label {
      font-size: 0.75rem;
    }

    .purchase-overlay-amount {
      font-size: 1.5rem;
    }

    .purchase-overlay-amount.previous {
      font-size: 1.25rem;
    }

    .purchase-overlay-amount.increase {
      font-size: 1.875rem;
    }

    .purchase-overlay-plus {
      font-size: 1.5rem;
    }
  }

  @keyframes fadeInOutPurchaseOverlay {
    0% {
      opacity: 0;
      transform: scale(0.95);
    }
    10% {
      opacity: 1;
      transform: scale(1);
    }
    90% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: 0;
      transform: scale(0.95);
    }
  }

  @keyframes countUpPurchase {
    0% {
      transform: scale(0.8);
      opacity: 0;
    }
    50% {
      transform: scale(1.1);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes pulseIncrease {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.2);
    }
  }


</style>

