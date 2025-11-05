<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { useZero } from "$lib/zero-utils";
  import { page } from "$app/stores";
  import { calculatePrizePool, formatPrizePool } from "$lib/prizePoolUtils.js";
  import CupHeader from "$lib/CupHeader.svelte";
  import Loading from "$lib/components/Loading.svelte";
  import {
    identityByUserAndCup,
    identitiesByUser,
    allCups,
    allMatches,
    allPurchases,
  } from "$lib/synced-queries";
  import { env } from "$env/dynamic/public";

  const zeroContext = useZero();
  const session = authClient.useSession();

  // Get return URL and cupId from query parameters
  const returnUrl = $derived(
    $page.url.searchParams.get("returnUrl") || "/alpha"
  );
  const cupIdFromQuery = $derived($page.url.searchParams.get("cupId") || "");

  // Get Polar product ID from environment
  const polarProductId =
    env.PUBLIC_POLAR_PRODUCT_ID_1 || "aa8e6119-7f7f-4ce3-abde-666720be9fb3";

  // Package definitions - only "I am Hominio" universal membership
  const packages = [
    {
      packageType: "hominio",
      votingWeight: 1,
      name: "I am Hominio",
      price: 12, // 12€/year (~14$ incl. taxes + VAT)
      priceCents: 1200,
      isUniversal: true, // Universal identity - applies to all cups (cupId = null)
      description: "Yearly Membership - Unlimited voting access to all cups",
      usesPolar: true, // Uses Polar checkout
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
    return `${euros.toLocaleString("de-DE")}€`;
  }

  // PURCHASE ROUTE IS DISABLED - INVITE-ONLY MODE
  // Redirect all purchase page visits to invite-only page
  // TEMPORARILY DISABLED - Purchase page is now accessible
  // $effect(() => {
  //   // Redirect to home with invite modal
  //   goto("/alpha?modal=invite", { replaceState: false });
  // });

  // Redirect to home if not authenticated
  $effect(() => {
    if (!$session.isPending && !$session.data) {
      goto("/alpha");
    }
  });

  let identityView: any = null;
  let cupsView: any = null;

  // Reactive effect to select cup from query params when cups are loaded
  // For universal packages (hominio), cupId is optional
  $effect(() => {
    if (cups.length > 0 && cupIdFromQuery) {
      const cup = cups.find((c: any) => c.id === cupIdFromQuery);
      if (cup) {
        selectedCupId = cupIdFromQuery;
        selectedCup = cup;
      } else {
        // Cup not found in query params, but this is OK for universal packages
        // Only show error if user tries to purchase a cup-specific package
        selectedCupId = "";
        selectedCup = null;
      }
    } else if (cups.length > 0 && !cupIdFromQuery) {
      // No cupId in query params - this is OK for universal packages
      // User can still purchase "I am Hominio" without a cupId
      selectedCupId = "";
      selectedCup = null;
    }
    // Ensure loading is false once cups are available
    if (cups.length > 0) {
      loading = false;
    }
  });

  // Reactive effect to update identity query when cup changes
  // For universal packages, check for universal identity (cupId IS NULL)
  // For cup-specific packages, check for cup-specific identity
  $effect(() => {
    if (!zero || !$session.data?.user) return;

    const userId = $session.data.user.id;

    // Clean up previous identity view
    if (identityView) {
      identityView.destroy();
      identityView = null;
    }

    // If no cup selected, check for universal identity only
    if (!selectedCupId) {
      // Query all identities for user and filter for universal identity (cupId IS NULL)
      const allIdentitiesQuery = identitiesByUser(userId);
      identityView = zero.materialize(allIdentitiesQuery);

      identityView.addListener((data: any) => {
        const identities = Array.from(data);
        // Filter for universal identity (cupId IS NULL and identityType is hominio)
        const universalIdentity = identities.find(
          (id: any) => id.cupId === null && id.identityType === "hominio"
        );
        if (universalIdentity) {
          userIdentity = universalIdentity;
        } else {
          userIdentity = null;
        }
        if (cups.length > 0) {
          loading = false;
        }
      });
      return;
    }

    // Query user's identity for selected cup using synced query
    const identityQuery = identityByUserAndCup(userId, selectedCupId);
    identityView = zero.materialize(identityQuery);

    identityView.addListener(async (data: any) => {
      const identities = Array.from(data);
      if (identities.length > 0) {
        userIdentity = identities[0];
      } else {
        // If no cup-specific identity, check for universal identity
        // Query all identities for user to find universal identity
        const allIdentitiesQuery = identitiesByUser(userId);
        const allIdentitiesView = zero.materialize(allIdentitiesQuery);
        allIdentitiesView.addListener((allData: any) => {
          const allIdentities = Array.from(allData);
          const universalIdentity = allIdentities.find(
            (id: any) => id.cupId === null && id.identityType === "hominio"
          );
          userIdentity = universalIdentity || null;
          allIdentitiesView.destroy();
        });
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
      const cupsQuery = allCups();
      cupsView = zero.materialize(cupsQuery);

      cupsView.addListener((data: any) => {
        cups = Array.from(data || []);
        // Cup selection is handled by reactive $effect above
        // Set loading to false once cups are loaded
        if (cups.length > 0) {
          loading = false;
        }
      });

      // Query all identity purchases for prize pool calculation
      const purchasesQuery = allPurchases();
      const purchasesView = zero.materialize(purchasesQuery);

      purchasesView.addListener((data: any) => {
        purchases = Array.from(data || []);
      });

      // Query matches for the selected cup to get round info
      const matchesQuery = allMatches();
      const matchesView = zero.materialize(matchesQuery);

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
    const pkg = packages.find((p) => p.packageType === packageType);
    if (!pkg) return false;

    // Universal packages (hominio) don't require a cupId
    if (pkg.isUniversal) {
      // Can purchase if no universal identity exists
      if (!userIdentity || userIdentity.cupId !== null) {
        return true;
      }
      // Already has this universal identity
      if (
        userIdentity.identityType === packageType &&
        userIdentity.cupId === null
      ) {
        return false;
      }
      return true; // Can upgrade from one universal to another (shouldn't happen, but allow it)
    }

    // Cup-specific packages require a cupId
    if (!selectedCupId) return false;

    if (!userIdentity) return true; // Can select any identity if none exists for this cup

    const currentType = userIdentity.identityType;
    if (currentType === packageType) return false; // Already has this identity

    // Valid upgrade paths
    if (
      currentType === "hominio" &&
      (packageType === "founder" || packageType === "angel")
    ) {
      return true;
    }
    if (currentType === "founder" && packageType === "angel") {
      return true;
    }

    return false; // Cannot downgrade
  }

  function getPackageStatus(
    packageType: string
  ): "current" | "available" | "unavailable" {
    if (!userIdentity) return "available";
    if (userIdentity.identityType === packageType) return "current";
    if (canUpgradeTo(packageType)) return "available";
    return "unavailable";
  }

  async function purchasePackage(packageType: string) {
    if (purchasing) return;

    // Find the package to check its properties
    const pkg = packages.find((p) => p.packageType === packageType);
    if (!pkg) {
      errorMessage = "Invalid package type.";
      setTimeout(() => {
        errorMessage = "";
      }, 3000);
      return;
    }

    // Cup-specific packages require a cupId
    if (!pkg.isUniversal && !selectedCupId) {
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

    // Handle Polar checkout for "I am Hominio"
    if (pkg.usesPolar) {
      try {
        // Redirect to Polar checkout using the configured slug
        await authClient.checkout({
          slug: "I-am-Hominio",
        });
        // Note: The checkout will redirect the user, so we won't reach here
        // The webhook will handle the purchase completion
        return;
      } catch (error) {
        console.error("Polar checkout failed:", error);
        errorMessage =
          error instanceof Error
            ? error.message
            : "Checkout failed. Please try again.";
        setTimeout(() => {
          errorMessage = "";
        }, 5000);
        purchasing = false;
        return;
      }
    }

    // Legacy purchase flow for cup-specific packages (founder, angel)
    // Calculate previous prize pool before purchase
    const previousPoolAmount = selectedCupId
      ? getPrizePoolAmount(selectedCupId)
      : 0;

    const purchasePrice = pkg.priceCents || pkg.price * 100; // Price in cents

    try {
      const response = await fetch("/alpha/api/purchase-package", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          packageType,
          cupId: pkg.isUniversal ? null : selectedCupId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Purchase failed");
      }

      const result = await response.json();
      console.log("✅ Purchase successful:", result);

      successMessage = result.message || `Successfully purchased`;

      // Immediately update userIdentity to reflect the purchase for instant UI state change
      if (result.identity) {
        userIdentity = {
          id: userIdentity?.id || `temp-${Date.now()}`,
          userId: $session.data?.user?.id || "",
          cupId: result.identity.cupId, // Can be null for universal
          identityType: result.identity.identityType,
          votingWeight: result.identity.votingWeight,
          upgradedFrom: result.identity.upgradedFrom || null,
          selectedAt: new Date().toISOString(),
        };
      }

      // Also add the new purchase to the purchases array for prize pool calculation
      // This ensures the prize pool updates immediately in the UI
      if (selectedCupId) {
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
      }

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
      errorMessage =
        error instanceof Error
          ? error.message
          : "Purchase failed. Please try again.";
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
        <Loading />
      </div>
    </div>
  {:else if $session.data}
    <div class="max-w-5xl mx-auto">
      <!-- Header -->
      <div class="header-section mb-8 md:mb-12">
        <div class="text-center mx-auto">
          <h1 class="text-6xl font-bold text-navy mb-3 text-center">
            Join Hominio
          </h1>
          <p class="text-navy/70 text-lg text-center">
            Become part of our community and help shape the future.
          </p>
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
          <!-- I am Hominio - Full Width Card -->
          {#each packages.filter((p) => p.packageType === "hominio") as pkg}
            {@const status = getPackageStatus(pkg.packageType)}
            {@const isCurrent = status === "current"}
            {@const isAvailable = status === "available"}
            {@const isUnavailable = status === "unavailable"}

            <div
              class="bg-white border-2 rounded-3xl p-8 flex flex-col gap-8 transition-all relative overflow-hidden mb-8 shadow-[0_2px_12px_rgba(26,26,78,0.06)] {isCurrent
                ? 'bg-gradient-to-br from-[rgba(244,208,63,0.15)] to-[rgba(78,205,196,0.15)] border-[#f4d03f] border-[3px]'
                : 'border-[rgba(26,26,78,0.1)]'} {isUnavailable
                ? 'opacity-60'
                : ''}"
            >
              <!-- Main Card Content - CSS Grid Layout -->
              <div
                class="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-12 w-full overflow-hidden"
              >
                <!-- Left Section (1/3) - Header & Key Info -->
                <div
                  class="flex flex-col items-center justify-center text-center md:pr-8 md:border-r-2 md:border-[rgba(26,26,78,0.08)] pb-8 md:pb-0 border-b-2 md:border-b-0 border-[rgba(26,26,78,0.08)]"
                >
                  <svg
                    class="w-16 h-16 text-[#f4d03f] mb-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path
                      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                    />
                  </svg>
                  <div class="flex items-baseline justify-center gap-2 mb-4">
                    <div
                      class="text-[3.5rem] font-black text-[#1a1a4e] leading-none"
                    >
                      {pkg.votingWeight}
                    </div>
                    <div
                      class="text-xl text-[rgba(26,26,78,0.6)] font-semibold"
                    >
                      vote{pkg.votingWeight > 1 ? "s" : ""}
                    </div>
                  </div>
                  <h3 class="text-2xl font-bold text-[#1a1a4e] mt-2 mb-1">
                    {pkg.name}
                  </h3>
                  <div
                    class="text-xs font-medium text-[rgba(26,26,78,0.5)] uppercase tracking-wider mb-6"
                  >
                    Membership
                  </div>
                  <div class="flex flex-col items-center gap-1 mb-6">
                    <div class="flex items-baseline gap-2">
                      <span
                        class="text-[2rem] font-extrabold text-[#f4d03f] leading-tight"
                        >1€</span
                      >
                      <span
                        class="text-xs font-normal text-[#4ecdc4] leading-tight"
                        >per month</span
                      >
                    </div>
                    <div
                      class="text-sm font-normal text-[rgba(26,26,78,0.6)] leading-snug"
                    >
                      billed at 14$ / year excl. VAT
                    </div>
                  </div>
                </div>

                <!-- Right Section (2/3) - Benefits -->
                <div class="flex flex-col min-w-0 w-full overflow-hidden">
                  <div class="mb-8 text-center">
                    <h4
                      class="text-2xl font-extrabold text-[#1a1a4e] mb-2 tracking-tight"
                    >
                      What you get
                    </h4>
                    <div
                      class="text-[0.9375rem] text-[rgba(26,26,78,0.6)] font-normal"
                    >
                      Unlock these benefits with your membership
                    </div>
                  </div>
                  <!-- Benefits Grid - Two Columns -->
                  <div
                    class="grid grid-cols-1 md:grid-cols-2 gap-8 w-full min-w-0 overflow-hidden px-1"
                  >
                    <!-- Left Column - Available Now -->
                    <div class="flex flex-col min-w-0">
                      <div
                        class="flex items-center gap-3 mb-5 pb-3 border-b-2 border-[rgba(26,26,78,0.08)]"
                      >
                        <div
                          class="w-3 h-3 rounded-full bg-[#4ecdc4] flex-shrink-0 shadow-[0_0_0_3px_rgba(78,205,196,0.2)]"
                        ></div>
                        <span
                          class="text-sm font-bold text-[#1a1a4e] uppercase tracking-widest"
                          >Available Now</span
                        >
                      </div>
                      <ul class="flex flex-col gap-4 list-none p-0 m-0 w-full">
                        <li
                          class="flex items-start gap-3.5 text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed p-3 bg-[rgba(78,205,196,0.06)] rounded-2xl border-l-[3px] border-transparent transition-all duration-200 hover:bg-[rgba(78,205,196,0.09)] hover:border-l-[#4ecdc4] hover:translate-x-0.5 min-w-0 w-full max-w-full box-border m-0 break-words"
                        >
                          <div
                            class="flex-1 min-w-0 max-w-full flex flex-col gap-0.5"
                          >
                            <span
                              class="text-[0.75rem] text-[rgba(26,26,78,0.5)] font-medium uppercase tracking-wide"
                              >Shape humanities future</span
                            >
                            <span
                              class="text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed break-words"
                              >Voting weight of 1 per Proposal</span
                            >
                          </div>
                        </li>
                        <li
                          class="flex items-start gap-3.5 text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed p-3 bg-[rgba(78,205,196,0.06)] rounded-2xl border-l-[3px] border-transparent transition-all duration-200 hover:bg-[rgba(78,205,196,0.09)] hover:border-l-[#4ecdc4] hover:translate-x-0.5 min-w-0 w-full max-w-full box-border m-0 break-words"
                        >
                          <div
                            class="flex-1 min-w-0 max-w-full flex flex-col gap-0.5"
                          >
                            <span
                              class="text-[0.75rem] text-[rgba(26,26,78,0.5)] font-medium uppercase tracking-wide"
                              >Exclusive profile label</span
                            >
                            <span
                              class="text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed break-words"
                              >Secure, I am "Hominio No X". There will only be 1
                              Hominio No2, and No10 etc, forever</span
                            >
                          </div>
                        </li>
                        <li
                          class="flex items-start gap-3.5 text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed p-3 bg-[rgba(78,205,196,0.06)] rounded-2xl border-l-[3px] border-transparent transition-all duration-200 hover:bg-[rgba(78,205,196,0.09)] hover:border-l-[#4ecdc4] hover:translate-x-0.5 min-w-0 w-full max-w-full box-border m-0 break-words"
                        >
                          <div
                            class="flex-1 min-w-0 max-w-full flex flex-col gap-0.5"
                          >
                            <span
                              class="text-[0.75rem] text-[rgba(26,26,78,0.5)] font-medium uppercase tracking-wide"
                              >FOR NERDS ;)</span
                            >
                            <span
                              class="text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed break-words"
                              >We accept your pull requests in exchange for
                              bounties</span
                            >
                          </div>
                        </li>
                        <li
                          class="flex items-start gap-3.5 text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed p-3 bg-[rgba(78,205,196,0.06)] rounded-2xl border-l-[3px] border-transparent transition-all duration-200 hover:bg-[rgba(78,205,196,0.09)] hover:border-l-[#4ecdc4] hover:translate-x-0.5 min-w-0 w-full max-w-full box-border m-0 break-words"
                        >
                          <div
                            class="flex-1 min-w-0 max-w-full flex flex-col gap-0.5"
                          >
                            <span
                              class="text-[0.75rem] text-[rgba(26,26,78,0.5)] font-medium uppercase tracking-wide"
                              >Early Adopter Alpha Community</span
                            >
                            <span
                              class="text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed break-words"
                              >Join the exclusive early adopter chat community</span
                            >
                          </div>
                        </li>
                      </ul>
                    </div>

                    <!-- Right Column - Coming Soon -->
                    <div class="flex flex-col min-w-0">
                      <div
                        class="flex items-center gap-3 mb-5 pb-3 border-b-2 border-[rgba(26,26,78,0.08)]"
                      >
                        <div
                          class="w-3 h-3 rounded-full bg-[rgba(26,26,78,0.3)] flex-shrink-0 shadow-[0_0_0_3px_rgba(26,26,78,0.1)]"
                        ></div>
                        <span
                          class="text-sm font-bold text-[#1a1a4e] uppercase tracking-widest"
                          >Coming Soon</span
                        >
                      </div>
                      <ul class="flex flex-col gap-4 list-none p-0 m-0 w-full">
                        <li
                          class="flex items-start gap-3.5 text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed p-3 bg-[rgba(26,26,78,0.04)] rounded-2xl border-l-[3px] border-transparent transition-all duration-200 hover:bg-[rgba(26,26,78,0.06)] hover:border-l-[rgba(26,26,78,0.2)] hover:translate-x-0.5 opacity-85 min-w-0 w-full max-w-full box-border m-0 break-words"
                        >
                          <div
                            class="flex-1 min-w-0 max-w-full flex flex-col gap-0.5"
                          >
                            <div class="flex items-center gap-2 flex-wrap">
                              <span
                                class="text-[0.75rem] text-[rgba(26,26,78,0.5)] font-medium uppercase tracking-wide"
                                >World Record Holder</span
                              >
                              <span
                                class="inline-block text-[0.6875rem] font-semibold text-[rgba(26,26,78,0.6)] bg-[rgba(26,26,78,0.08)] px-1.5 py-0.5 rounded uppercase tracking-tight whitespace-nowrap flex-shrink-0"
                                >Sept. 2026</span
                              >
                            </div>
                            <span
                              class="text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed break-words"
                              >Write history on the Guinness World Record wall
                              of fame</span
                            >
                          </div>
                        </li>
                        <li
                          class="flex items-start gap-3.5 text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed p-3 bg-[rgba(26,26,78,0.04)] rounded-2xl border-l-[3px] border-transparent transition-all duration-200 hover:bg-[rgba(26,26,78,0.06)] hover:border-l-[rgba(26,26,78,0.2)] hover:translate-x-0.5 opacity-85 min-w-0 w-full max-w-full box-border m-0 break-words"
                        >
                          <div
                            class="flex-1 min-w-0 max-w-full flex flex-col gap-0.5"
                          >
                            <div class="flex items-center gap-2 flex-wrap">
                              <span
                                class="text-[0.75rem] text-[rgba(26,26,78,0.5)] font-medium uppercase tracking-wide"
                                >Get Sponsored</span
                              >
                              <span
                                class="inline-block text-[0.6875rem] font-semibold text-[rgba(26,26,78,0.6)] bg-[rgba(26,26,78,0.08)] px-1.5 py-0.5 rounded uppercase tracking-tight whitespace-nowrap flex-shrink-0"
                                >est. Dez/Jan</span
                              >
                            </div>
                            <span
                              class="text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed break-words"
                              >Unlock your fair part of 50% revenue share</span
                            >
                          </div>
                        </li>
                        <li
                          class="flex items-start gap-3.5 text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed p-3 bg-[rgba(26,26,78,0.04)] rounded-2xl border-l-[3px] border-transparent transition-all duration-200 hover:bg-[rgba(26,26,78,0.06)] hover:border-l-[rgba(26,26,78,0.2)] hover:translate-x-0.5 opacity-85 min-w-0 w-full max-w-full box-border m-0 break-words"
                        >
                          <div
                            class="flex-1 min-w-0 max-w-full flex flex-col gap-0.5"
                          >
                            <div class="flex items-center gap-2 flex-wrap">
                              <span
                                class="text-[0.75rem] text-[rgba(26,26,78,0.5)] font-medium uppercase tracking-wide"
                                >Submit Proposals</span
                              >
                              <span
                                class="inline-block text-[0.6875rem] font-semibold text-[rgba(26,26,78,0.6)] bg-[rgba(26,26,78,0.08)] px-1.5 py-0.5 rounded uppercase tracking-tight whitespace-nowrap flex-shrink-0"
                                >Nov</span
                              >
                            </div>
                            <span
                              class="text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed break-words"
                              >Lead the way with your ideas</span
                            >
                          </div>
                        </li>
                        <li
                          class="flex items-start gap-3.5 text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed p-3 bg-[rgba(26,26,78,0.04)] rounded-2xl border-l-[3px] border-transparent transition-all duration-200 hover:bg-[rgba(26,26,78,0.06)] hover:border-l-[rgba(26,26,78,0.2)] hover:translate-x-0.5 opacity-85 min-w-0 w-full max-w-full box-border m-0 break-words"
                        >
                          <div
                            class="flex-1 min-w-0 max-w-full flex flex-col gap-0.5"
                          >
                            <div class="flex items-center gap-2 flex-wrap">
                              <span
                                class="text-[0.75rem] text-[rgba(26,26,78,0.5)] font-medium uppercase tracking-wide"
                                >Summit Live-Stream</span
                              >
                              <span
                                class="inline-block text-[0.6875rem] font-semibold text-[rgba(26,26,78,0.6)] bg-[rgba(26,26,78,0.08)] px-1.5 py-0.5 rounded uppercase tracking-tight whitespace-nowrap flex-shrink-0"
                                >est. Sept. 26</span
                              >
                            </div>
                            <span
                              class="text-[0.9375rem] text-[rgba(26,26,78,0.85)] leading-relaxed break-words"
                              >Follow along all speakers live online @ Hominio
                              Summit No1</span
                            >
                          </div>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Full Width Purchase Button -->
              <button
                onclick={() => purchasePackage(pkg.packageType)}
                disabled={purchasing || isCurrent || isUnavailable}
                class="text-sm font-semibold uppercase tracking-wider py-3.5 px-8 border-2 rounded-lg transition-all duration-200 cursor-pointer w-full mt-2 {isCurrent
                  ? 'bg-[#f4d03f] text-[#1a1a4e] border-[#f4d03f] cursor-default'
                  : isUnavailable
                    ? 'bg-[rgba(26,26,78,0.1)] text-[rgba(26,26,78,0.5)] border-[rgba(26,26,78,0.2)] cursor-not-allowed opacity-60'
                    : 'bg-[#f4d03f] text-[#1a1a4e] border-[#f4d03f] hover:bg-transparent hover:text-[#f4d03f]'} {purchasing
                  ? 'opacity-60 cursor-not-allowed'
                  : ''}"
              >
                {#if isCurrent}
                  Current
                {:else if isAvailable}
                  {pkg.usesPolar ? "Purchase now" : "Select"}
                {:else}
                  Unavailable
                {/if}
              </button>
            </div>
          {/each}
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

  .package-description {
    font-size: 0.875rem;
    color: rgba(26, 26, 78, 0.7);
    text-align: center;
    margin: 0.25rem 0;
    line-height: 1.4;
  }

  .price-container {
    margin-top: auto;
    padding-top: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
  }

  .price-main {
    font-size: 2rem;
    font-weight: 800;
    color: #f4d03f;
    line-height: 1.2;
  }

  .price-billing {
    font-size: 0.75rem;
    font-weight: 400;
    color: rgba(26, 26, 78, 0.6);
    line-height: 1.3;
    text-align: center;
    margin-top: 0.25rem;
  }

  /* I am Hominio Full-Width Card */
  .hominio-full-card {
    background: white;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 24px;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    transition: all 0.3s;
    position: relative;
    overflow: hidden;
    max-width: 100%;
    box-sizing: border-box;
  }

  .hominio-card-content {
    display: flex;
    gap: 3rem;
    width: 100%;
  }

  .hominio-full-card.current-package {
    background: linear-gradient(
      135deg,
      rgba(244, 208, 63, 0.15) 0%,
      rgba(78, 205, 196, 0.15) 100%
    );
    border-color: #f4d03f;
    border-width: 3px;
  }

  .hominio-full-card.unavailable-package {
    opacity: 0.6;
  }

  .hominio-left {
    flex: 0 0 33.333%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding-right: 2rem;
    border-right: 2px solid rgba(26, 26, 78, 0.08);
  }

  .hominio-right {
    flex: 0 0 66.666%;
    display: flex;
    flex-direction: column;
    min-width: 0;
    max-width: 66.666%;
    overflow: hidden;
    width: 100%;
    box-sizing: border-box;
  }

  .heart-icon-large {
    width: 4rem;
    height: 4rem;
    color: #f4d03f;
    margin-bottom: 1rem;
  }

  .heart-count-wrapper-large {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .heart-count-large {
    font-size: 3.5rem;
    font-weight: 900;
    color: #1a1a4e;
    line-height: 1;
  }

  .heart-label-large {
    font-size: 1.25rem;
    color: rgba(26, 26, 78, 0.6);
    font-weight: 600;
  }

  .hominio-name {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a4e;
    margin: 0.5rem 0 0.25rem 0;
  }

  .hominio-membership-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(26, 26, 78, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 1.5rem;
  }

  .hominio-price-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    margin-bottom: 1.5rem;
  }

  .hominio-price-main {
    font-size: 2rem;
    font-weight: 800;
    color: #f4d03f;
    line-height: 1.2;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .hominio-price-period {
    font-size: 0.75rem;
    font-weight: 400;
    color: #4ecdc4;
    line-height: 1.2;
  }

  .hominio-price-billing {
    font-size: 0.875rem;
    font-weight: 400;
    color: rgba(26, 26, 78, 0.6);
    line-height: 1.3;
  }

  .hominio-buy-button-full {
    font-size: 0.875rem;
    font-weight: 600;
    color: #4ecdc4;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 0.875rem 2rem;
    border: 2px solid #4ecdc4;
    border-radius: 8px;
    transition: all 0.2s;
    cursor: pointer;
    background: transparent;
    width: 100%;
    margin-top: 0.5rem;
  }

  .hominio-buy-button-full:hover:not(:disabled) {
    background: #4ecdc4;
    color: white;
  }

  .hominio-buy-button-full:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .hominio-buy-button-full.current-label {
    background: #f4d03f;
    color: #1a1a4e;
    border-color: #f4d03f;
    cursor: default;
  }

  .hominio-buy-button-full.unavailable-label {
    background: rgba(26, 26, 78, 0.1);
    color: rgba(26, 26, 78, 0.5);
    border-color: rgba(26, 26, 78, 0.2);
    cursor: not-allowed;
  }

  .benefits-header {
    margin-bottom: 2rem;
    padding: 0;
    width: 100%;
    box-sizing: border-box;
  }

  .benefits-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: #1a1a4e;
    margin: 0 0 0.5rem 0;
    letter-spacing: -0.02em;
  }

  .benefits-subtitle {
    font-size: 0.9375rem;
    color: rgba(26, 26, 78, 0.6);
    font-weight: 400;
  }

  .benefits-columns-wrapper {
    display: flex;
    gap: 2rem;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    box-sizing: border-box;
  }

  .benefits-column {
    flex: 1 1 0;
    min-width: 0;
    max-width: calc(50% - 1rem);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }

  .column-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
    padding-bottom: 0.75rem;
    padding-left: 0;
    padding-right: 0;
    border-bottom: 2px solid rgba(26, 26, 78, 0.08);
    width: 100%;
    box-sizing: border-box;
  }

  .status-indicator {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .status-indicator.available {
    background: #4ecdc4;
    box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.2);
  }

  .status-indicator.coming-soon-indicator {
    background: rgba(26, 26, 78, 0.3);
    box-shadow: 0 0 0 3px rgba(26, 26, 78, 0.1);
  }

  .column-title {
    font-size: 0.875rem;
    font-weight: 700;
    color: #1a1a4e;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .hominio-benefits-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: 100%;
    box-sizing: border-box;
  }

  .hominio-benefit-item {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    font-size: 0.9375rem;
    color: rgba(26, 26, 78, 0.85);
    line-height: 1.6;
    padding: 0.75rem;
    background: rgba(78, 205, 196, 0.03);
    border-radius: 8px;
    border-left: 3px solid transparent;
    transition: all 0.2s ease;
    min-width: 0;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    margin: 0;
    overflow-wrap: break-word;
    word-wrap: break-word;
  }

  .hominio-benefit-item:hover {
    background: rgba(78, 205, 196, 0.06);
    border-left-color: #4ecdc4;
    transform: translateX(2px);
  }

  .coming-soon-column .hominio-benefit-item {
    background: rgba(26, 26, 78, 0.02);
    opacity: 0.85;
  }

  .coming-soon-column .hominio-benefit-item:hover {
    background: rgba(26, 26, 78, 0.04);
    border-left-color: rgba(26, 26, 78, 0.2);
  }

  .benefit-text {
    flex: 1;
    min-width: 0;
    max-width: 100%;
    overflow-wrap: break-word;
    word-break: break-word;
    hyphens: auto;
    line-height: 1.5;
    display: inline;
  }

  .hominio-benefit-item .check-icon {
    width: 1.375rem;
    height: 1.375rem;
    color: #4ecdc4;
    flex-shrink: 0;
    margin-top: 0.125rem;
  }

  .coming-soon-column .hominio-benefit-item .check-icon {
    color: rgba(26, 26, 78, 0.4);
  }

  .est-badge {
    display: inline-block;
    font-size: 0.6875rem;
    font-weight: 600;
    color: rgba(26, 26, 78, 0.6);
    background: rgba(26, 26, 78, 0.08);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    margin-left: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    font-style: normal;
    white-space: nowrap;
    flex-shrink: 0;
    vertical-align: middle;
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
      grid-template-columns: 1fr 1fr 1fr;
      gap: 1.5rem;
    }
    /* Prioritize "I am Hominio" - make it span full width on top */
    .package-grid :nth-child(1) {
      grid-column: 1 / -1;
      max-width: 500px;
      margin: 0 auto;
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

    .package-card .price-container {
      order: 6;
      margin-top: 0;
      padding-top: 0;
      flex-direction: row;
      align-items: baseline;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .package-card .price-main {
      font-size: 1.25rem;
    }

    .package-card .price-billing {
      display: none; /* Hide billing text on mobile to save space */
    }

    /* I am Hominio Card Mobile */
    .hominio-full-card {
      flex-direction: column;
      padding: 1.5rem;
      gap: 2rem;
    }

    .hominio-left {
      flex: 1;
      padding-right: 0;
      border-right: none;
      border-bottom: 2px solid rgba(26, 26, 78, 0.08);
      padding-bottom: 2rem;
    }

    .hominio-right {
      flex: 1;
      min-width: 0; /* Prevent overflow */
      max-width: 100%;
      overflow: hidden;
    }

    .benefits-columns-wrapper {
      flex-direction: column;
      gap: 2rem;
    }

    .benefits-column {
      max-width: 100%;
    }

    .benefits-header {
      margin-bottom: 1.5rem;
    }

    .benefits-title {
      font-size: 1.25rem;
    }

    .benefits-subtitle {
      font-size: 0.875rem;
    }

    .column-header {
      margin-bottom: 1rem;
      padding-bottom: 0.625rem;
    }

    .hominio-benefit-item {
      padding: 0.625rem;
      gap: 0.75rem;
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

    .package-card .price-main {
      font-size: 1.125rem;
    }

    .package-card .price-period {
      font-size: 0.75rem;
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
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.2);
    }
  }
</style>
