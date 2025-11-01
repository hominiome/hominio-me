<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { useZero } from "$lib/zero-utils";

  const zeroContext = useZero();
  const session = authClient.useSession();

  // Package definitions
  const packages = [
    {
      packageType: "hominio",
      votingWeight: 1,
      name: "I am Hominio",
      price: 1,
      description: "Basic voting package",
    },
    {
      packageType: "founder",
      votingWeight: 5,
      name: "Founder",
      price: 5,
      description: "5x voting power",
    },
    {
      packageType: "angel",
      votingWeight: 10,
      name: "Angel",
      price: 10,
      description: "10x voting power",
    },
  ];

  let zero: any = null;
  let userPackage = $state<any>(null);
  let loading = $state(true);
  let purchasing = $state(false);
  let successMessage = $state("");
  let errorMessage = $state("");

  // Redirect to home if not authenticated
  $effect(() => {
    if (!$session.isPending && !$session.data) {
      goto("/alpha");
    }
  });

  onMount(() => {
    let packageView: any;

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

      const userId = $session.data.user.id;

      // Query user's voting package
      const packageQuery = zero.query.userVotingPackage
        .where("userId", "=", userId);
      packageView = packageQuery.materialize();

      packageView.addListener((data: any) => {
        const packages = Array.from(data);
        if (packages.length > 0) {
          userPackage = packages[0];
        } else {
          userPackage = null;
        }
        loading = false;
      });
    })();

    return () => {
      if (packageView) packageView.destroy();
    };
  });

  function canUpgradeTo(packageType: string): boolean {
    if (!userPackage) return true; // Can purchase any package if none exists

    const currentType = userPackage.packageType;
    if (currentType === packageType) return false; // Already has this package

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
    if (!userPackage) return "available";
    if (userPackage.packageType === packageType) return "current";
    if (canUpgradeTo(packageType)) return "available";
    return "unavailable";
  }

  async function purchasePackage(packageType: string) {
    if (purchasing) return;

    if (!canUpgradeTo(packageType)) {
      errorMessage = "You cannot purchase this package. Upgrade only.";
      setTimeout(() => {
        errorMessage = "";
      }, 3000);
      return;
    }

    purchasing = true;
    successMessage = "";
    errorMessage = "";

    try {
      const response = await fetch("/alpha/api/purchase-package", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ packageType }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Purchase failed");
      }

      const result = await response.json();
      console.log("✅ Purchase successful:", result);

      successMessage = result.message || `Successfully purchased ${packageType} package!`;

      // Clear success message after 3 seconds
      setTimeout(() => {
        successMessage = "";
      }, 3000);
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

<div class="min-h-screen bg-cream p-8">
  {#if $session.isPending || loading}
    <div class="flex items-center justify-center min-h-screen">
      <div class="card p-8">
        <p class="text-navy/70">Loading...</p>
      </div>
    </div>
  {:else if $session.data}
    <div class="max-w-5xl mx-auto">
      <!-- Header -->
      <div class="header-section mb-12">
        <div>
          <h1 class="text-6xl font-bold text-navy mb-3">Purchase Voting Package</h1>
          <p class="text-navy/60 text-lg">
            Choose your voting weight package. You can upgrade anytime, but cannot downgrade.
          </p>
        </div>

        {#if userPackage}
          <!-- Current Package Display -->
          <div class="balance-card">
            <div
              class="text-xs font-medium text-navy/60 mb-2 uppercase tracking-wider text-center"
            >
              Your Package
            </div>
            <div class="flex items-center gap-3 justify-center">
              <svg
                class="w-12 h-12 text-yellow"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                />
              </svg>
              <div class="text-center">
                <div class="text-4xl font-bold text-yellow">{userPackage.votingWeight}</div>
                <div class="text-sm text-navy/70">
                  {packages.find((p) => p.packageType === userPackage.packageType)?.name || "Votes"}
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="space-y-8">
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

        <!-- Package Options -->
        <div>
          <h2 class="text-3xl font-bold text-navy mb-6 text-center">
            Choose Your Package
          </h2>
          <div
            class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
          >
            {#each packages as pkg}
              {@const status = getPackageStatus(pkg.packageType)}
              {@const isCurrent = status === "current"}
              {@const isAvailable = status === "available"}
              {@const isUnavailable = status === "unavailable"}

              <button
                onclick={() => purchasePackage(pkg.packageType)}
                disabled={purchasing || isCurrent || isUnavailable}
                class="package-card"
                class:current-package={isCurrent}
                class:unavailable-package={isUnavailable}
              >
                {#if isCurrent}
                  <div class="package-badge current-badge">CURRENT</div>
                {:else if isUnavailable}
                  <div class="package-badge unavailable-badge">UNAVAILABLE</div>
                {/if}

                <svg class="heart-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path
                    d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  />
                </svg>

                <div class="heart-count-wrapper">
                  <div class="heart-count">{pkg.votingWeight}</div>
                </div>

                <div class="heart-label">
                  {pkg.votingWeight} vote{pkg.votingWeight > 1 ? "s" : ""}
                </div>

                <h3 class="package-name">{pkg.name}</h3>

                <p class="package-description">{pkg.description}</p>

                <div class="price">
                  €{pkg.price}
                  <span class="vat-note">excl. VAT</span>
                </div>

                {#if isCurrent}
                  <div class="buy-label current-label">Current Package</div>
                {:else if isAvailable}
                  <div class="buy-label">Purchase Now</div>
                {:else}
                  <div class="buy-label unavailable-label">Not Available</div>
                {/if}
              </button>
            {/each}
          </div>

          <p class="text-sm text-navy/50 text-center mt-6">
            ℹ️ This is a demo purchase - no actual payment required
          </p>
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

  /* Balance Card */
  .balance-card {
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    border: 2px solid #f4d03f;
    border-radius: 16px;
    padding: 1.5rem;
    flex-shrink: 0;
    min-width: 200px;
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
    cursor: pointer;
    text-align: center;
    position: relative;
  }

  .package-card:hover:not(:disabled) {
    border-color: #f4d03f;
    transform: translateY(-6px);
    box-shadow: 0 12px 32px rgba(244, 208, 63, 0.25);
  }

  .package-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .package-card.current-package {
    background: linear-gradient(
      135deg,
      rgba(244, 208, 63, 0.15) 0%,
      rgba(78, 205, 196, 0.15) 100%
    );
    border-color: #f4d03f;
    border-width: 3px;
  }

  .package-card.unavailable-package {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .package-badge {
    position: absolute;
    top: -12px;
    left: 50%;
    transform: translateX(-50%);
    padding: 0.375rem 1rem;
    border-radius: 20px;
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 2px 8px rgba(26, 26, 78, 0.08);
    white-space: nowrap;
  }

  .package-badge.current-badge {
    background: linear-gradient(135deg, #1a1a4e 0%, #2a2a6e 100%);
    color: #f4d03f;
  }

  .package-badge.unavailable-badge {
    background: rgba(26, 26, 78, 0.12);
    color: rgba(26, 26, 78, 0.65);
  }

  .heart-icon {
    width: 2.75rem;
    height: 2.75rem;
    color: #f4d03f;
  }

  .heart-count-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .heart-count {
    font-size: 2.5rem;
    font-weight: 900;
    color: #1a1a4e;
    line-height: 1;
  }

  .heart-label {
    font-size: 0.875rem;
    color: rgba(26, 26, 78, 0.5);
    font-weight: 500;
    margin-bottom: 0.1rem;
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
    margin-bottom: 0.5rem;
  }

  .price {
    font-size: 2rem;
    font-weight: 800;
    color: #f4d03f;
    margin-top: auto;
    padding-top: 0.75rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  .vat-note {
    font-size: 0.625rem;
    font-weight: 500;
    color: rgba(26, 26, 78, 0.5);
    text-transform: uppercase;
    letter-spacing: 0.05em;
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
  }

  .package-card:hover:not(:disabled) .buy-label {
    background: #4ecdc4;
    color: white;
  }

  .buy-label.current-label {
    background: #f4d03f;
    color: #1a1a4e;
    border-color: #f4d03f;
  }

  .buy-label.unavailable-label {
    background: rgba(26, 26, 78, 0.1);
    color: rgba(26, 26, 78, 0.5);
    border-color: rgba(26, 26, 78, 0.2);
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

  @media (max-width: 768px) {
    .header-section {
      flex-direction: column;
      align-items: flex-start;
      gap: 1.5rem;
    }

    .header-section h1 {
      font-size: 2.5rem;
    }

    .balance-card {
      width: 100%;
      min-width: auto;
      padding: 1rem;
    }

    .grid {
      grid-template-columns: 1fr !important;
    }

    .package-card {
      padding: 1.2rem;
    }

    .heart-icon {
      width: 2.5rem;
      height: 2.5rem;
    }

    .heart-count {
      font-size: 2rem;
    }

    .package-name {
      font-size: 1rem;
    }
  }

  @media (max-width: 640px) {
    .header-section h1 {
      font-size: 2rem;
    }

    .header-section p {
      font-size: 0.875rem;
    }

    .package-card {
      padding: 1rem;
    }

    .heart-icon {
      width: 2.25rem;
      height: 2.25rem;
    }

    .heart-count {
      font-size: 1.75rem;
    }

    .package-name {
      font-size: 0.9375rem;
    }

    .package-description {
      font-size: 0.8125rem;
    }

    .price {
      font-size: 1.5rem;
    }

    .buy-label {
      font-size: 0.6875rem;
      padding: 0.4375rem 1.25rem;
    }

    .balance-card {
      padding: 0.875rem;
    }

    .balance-card .text-4xl {
      font-size: 2rem;
    }
  }
</style>

