<script lang="ts">
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { nanoid } from "nanoid";
  import { useZero } from "$lib/zero-utils";
  import { getOrCreateWallet } from "$lib/services/walletService";
  import fakeProjectsData from "$lib/fake-projects.json";

  const zeroContext = useZero();
  const session = authClient.useSession();
  const cupId = $page.params.cupId;

  let zero: any = null;
  let cup = $state<any>(null);
  let projects = $state<any[]>([]);
  let matches = $state<any[]>([]);
  let wallets = $state<any[]>([]);
  let loading = $state(true);
  let addingProjects = $state(false);
  let ending = $state(false);
  let determiningWinner = $state<string | null>(null); // matchId being processed
  let selectedMatch = $state<any>(null); // Match detail modal
  let isAdmin = $state(false);
  let checkingAdmin = $state(true);

  onMount(() => {
    let cupView: any;
    let projectsView: any;
    let matchesView: any;
    let walletsView: any;

    (async () => {
      // Wait for session to load
      while ($session.isPending) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (!$session.data?.user) {
        goto("/alpha/cups");
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
            goto(`/alpha/cups/${cupId}`);
            return;
          }
        } else {
          goto(`/alpha/cups/${cupId}`);
          return;
        }
      } catch (error) {
        console.error("Failed to check admin status:", error);
        goto(`/alpha/cups/${cupId}`);
        return;
      }

      // Wait for Zero to be ready
      while (!zeroContext.isReady() || !zeroContext.getInstance()) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      zero = zeroContext.getInstance();

      // Query cup
      const cupQuery = zero.query.cup.where("id", "=", cupId);
      cupView = cupQuery.materialize();

      let hasReceivedData = false;
      let dataCheckTimeout: any = null;

      cupView.addListener((data: any) => {
        const cups = Array.from(data);
        hasReceivedData = true;

        if (cups.length > 0) {
          cup = cups[0];
          loading = false;
          if (dataCheckTimeout) clearTimeout(dataCheckTimeout);
        } else if (hasReceivedData) {
          loading = false;
        }
      });

      // After 3 seconds, if still no cup data, redirect back
      dataCheckTimeout = setTimeout(() => {
        if (!cup) {
          goto("/alpha/cups");
        }
      }, 3000);

      // Query all projects
      const projectsQuery = zero.query.project.orderBy("createdAt", "desc");
      projectsView = projectsQuery.materialize();

      projectsView.addListener((data: any) => {
        projects = Array.from(data);
      });

      // Query cup matches
      const matchesQuery = zero.query.cupMatch
        .where("cupId", "=", cupId)
        .orderBy("position", "asc");
      matchesView = matchesQuery.materialize();

      matchesView.addListener((data: any) => {
        matches = Array.from(data);
      });

      // Query all wallets to show vote counts
      const walletsQuery = zero.query.wallet.where("entityType", "=", "match");
      walletsView = walletsQuery.materialize();

      walletsView.addListener((data: any) => {
        wallets = Array.from(data);
      });
    })();

    return () => {
      if (cupView) cupView.destroy();
      if (projectsView) projectsView.destroy();
      if (matchesView) matchesView.destroy();
      if (walletsView) walletsView.destroy();
    };
  });

  async function addAllProjectsRandomly() {
    if (!zero || !cup || addingProjects) return;

    addingProjects = true;

    try {
      const now = new Date().toISOString();
      let allProjects = [...projects];

      // Bootstrap with fake projects if we have less than 16
      if (allProjects.length < 16) {
        const neededCount = 16 - allProjects.length;
        console.log(`🎭 Bootstrapping with ${neededCount} fake projects...`);

        // Shuffle fake projects and take what we need
        const shuffledFakes = [...fakeProjectsData].sort(
          () => Math.random() - 0.5
        );
        const fakesToCreate = shuffledFakes.slice(0, neededCount);

        // Create fake projects in database as owned by cup creator
        const fakeProjectPromises = fakesToCreate.map(async (fakeData: any) => {
          const projectId = nanoid();
          const newProject = {
            id: projectId,
            title: fakeData.title,
            description: fakeData.description,
            city: fakeData.city,
            userId: $session.data!.user.id, // Cup creator owns fake projects
            sdgs: JSON.stringify(fakeData.sdgs || []),
            createdAt: now,
          };

          await zero.mutate.project.insert(newProject);
          return newProject;
        });

        const createdFakes = await Promise.all(fakeProjectPromises);
        allProjects = [...allProjects, ...createdFakes];

        console.log(`✅ Created ${createdFakes.length} fake projects`);

        // Wait a bit for Zero to sync
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // Get up to 16 projects (real + fake)
      const selectedProjects = allProjects.slice(0, 16);

      // Shuffle all projects randomly
      const shuffled = [...selectedProjects].sort(() => Math.random() - 0.5);

      // Create matches for Round of 16 (8 matches, positions 0-7)
      const matchPromises = [];

      for (let i = 0; i < 8; i++) {
        const project1 = shuffled[i * 2];
        const project2 = shuffled[i * 2 + 1];

        const matchId = nanoid();

        // Create wallets for both projects in this match
        let project1WalletId = "";
        let project2WalletId = "";

        if (project1) {
          const wallet1 = await getOrCreateWallet(
            zero,
            "match",
            `${matchId}-p1`
          );
          project1WalletId = wallet1.id;
        }

        if (project2) {
          const wallet2 = await getOrCreateWallet(
            zero,
            "match",
            `${matchId}-p2`
          );
          project2WalletId = wallet2.id;
        }

        matchPromises.push(
          zero.mutate.cupMatch.insert({
            id: matchId,
            cupId: cup.id,
            round: "round_16",
            position: i,
            project1Id: project1?.id || "",
            project2Id: project2?.id || "",
            project1WalletId,
            project2WalletId,
            winnerId: "",
            status: "pending",
            completedAt: "",
          })
        );
      }

      await Promise.all(matchPromises);

      console.log(
        `✅ Added ${selectedProjects.length} projects to cup (${allProjects.length - projects.length} fake)`
      );
      alert(
        `🎉 Successfully added ${selectedProjects.length} projects to the cup!`
      );
    } catch (error) {
      console.error("Failed to add projects:", error);
      alert("Failed to add projects. Please try again.");
    } finally {
      addingProjects = false;
    }
  }

  async function startCup() {
    if (!cup || cup.status !== "draft" || matches.length === 0) return;

    try {
      // Use server-side API to ensure persistence
      const response = await fetch("/alpha/api/start-cup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cupId: cup.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.details 
          ? `${errorData.error}: ${errorData.details}` 
          : errorData.error || "Failed to start cup";
        throw new Error(errorMsg);
      }

      const result = await response.json();
      console.log("✅ Cup started:", result);
      alert("🎉 Cup started! Voting is now enabled.");

      // Zero will automatically sync the updated cup status
    } catch (error) {
      console.error("Failed to start cup:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      alert(`Failed to start cup: ${message}`);
    }
  }

  async function endCurrentRound() {
    if (!cup || ending) return;

    const confirmed = confirm(
      `Are you sure you want to end the current round?\n\nThis will:\n- Determine winners for all matches\n- Advance winners to the next round\n- Cannot be undone!`
    );

    if (!confirmed) return;

    ending = true;

    try {
      const response = await fetch("/alpha/api/end-round", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cupId: cup.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to end round");
      }

      const result = await response.json();
      console.log("✅ Round ended successfully:", result);
      alert(result.message);
    } catch (error: any) {
      console.error("End round error:", error);
      alert(`Failed to end round: ${error.message}`);
    } finally {
      ending = false;
    }
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "draft":
        return "Application Open";
      case "active":
        return "Active";
      case "completed":
        return "Completed";
      default:
        return status;
    }
  }

  function getRoundLabel(round: string) {
    switch (round) {
      case "round_16":
        return "Round of 16";
      case "quarter":
        return "Quarter Finals";
      case "semi":
        return "Semi Finals";
      case "final":
        return "Final";
      default:
        return round;
    }
  }

  function getProjectById(id: string) {
    return projects.find((p) => p.id === id);
  }

  function getWalletVotes(walletId: string) {
    const wallet = wallets.find((w) => w.id === walletId);
    return wallet?.balance || 0;
  }

  async function determineMatchWinner(matchId: string) {
    if (determiningWinner) return;

    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    determiningWinner = matchId;

    try {
      const response = await fetch("/alpha/api/determine-match-winner", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ matchId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to determine winner");
      }

      const result = await response.json();
      console.log("✅ Winner determined:", result);
    } catch (error: any) {
      console.error("Determine winner error:", error);
      alert(`Failed to determine winner: ${error.message}`);
    } finally {
      determiningWinner = null;
    }
  }
</script>

<div class="min-h-screen bg-cream p-8">
  <div class="max-w-7xl mx-auto">
    {#if loading}
      <div class="card p-8 text-center">
        <p class="text-navy/70">Loading cup...</p>
      </div>
    {:else if cup}
      <!-- Header -->
      <div class="mb-8">
        <a
          href="/alpha/cups/{cupId}"
          class="text-teal hover:underline mb-4 inline-block"
        >
          ← Back to Cup
        </a>
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-5xl font-bold text-navy mb-2">{cup.name}</h1>
            <p class="text-navy/60 text-lg">Cup Admin Panel</p>
          </div>
          <a href="/alpha/cups" class="btn-secondary">All Cups</a>
        </div>
      </div>

      <!-- Cup Status -->
      <div class="card p-6 mb-8">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-navy/60 text-sm mb-1">Status</p>
            <p class="text-2xl font-bold text-navy">
              {getStatusLabel(cup.status)}
            </p>
          </div>
          {#if cup.currentRound}
            <div>
              <p class="text-navy/60 text-sm mb-1">Current Round</p>
              <p class="text-xl font-bold text-teal">
                {getRoundLabel(cup.currentRound)}
              </p>
            </div>
          {/if}
          <div>
            <p class="text-navy/60 text-sm mb-1">Matches</p>
            <p class="text-2xl font-bold text-navy">{matches.length}</p>
          </div>
        </div>
      </div>

      <!-- Actions -->
      {#if cup.status === "draft"}
        <div class="card p-6 mb-8">
          <h2 class="text-2xl font-bold text-navy mb-4">Setup Tournament</h2>
          <p class="text-navy/60 mb-6">
            Add projects to your tournament bracket. The cup will automatically
            bootstrap with demo projects if needed to reach 16 participants.
          </p>
          <button
            onclick={addAllProjectsRandomly}
            disabled={addingProjects}
            class="btn-primary"
          >
            {addingProjects
              ? "Adding Projects..."
              : projects.length >= 16
                ? `Add All Projects (${projects.length})`
                : `Bootstrap Cup (${projects.length} real + ${16 - projects.length} demo)`}
          </button>
          {#if projects.length === 0}
            <p class="text-navy/50 text-sm mt-2">
              🎭 No projects yet? No problem! Click to create a demo cup with 16
              sample startups.
            </p>
          {:else if projects.length < 16}
            <p class="text-navy/50 text-sm mt-2">
              Only {projects.length} real project{projects.length === 1
                ? ""
                : "s"}. We'll add {16 - projects.length} demo projects to complete
              the bracket.
            </p>
          {/if}
        </div>
      {/if}

      {#if cup.status === "draft" && matches.length > 0}
        <div
          class="card p-6 mb-8 border-2 border-teal/30 bg-gradient-to-br from-teal/5 to-yellow/5"
        >
          <h2 class="text-2xl font-bold text-navy mb-4">🚀 Ready to Start?</h2>
          <p class="text-navy/60 mb-6">
            Your tournament is set up with {matches.length} matches. Start the cup
            to enable voting!
          </p>
          <button onclick={startCup} class="btn-start">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Start Cup & Enable Voting
          </button>
        </div>
      {/if}

      {#if cup.status === "active" && cup.currentRound}
        <div
          class="card p-6 mb-8 border-2 border-yellow/30 bg-gradient-to-br from-yellow/5 to-teal/5"
        >
          <h2 class="text-2xl font-bold text-navy mb-4">
            🏆 Current Round: {getRoundLabel(cup.currentRound)}
          </h2>
          <p class="text-navy/60 mb-6">
            End this round to determine winners for all matches and
            automatically advance them to the next round.
          </p>
          <button
            onclick={endCurrentRound}
            class="btn-primary"
            disabled={ending}
          >
            {#if ending}
              <svg class="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                  fill="none"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Ending Round...
            {:else}
              End Round & Advance Winners
            {/if}
          </button>
        </div>
      {/if}

      <!-- Matches -->
      {#if matches.length > 0}
        <div class="card p-6">
          <h2 class="text-2xl font-bold text-navy mb-6">Tournament Matches</h2>

          <div class="space-y-6">
            {#each ["round_16", "quarter", "semi", "final"] as round}
              {@const roundMatches = matches.filter((m) => m.round === round)}
              {#if roundMatches.length > 0}
                <div>
                  <h3 class="text-xl font-bold text-navy mb-4">
                    {getRoundLabel(round)}
                  </h3>
                  <div class="space-y-3">
                    {#each roundMatches as match}
                      {@const project1 = getProjectById(match.project1Id)}
                      {@const project2 = getProjectById(match.project2Id)}
                      {@const votes1 = getWalletVotes(match.project1WalletId)}
                      {@const votes2 = getWalletVotes(match.project2WalletId)}
                      <button
                        onclick={() => (selectedMatch = match)}
                        class="match-list-item"
                      >
                        <div class="match-list-teams">
                          <span
                            class="team-list-name"
                            class:winner-text={match.winnerId ===
                              match.project1Id}
                          >
                            {project1?.title || "TBD"}
                          </span>
                          <span class="team-list-votes">{votes1}</span>
                        </div>
                        <div class="match-list-vs">VS</div>
                        <div class="match-list-teams">
                          <span
                            class="team-list-name"
                            class:winner-text={match.winnerId ===
                              match.project2Id}
                          >
                            {project2?.title || "TBD"}
                          </span>
                          <span class="team-list-votes">{votes2}</span>
                        </div>
                        <div class="match-list-action">
                          {#if match.winnerId}
                            <span class="status-icon completed">✓</span>
                          {:else if cup.status === "active"}
                            <span class="status-icon pending">●</span>
                          {:else}
                            <span class="status-icon waiting">⏳</span>
                          {/if}
                        </div>
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<!-- Match Detail Modal -->
{#if selectedMatch}
  {@const project1 = getProjectById(selectedMatch.project1Id)}
  {@const project2 = getProjectById(selectedMatch.project2Id)}
  {@const votes1 = getWalletVotes(selectedMatch.project1WalletId)}
  {@const votes2 = getWalletVotes(selectedMatch.project2WalletId)}
  <div
    class="modal-overlay"
    onclick={() => (selectedMatch = null)}
    onkeydown={(e) => e.key === "Escape" && (selectedMatch = null)}
    role="dialog"
    aria-modal="true"
    aria-label="Match details"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="modal-content" onclick={(e) => e.stopPropagation()}>
      <button
        class="modal-close"
        onclick={() => (selectedMatch = null)}
        aria-label="Close"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      <h2 class="modal-title">
        {getRoundLabel(selectedMatch.round)} - Match Details
      </h2>

      <div class="modal-match">
        <div
          class="modal-team"
          class:modal-winner={selectedMatch.winnerId ===
            selectedMatch.project1Id}
        >
          <div class="modal-team-header">
            <h3 class="modal-team-name">{project1?.title || "TBD"}</h3>
            {#if selectedMatch.winnerId === selectedMatch.project1Id}
              <span class="winner-badge">Winner</span>
            {/if}
          </div>
          {#if project1?.description}
            <p class="modal-team-desc">{project1.description}</p>
          {/if}
          {#if project1?.city}
            <p class="modal-team-city">📍 {project1.city}</p>
          {/if}
          <div class="modal-votes">{votes1} votes</div>
        </div>

        <div class="modal-vs">VS</div>

        <div
          class="modal-team"
          class:modal-winner={selectedMatch.winnerId ===
            selectedMatch.project2Id}
        >
          <div class="modal-team-header">
            <h3 class="modal-team-name">{project2?.title || "TBD"}</h3>
            {#if selectedMatch.winnerId === selectedMatch.project2Id}
              <span class="winner-badge">Winner</span>
            {/if}
          </div>
          {#if project2?.description}
            <p class="modal-team-desc">{project2.description}</p>
          {/if}
          {#if project2?.city}
            <p class="modal-team-city">📍 {project2.city}</p>
          {/if}
          <div class="modal-votes">{votes2} votes</div>
        </div>
      </div>

      {#if !selectedMatch.winnerId && cup.status === "active"}
        <button
          onclick={() => {
            determineMatchWinner(selectedMatch.id);
            selectedMatch = null;
          }}
          class="btn-determine-modal"
          disabled={determiningWinner === selectedMatch.id}
        >
          {#if determiningWinner === selectedMatch.id}
            <svg class="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
              <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
                fill="none"
              ></circle>
              <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Determining...
          {:else}
            🏆 Determine Winner
          {/if}
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .bg-cream {
    background-color: #fef9f0;
  }

  .card {
    background: white;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(26, 26, 78, 0.06);
    border: 1px solid rgba(26, 26, 78, 0.08);
  }

  .btn-primary {
    padding: 0.875rem 2rem;
    background: linear-gradient(135deg, #4ecdc4 0%, #1a1a4e 100%);
    color: white;
    border-radius: 12px;
    font-weight: 600;
    font-size: 1rem;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(78, 205, 196, 0.3);
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-start {
    padding: 1rem 2.5rem;
    background: linear-gradient(135deg, #f4d03f 0%, #4ecdc4 100%);
    color: #1a1a4e;
    border-radius: 16px;
    font-weight: 700;
    font-size: 1.125rem;
    border: none;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    justify-content: center;
    box-shadow: 0 8px 24px rgba(244, 208, 63, 0.4);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .btn-start:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(244, 208, 63, 0.5);
  }

  .btn-start:active {
    transform: translateY(-1px);
  }

  .btn-secondary {
    padding: 0.75rem 1.5rem;
    background: white;
    color: #1a1a4e;
    border: 2px solid rgba(26, 26, 78, 0.2);
    border-radius: 12px;
    font-weight: 600;
    text-decoration: none;
    display: inline-block;
    transition: all 0.2s;
  }

  .btn-secondary:hover {
    background: rgba(26, 26, 78, 0.05);
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Compact Match List */
  .match-list-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: white;
    border: 2px solid rgba(26, 26, 78, 0.08);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    text-align: left;
  }

  .match-list-item:hover {
    border-color: rgba(78, 205, 196, 0.3);
    box-shadow: 0 4px 16px rgba(78, 205, 196, 0.15);
    transform: translateY(-2px);
  }

  .match-list-teams {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
  }

  .team-list-name {
    font-weight: 600;
    color: #1a1a4e;
    font-size: 1rem;
  }

  .winner-text {
    color: #f4d03f;
    font-weight: 700;
  }

  .team-list-votes {
    font-size: 0.875rem;
    font-weight: 600;
    color: rgba(26, 26, 78, 0.6);
    padding: 0.25rem 0.75rem;
    background: rgba(26, 26, 78, 0.05);
    border-radius: 6px;
  }

  .match-list-vs {
    font-weight: 800;
    color: rgba(26, 26, 78, 0.4);
    font-size: 0.75rem;
  }

  .match-list-action {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .status-icon {
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .status-icon.completed {
    color: #4ecdc4;
  }

  .status-icon.pending {
    color: #f4d03f;
  }

  .status-icon.waiting {
    color: rgba(26, 26, 78, 0.3);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    padding: 2rem;
  }

  .modal-content {
    background: white;
    border-radius: 24px;
    max-width: 900px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    padding: 2.5rem;
    position: relative;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  .modal-close {
    position: absolute;
    top: 1.5rem;
    right: 1.5rem;
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 50%;
    border: none;
    background: rgba(26, 26, 78, 0.1);
    color: #1a1a4e;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: rgba(26, 26, 78, 0.2);
    transform: rotate(90deg);
  }

  .modal-close svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  .modal-title {
    font-size: 2rem;
    font-weight: 800;
    color: #1a1a4e;
    margin-bottom: 2rem;
  }

  .modal-match {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 2rem;
    margin-bottom: 2rem;
  }

  .modal-team {
    padding: 1.5rem;
    background: rgba(26, 26, 78, 0.02);
    border: 2px solid rgba(26, 26, 78, 0.08);
    border-radius: 16px;
    transition: all 0.3s;
  }

  .modal-winner {
    background: rgba(244, 208, 63, 0.08);
    border-color: #f4d03f;
  }

  .modal-team-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .modal-team-name {
    font-size: 1.5rem;
    font-weight: 700;
    color: #1a1a4e;
  }

  .winner-badge {
    padding: 0.375rem 0.875rem;
    background: linear-gradient(135deg, #f4d03f 0%, #4ecdc4 100%);
    color: #1a1a4e;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .modal-team-desc {
    color: rgba(26, 26, 78, 0.7);
    font-size: 0.9375rem;
    line-height: 1.6;
    margin-bottom: 0.75rem;
  }

  .modal-team-city {
    color: rgba(26, 26, 78, 0.5);
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .modal-votes {
    font-size: 1.875rem;
    font-weight: 800;
    color: #4ecdc4;
    text-align: center;
    padding: 0.75rem;
    background: rgba(78, 205, 196, 0.1);
    border-radius: 12px;
  }

  .modal-vs {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    font-weight: 900;
    color: rgba(26, 26, 78, 0.3);
  }

  .btn-determine-modal {
    width: 100%;
    padding: 1.25rem 2rem;
    background: linear-gradient(135deg, #f4d03f 0%, #4ecdc4 100%);
    color: #1a1a4e;
    border: none;
    border-radius: 16px;
    font-weight: 700;
    font-size: 1.125rem;
    cursor: pointer;
    transition: all 0.3s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    box-shadow: 0 8px 24px rgba(244, 208, 63, 0.3);
  }

  .btn-determine-modal:hover:not(:disabled) {
    transform: translateY(-3px);
    box-shadow: 0 12px 32px rgba(244, 208, 63, 0.4);
  }

  .btn-determine-modal:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .text-navy {
    color: #1a1a4e;
  }

  .text-teal {
    color: #4ecdc4;
  }
</style>

