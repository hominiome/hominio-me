<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth.client.js";
  import { useZero } from "$lib/zero-utils";
  import QRCodeScanner from "$lib/QRCodeScanner.svelte";
  import { allCups } from "$lib/synced-queries";

  const zeroContext = useZero();
  const session = authClient.useSession();
  let isAdmin = $state(false);
  let checkingAdmin = $state(true);
  let scannedUserId = $state<string | null>(null);
  let scannedUserName = $state<string | null>(null);
  let cups = $state<any[]>([]);
  let selectedCupId = $state<string>("");
  let purchasing = $state(false);
  let successMessage = $state("");
  let errorMessage = $state("");
  let loadingCups = $state(true);
  let cupsView: any = $state(null);

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

  onMount(async () => {
    // Wait for session to load
    while ($session.isPending) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    if (!$session.data?.user) {
      goto("/alpha");
      return;
    }

    // Check if user is admin
    try {
      const response = await fetch("/alpha/api/is-admin");
      if (response.ok) {
        const data = await response.json();
        isAdmin = data.isAdmin;
        checkingAdmin = false;

        if (!isAdmin) {
          goto("/alpha");
          return;
        }
      } else {
        goto("/alpha");
        return;
      }
    } catch (error) {
      console.error("Failed to check admin status:", error);
      goto("/alpha");
      return;
    }

    // Initialize Zero and load cups
    try {
      loadingCups = true;
      // Wait for Zero to be ready
      while (!zeroContext.isReady() || !zeroContext.getInstance()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      zero = zeroContext.getInstance();

      if (zero) {
        // Load all cups using synced query
        const cupsQuery = allCups();
        cupsView = zero.materialize(cupsQuery);

        cupsView.addListener((data: any) => {
          // Sort by createdAt descending (newest first)
          cups = Array.from(data || []).sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          if (cups.length > 0 && !selectedCupId) {
            selectedCupId = cups[0].id;
          }
          loadingCups = false;
        });
      }
    } catch (err) {
      console.error("Failed to load cups:", err);
      errorMessage = "Failed to load cups. Please refresh the page.";
      loadingCups = false;
    }
  });

  async function handleScanned(userIdOrEvent: string | CustomEvent<{ userId: string }>) {
    let userId: string;
    
    // Handle both callback (string) and event (CustomEvent) formats
    if (typeof userIdOrEvent === "string") {
      userId = userIdOrEvent;
    } else {
      userId = userIdOrEvent.detail.userId;
    }
    
    if (!userId) {
      console.error("❌ No userId found");
      errorMessage = "Invalid QR code - no user ID found";
      return;
    }

    console.log("✅ Setting scannedUserId to:", userId);
    scannedUserId = userId;

    // Fetch user name
    try {
      console.log("📡 Fetching user data for:", userId);
      const response = await fetch(`/alpha/api/user/${userId}`);
      if (response.ok) {
        const userData = await response.json();
        scannedUserName = userData.name || "User";
        console.log("✅ User name fetched:", scannedUserName);
      } else {
        console.warn("⚠️ Failed to fetch user, response not ok:", response.status);
        scannedUserName = "User";
      }
    } catch (err) {
      console.error("❌ Failed to fetch user:", err);
      scannedUserName = "User";
    }
    
    console.log("✅ handleScanned completed, scannedUserId:", scannedUserId);
  }

  async function purchasePackageForUser(packageType: string) {
    if (!scannedUserId || !selectedCupId) return;
    if (purchasing) return;

    purchasing = true;
    successMessage = "";
    errorMessage = "";

    try {
      const response = await fetch("/alpha/api/purchase-package-for-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: scannedUserId,
          packageType,
          cupId: selectedCupId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Purchase failed");
      }

      const result = await response.json();
      successMessage = result.message || `Successfully assigned ${packages.find(p => p.packageType === packageType)?.name}`;

      // Reset after 3 seconds
      setTimeout(() => {
        scannedUserId = null;
        scannedUserName = null;
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

  function resetScan() {
    scannedUserId = null;
    scannedUserName = null;
    successMessage = "";
    errorMessage = "";
  }

  // Cleanup Zero view on destroy
  onDestroy(() => {
    if (cupsView && typeof cupsView.removeListener === "function") {
      cupsView.removeListener();
    }
  });
</script>

{#if checkingAdmin}
  <div class="container">
    <div class="loading">Checking permissions...</div>
  </div>
{:else if isAdmin}
  <div class="container">
    {#if !scannedUserId}
      <div class="scan-page">
        <h1 class="page-title">QR Code Scanner</h1>
        <p class="page-description">
          Select a cup and scan a user's QR code to assign an identity package.
        </p>
        
        {#if loadingCups}
          <div class="loading">Loading cups...</div>
        {:else if cups.length > 0}
          <div class="cup-selector">
            <label for="cup-select">Select Cup:</label>
            <select id="cup-select" bind:value={selectedCupId}>
              {#each cups as cup}
                <option value={cup.id}>
                  {cup.name} {cup.status === "active" ? "(Active)" : `(${cup.status})`}
                </option>
              {/each}
            </select>
          </div>
        {:else}
          <div class="error-message">No cups available. Please create a cup first.</div>
        {/if}
        
        {#if errorMessage}
          <div class="error-message">{errorMessage}</div>
        {/if}
        
        {#if cups.length > 0 && selectedCupId}
          <QRCodeScanner onScanned={handleScanned} onscanned={handleScanned} />
        {/if}
      </div>
    {:else}
      <div class="package-selection">
        <h1 class="page-title">Select Package for {scannedUserName || "User"}</h1>
        {#if cups.length > 0}
          <div class="cup-selector">
            <label for="cup-select-after">Cup:</label>
            <select id="cup-select-after" bind:value={selectedCupId}>
              {#each cups as cup}
                <option value={cup.id}>
                  {cup.name} {cup.status === "active" ? "(Active)" : `(${cup.status})`}
                </option>
              {/each}
            </select>
          </div>
        {:else}
          <div class="error-message">No cups available. Please create a cup first.</div>
        {/if}
        
        {#if successMessage}
          <div class="success-message">{successMessage}</div>
        {/if}
        {#if errorMessage}
          <div class="error-message">{errorMessage}</div>
        {/if}

        <div class="packages-grid">
          {#each packages as pkg}
            <button
              class="package-card"
              onclick={() => purchasePackageForUser(pkg.packageType)}
              disabled={purchasing || !selectedCupId}
            >
              <h3 class="package-name">{pkg.name}</h3>
              <p class="package-weight">Voting Weight: {pkg.votingWeight}x</p>
              <p class="package-price">€{pkg.price}</p>
            </button>
          {/each}
        </div>

        <button class="back-button" onclick={resetScan} disabled={purchasing}>
          Scan Another User
        </button>
      </div>
    {/if}
  </div>
{:else}
  <div class="container">
    <div class="loading">Unauthorized</div>
  </div>
{/if}

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 4rem 1rem;
    min-height: 60vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading {
    text-align: center;
    color: #1a1a4e;
    font-size: 1.125rem;
  }

  .scan-page {
    width: 100%;
    text-align: center;
  }

  .page-title {
    color: #1a1a4e;
    font-size: 2rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
  }

  .page-description {
    color: rgba(26, 26, 78, 0.7);
    font-size: 1rem;
    margin: 0 0 2rem 0;
  }

  .package-selection {
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
  }

  .cup-selector {
    margin: 1.5rem 0 2rem 0;
    display: flex;
    align-items: center;
    gap: 1rem;
    justify-content: center;
  }

  .cup-selector label {
    font-weight: 600;
    color: #1a1a4e;
    font-size: 1rem;
  }

  .cup-selector select {
    padding: 0.75rem 1.5rem;
    border: 2px solid rgba(78, 205, 196, 0.3);
    border-radius: 8px;
    background: white;
    color: #1a1a4e;
    font-size: 1rem;
    cursor: pointer;
    min-width: 250px;
    transition: all 0.2s;
  }

  .cup-selector select:hover {
    border-color: #4ecdc4;
  }

  .cup-selector select:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  }

  .packages-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1.5rem;
    margin: 2rem 0;
  }

  .package-card {
    background: white;
    border: 2px solid rgba(78, 205, 196, 0.3);
    border-radius: 12px;
    padding: 2rem;
    cursor: pointer;
    transition: all 0.2s;
    text-align: center;
  }

  .package-card:hover:not(:disabled) {
    border-color: #4ecdc4;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.2);
  }

  .package-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .package-name {
    color: #1a1a4e;
    font-size: 1.5rem;
    font-weight: 700;
    margin: 0 0 0.5rem 0;
  }

  .package-weight {
    color: rgba(26, 26, 78, 0.7);
    font-size: 0.875rem;
    margin: 0.5rem 0;
  }

  .package-price {
    color: #4ecdc4;
    font-size: 1.5rem;
    font-weight: 700;
    margin: 1rem 0 0 0;
  }

  .back-button {
    background: rgba(26, 26, 78, 0.1);
    color: #1a1a4e;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    border: 2px solid rgba(26, 26, 78, 0.2);
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
    margin-top: 2rem;
    width: 100%;
  }

  .back-button:hover:not(:disabled) {
    background: rgba(26, 26, 78, 0.2);
  }

  .back-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .success-message {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #16a34a;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
    text-align: center;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #dc2626;
    padding: 1rem;
    border-radius: 8px;
    margin: 1rem 0;
    text-align: center;
  }
</style>

