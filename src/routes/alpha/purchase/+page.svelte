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

  // Package definitions
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
    {
      packageType: "founder",
      votingWeight: 5,
      name: "Hominio Founder",
      price: 10, // 10€
      priceCents: 1000,
      isUniversal: false, // Cup-specific identity
      description: "Founder package - Benefits to be brainstormed", // Placeholder
      usesPolar: false, // Uses legacy purchase flow
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
                              >Early Adopter Telegram</span
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

          <!-- Hominio Founder - Display below I am Hominio -->
          {#each packages.filter((p) => p.packageType === "founder") as pkg}
            {@const status = getPackageStatus(pkg.packageType)}
            {@const isCurrent = status === "current"}
            {@const isAvailable = status === "available"}
            {@const isUnavailable = status === "unavailable"}

            <div
              class="bg-white border-2 rounded-3xl p-8 flex flex-col gap-6 transition-all relative overflow-hidden mb-8 shadow-[0_2px_12px_rgba(26,26,78,0.06)] {isCurrent
                ? 'bg-gradient-to-br from-[rgba(244,208,63,0.15)] to-[rgba(78,205,196,0.15)] border-[#f4d03f] border-[3px]'
                : 'border-[rgba(26,26,78,0.1)]'} {isUnavailable
                ? 'opacity-60'
                : ''}"
            >
              <div class="flex flex-col items-center text-center gap-4">
                <h3 class="text-2xl font-bold text-[#1a1a4e]">{pkg.name}</h3>
                <div class="flex items-baseline justify-center gap-2">
                  <div class="text-3xl font-black text-[#1a1a4e] leading-none">
                    {pkg.votingWeight}
                  </div>
                  <div class="text-lg text-[rgba(26,26,78,0.6)] font-semibold">
                    vote{pkg.votingWeight > 1 ? "s" : ""}
                  </div>
                </div>
                <div class="text-lg font-bold text-[#f4d03f]">
                  €{pkg.price}
                </div>
                <p class="text-sm text-[rgba(26,26,78,0.7)] max-w-md">
                  {pkg.description}
                </p>
                {#if selectedCup}
                  <p class="text-xs text-[rgba(26,26,78,0.6)]">
                    For cup: {selectedCup.name}
                  </p>
                {:else}
                  <p class="text-xs text-[rgba(26,26,78,0.6)]">
                    Please select a cup to purchase this package
                  </p>
                {/if}
              </div>

              <button
                onclick={() => purchasePackage(pkg.packageType)}
                disabled={purchasing || isCurrent || isUnavailable || !selectedCupId}
                class="text-sm font-semibold uppercase tracking-wider py-3.5 px-8 border-2 rounded-lg transition-all duration-200 cursor-pointer w-full mt-2 {isCurrent
                  ? 'bg-[#f4d03f] text-[#1a1a4e] border-[#f4d03f] cursor-default'
                  : isUnavailable || !selectedCupId
                    ? 'bg-[rgba(26,26,78,0.1)] text-[rgba(26,26,78,0.5)] border-[rgba(26,26,78,0.2)] cursor-not-allowed opacity-60'
                    : 'bg-[#f4d03f] text-[#1a1a4e] border-[#f4d03f] hover:bg-transparent hover:text-[#f4d03f]'} {purchasing
                  ? 'opacity-60 cursor-not-allowed'
                  : ''}"
              >
                {#if isCurrent}
                  Current
                {:else if isAvailable && selectedCupId}
                  Purchase
                {:else if !selectedCupId}
                  Select Cup First
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
  /* Colors - Only keep what's actually used in the template */
  :global(.bg-cream) {
    background-color: #faf9f6;
  }

  :global(.text-navy) {
    color: #1a1a4e;
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
  }
</style>
