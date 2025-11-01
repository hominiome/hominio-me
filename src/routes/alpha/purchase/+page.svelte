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
  let userIdentity = $state<any>(null);
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
    let identityView: any;

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

      // Query user's identity
      const identityQuery = zero.query.userIdentities
        .where("userId", "=", userId);
      identityView = identityQuery.materialize();

      identityView.addListener((data: any) => {
        const identities = Array.from(data);
        if (identities.length > 0) {
          userIdentity = identities[0];
        } else {
          userIdentity = null;
        }
        loading = false;
      });
    })();

    return () => {
      if (identityView) identityView.destroy();
    };
  });

  function canUpgradeTo(packageType: string): boolean {
    if (!userIdentity) return true; // Can select any identity if none exists

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

      successMessage = result.message || `Selected`;

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
          <h1 class="text-6xl font-bold text-navy mb-3">Choose Your Voting Weight</h1>
          {#if !userIdentity}
            <p class="text-navy/70 text-lg">
              Select your voting weight to participate.
            </p>
          {/if}
        </div>
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

        <!-- Options -->
        <div>
          <div
            class="package-grid mb-8"
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

                {#if isCurrent}
                  <div class="buy-label current-label">Current</div>
                {:else if isAvailable}
                  <div class="buy-label">Select</div>
                {:else}
                  <div class="buy-label unavailable-label">Unavailable</div>
                {/if}
              </button>
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
    cursor: pointer;
    text-align: center;
    position: relative;
  }

  .package-card:hover:not(:disabled) {
    border-color: #f4d03f;
    transform: translateY(-6px);
    box-shadow: 0 12px 32px rgba(244, 208, 63, 0.25);
  }

  .package-card:disabled:not(.current-package) {
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
    opacity: 1;
    cursor: default;
  }

  .package-card.current-package:hover {
    transform: none;
    box-shadow: none;
  }

  .package-card.unavailable-package {
    opacity: 0.6;
    cursor: not-allowed;
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
    margin-bottom: 0.5rem;
  }

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

  /* Package Grid */
  .package-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
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
      gap: 1.5rem;
    }

    .header-section h1 {
      font-size: 2.5rem;
    }

    .package-card {
      padding: 1rem 1.25rem;
      flex-direction: row;
      align-items: center;
      text-align: left;
      gap: 1rem;
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
    }

    .package-card .heart-count {
      font-size: 1.5rem;
    }

    .package-card .heart-label {
      font-size: 0.875rem;
    }

    .package-card .package-name {
      order: 4;
      flex: 1;
      margin: 0;
      min-height: auto;
      font-size: 1rem;
      text-align: left;
    }

    .package-card .package-description {
      order: 5;
      display: none;
    }

    .package-card .price {
      order: 6;
      margin-top: 0;
      padding-top: 0;
      flex-direction: row;
      align-items: baseline;
      gap: 0.5rem;
      font-size: 1.5rem;
    }

    .package-card .buy-label {
      order: 7;
      margin-left: auto;
      flex-shrink: 0;
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
      padding: 0.875rem 1rem;
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
      font-size: 0.9375rem;
    }

    .package-card .price {
      font-size: 1.25rem;
    }

    .package-card .buy-label {
      font-size: 0.625rem;
      padding: 0.375rem 1rem;
    }
  }
</style>

