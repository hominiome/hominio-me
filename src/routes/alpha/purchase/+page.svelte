<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { useZero } from "$lib/zero-utils";
  import { page } from "$app/stores";
  import Loading from "$lib/components/Loading.svelte";
  import { identitiesByUser } from "$lib/synced-queries";
  import { env } from "$env/dynamic/public";

  const zeroContext = useZero();
  const session = authClient.useSession();

  // Get return URL from query parameters
  const returnUrl = $derived(
    $page.url.searchParams.get("returnUrl") || "/alpha"
  );

  // Get Polar product ID from environment
  const polarProductId =
    env.PUBLIC_POLAR_PRODUCT_ID_1 || "aa8e6119-7f7f-4ce3-abde-666720be9fb3";

  // Package definitions - All identities are now universal (cupId = null)
  const packages = [
    {
      packageType: "hominio",
      votingWeight: 1,
      name: "I am Hominio",
      price: 12, // 12€/year (~14$ incl. taxes + VAT)
      priceCents: 1200,
      description: "Yearly Membership - Unlimited voting access to all cups",
      usesPolar: true, // Uses Polar checkout
    },
    {
      packageType: "founder",
      votingWeight: 5,
      name: "Hominio Founder",
      price: 987, // 987€
      priceCents: 98700,
      description: "Founder package - Benefits to be brainstormed", // Placeholder
      usesPolar: false, // Uses legacy purchase flow
      disabled: true, // Temporarily disabled
    },
  ];

  let zero: any = null;
  let userIdentity = $state<any>(null);
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

  onMount(() => {
    (async () => {
      console.log("[Purchase] onMount started");
      console.log(
        "[Purchase] Zero ready:",
        zeroContext.isReady(),
        "Instance:",
        !!zeroContext.getInstance()
      );

      // Wait for Zero to be ready (with timeout)
      const maxWaitTime = 10000; // 10 seconds max wait
      const startTime = Date.now();

      while (!zeroContext.isReady() || !zeroContext.getInstance()) {
        if (Date.now() - startTime > maxWaitTime) {
          console.error("[Purchase] Zero context timeout - proceeding anyway");
          loading = false;
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      zero = zeroContext.getInstance();
      console.log("[Purchase] Zero instance obtained:", !!zero);

      // Wait for session to load (with timeout)
      const sessionStartTime = Date.now();
      while ($session.isPending) {
        if (Date.now() - sessionStartTime > maxWaitTime) {
          console.error("[Purchase] Session timeout - proceeding anyway");
          loading = false;
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      console.log("[Purchase] Session loaded, user:", !!$session.data?.user);

      if (!$session.data?.user) {
        console.log("[Purchase] No user, redirecting to /alpha");
        goto("/alpha");
        return;
      }

      const userId = $session.data.user.id;
      console.log("[Purchase] Starting identity query for user:", userId);

      try {
        // Query all identities for user (all identities are universal)
        const allIdentitiesQuery = identitiesByUser(userId);
        identityView = zero.materialize(allIdentitiesQuery);

        // Set a timeout to ensure loading doesn't hang forever
        const loadingTimeout = setTimeout(() => {
          console.warn(
            "[Purchase] Identity query timeout after 5s, setting loading = false"
          );
          loading = false;
        }, 5000); // 5 second timeout

        identityView.addListener((data: any) => {
          clearTimeout(loadingTimeout);
          console.log("[Purchase] Identity query returned:", data);
          const identities = Array.from(data);
          console.log("[Purchase] Identities found:", identities.length);
          if (identities.length > 0) {
            // Get the identity with highest voting weight
            userIdentity = identities.reduce((prev: any, curr: any) =>
              curr.votingWeight > prev.votingWeight ? curr : prev
            );
          } else {
            userIdentity = null;
          }
          console.log(
            "[Purchase] Setting loading = false, userIdentity:",
            userIdentity
          );
          loading = false;
        });
      } catch (error) {
        console.error("[Purchase] Error setting up identity query:", error);
        loading = false;
      }

      // Preload purchase sound effect
      purchaseSound = new Audio("/purchase-effect.mp3");
      purchaseSound.preload = "auto";

      return () => {
        console.log("[Purchase] onMount cleanup");
        if (identityView) identityView.destroy();
      };
    })();
  });

  function canUpgradeTo(packageType: string): boolean {
    const pkg = packages.find((p) => p.packageType === packageType);
    if (!pkg) return false;

    // All identities are now universal (cupId = null)
    if (!userIdentity) return true; // Can purchase any identity if none exists

    const currentType = userIdentity.identityType;
    if (currentType === packageType) return false; // Already has this identity

    // Explorer identity has no voting rights - can purchase any voting identity
    if (currentType === "explorer") {
      return true; // Can purchase any voting identity (hominio, founder, angel)
    }

    // Valid upgrade paths (all universal)
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
  ): "current" | "available" | "unavailable" | "renew" {
    // Check if package is disabled
    const pkg = packages.find((p) => p.packageType === packageType);
    if (pkg?.disabled) return "unavailable";
    
    if (!userIdentity) return "available";
    if (userIdentity.identityType === packageType) {
      // Check if canceled (has expiration date)
      if (userIdentity.expiresAt) {
        return "renew";
      }
      return "current";
    }
    if (canUpgradeTo(packageType)) return "available";
    return "unavailable";
  }

  // Get expiration countdown for canceled subscriptions
  function getExpirationCountdown(
    expiresAt: string | null | undefined
  ): string {
    if (!expiresAt) return "";

    const now = new Date();
    const expiration = new Date(expiresAt);
    const diffMs = expiration.getTime() - now.getTime();

    if (diffMs <= 0) return "Expired";

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `${days}d ${hours}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  // Reactive countdown state
  let countdowns = $state<Record<string, string>>({});

  // Update countdowns every second
  $effect(() => {
    if (!userIdentity?.expiresAt) return;

    const updateCountdown = () => {
      if (userIdentity?.expiresAt) {
        countdowns[userIdentity.id] = getExpirationCountdown(
          userIdentity.expiresAt
        );
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  });

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

    // Check if this is a renewal (user has this identity with expiration)
    // Renewals should bypass the canUpgradeTo check
    const currentIdentity =
      userIdentity &&
      userIdentity.identityType === packageType &&
      userIdentity.expiresAt
        ? userIdentity
        : null;
    const isRenew = !!currentIdentity;

    // Only check canUpgradeTo for non-renewal purchases
    if (!isRenew && !canUpgradeTo(packageType)) {
      errorMessage = "Upgrade only.";
      setTimeout(() => {
        errorMessage = "";
      }, 3000);
      return;
    }

    purchasing = true;
    successMessage = "";
    errorMessage = "";

    // Handle renewal for "I am Hominio" via direct API (no checkout round trip)
    if (pkg.usesPolar && isRenew) {
      try {
        const response = await fetch("/alpha/api/renew-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            packageType,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Renewal failed");
        }

        successMessage = "Subscription renewed successfully!";
        // Reload page to reflect updated identity state
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        return;
      } catch (error) {
        console.error("Renewal failed:", error);
        errorMessage =
          error instanceof Error
            ? error.message
            : "Renewal failed. Please try again.";
        setTimeout(() => {
          errorMessage = "";
        }, 5000);
        purchasing = false;
        return;
      }
    }

    // Handle Polar checkout for new purchases
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

    // Legacy purchase flow (all identities are now universal, cupId = null)
    try {
      const response = await fetch("/alpha/api/purchase-package", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          packageType,
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
          cupId: null, // All identities are universal
          identityType: result.identity.identityType,
          votingWeight: result.identity.votingWeight,
          upgradedFrom: result.identity.upgradedFrom || null,
          selectedAt: new Date().toISOString(),
        };
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

        <!-- Options -->
        <div>
          <!-- I am Hominio - Full Width Card -->
          {#each packages.filter((p) => p.packageType === "hominio") as pkg}
            {@const status = getPackageStatus(pkg.packageType)}
            {@const isCurrent = status === "current"}
            {@const isRenew = status === "renew"}
            {@const isAvailable = status === "available"}
            {@const isUnavailable = status === "unavailable"}
            {@const hasExpiration =
              userIdentity?.expiresAt &&
              userIdentity.identityType === pkg.packageType}
            {@const countdown = hasExpiration
              ? countdowns[userIdentity.id] ||
                getExpirationCountdown(userIdentity.expiresAt)
              : ""}

            <div
              class="bg-white border-2 rounded-3xl p-8 flex flex-col gap-8 transition-all relative overflow-hidden mb-8 shadow-[0_2px_12px_rgba(26,26,78,0.06)] {isCurrent ||
              isRenew
                ? 'bg-gradient-to-br from-[rgba(244,208,63,0.15)] to-[rgba(78,205,196,0.15)] border-[#f4d03f] border-[3px]'
                : 'border-[rgba(26,26,78,0.1)]'} {isUnavailable
                ? 'opacity-60'
                : ''}"
            >
              <!-- Canceled Badge - Full Triangle Corner -->
              {#if isRenew && hasExpiration}
                <div class="absolute top-0 left-0 pointer-events-none z-10">
                  <!-- Triangle that fills the entire corner using clip-path -->
                  <div
                    class="bg-alert-500 text-white font-bold shadow-lg flex items-center justify-center"
                    style="clip-path: polygon(0 0, 0 140px, 140px 0); width: 140px; height: 140px;"
                  >
                    <div
                      class="flex flex-col items-center justify-center gap-0.5 text-center pb-2"
                      style="transform: rotate(-45deg); transform-origin: center; margin-top: -8px; margin-left: -20px;"
                    >
                      <div
                        class="text-[10px] md:text-[11px] uppercase tracking-wider font-bold leading-tight"
                      >
                        Canceled
                      </div>
                      <div
                        class="text-[16px] md:text-[17px] font-extrabold leading-tight whitespace-nowrap"
                      >
                        {countdown}
                      </div>
                    </div>
                  </div>
                </div>
              {/if}
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
                disabled={purchasing ||
                  (isCurrent && !isRenew) ||
                  isUnavailable}
                class="text-sm font-semibold uppercase tracking-wider py-3.5 px-8 border-2 rounded-lg transition-all duration-200 cursor-pointer w-full mt-2 {isRenew
                  ? 'bg-secondary-500 text-secondary-100 border-secondary-500 hover:bg-transparent hover:border-secondary-500 hover:text-secondary-500'
                  : isCurrent
                    ? 'bg-[rgba(244,208,63,0.3)] text-[rgba(26,26,78,0.5)] border-[rgba(244,208,63,0.4)] cursor-not-allowed opacity-60'
                    : isUnavailable
                      ? 'bg-[rgba(26,26,78,0.1)] text-[rgba(26,26,78,0.5)] border-[rgba(26,26,78,0.2)] cursor-not-allowed opacity-60'
                      : 'bg-[#f4d03f] text-[#1a1a4e] border-[#f4d03f] hover:bg-transparent hover:text-[#f4d03f]'} {purchasing
                  ? 'opacity-60 cursor-not-allowed'
                  : ''}"
              >
                {#if isRenew}
                  Renew
                {:else if isCurrent}
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
            {@const isUnavailable = status === "unavailable" || pkg.disabled}

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
              </div>

              <button
                onclick={() => purchasePackage(pkg.packageType)}
                disabled={purchasing || isCurrent || isUnavailable || pkg.disabled}
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
                  Purchase
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
