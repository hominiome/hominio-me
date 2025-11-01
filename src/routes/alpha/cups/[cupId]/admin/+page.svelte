<script>
  import { onMount } from "svelte";
  import { authClient } from "$lib/auth.client.js";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import { nanoid } from "nanoid";
  import { useZero } from "$lib/zero-utils";
  // Wallet service no longer needed - votes tracked in vote table
  import fakeProjectsData from "$lib/fake-projects.json";
  import { showSuccess, showError } from "$lib/toastStore.js";
  import ConfirmDialog from "$lib/ConfirmDialog.svelte";
  import DatePicker from "$lib/DatePicker.svelte";
  import TimePicker from "$lib/TimePicker.svelte";
  import CountdownTimer from "$lib/CountdownTimer.svelte";
  import { combineDateAndTime, formatEndDate } from "$lib/dateUtils.js";

  const zeroContext = useZero();
  const session = authClient.useSession();
  const cupId = $page.params.cupId;

  let zero = null;
  let cup = $state(null);
  let projects = $state([]);
  let matches = $state([]);
  let votes = $state([]); // All vote records
  let loading = $state(true);
  let addingProjects = $state(false);
  let creatingFakeProjects = $state(false);
  let ending = $state(false);
  let startingNextRound = $state(false);
  let determiningWinner = $state(null); // matchId being processed
  let selectedMatch = $state(null); // Match detail modal
  let isAdmin = $state(false);
  let checkingAdmin = $state(true);
  let showEndRoundConfirm = $state(false);
  let showStartCupModal = $state(false);
  let showStartNextRoundModal = $state(false);
  let startCupDate = $state("");
  let startCupTime = $state("");
  let startNextRoundDate = $state("");
  let startNextRoundTime = $state("");

  onMount(() => {
    let cupView;
    let projectsView;
    let matchesView;
    let votesView;

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
      let dataCheckTimeout = null;

      cupView.addListener((data) => {
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

      projectsView.addListener((data) => {
        projects = Array.from(data);
      });

      // Query cup matches
      const matchesQuery = zero.query.cupMatch
        .where("cupId", "=", cupId)
        .orderBy("position", "asc");
      matchesView = matchesQuery.materialize();

      matchesView.addListener((data) => {
        matches = Array.from(data);
      });

      // Query all votes to show vote counts
      const votesQuery = zero.query.vote;
      votesView = votesQuery.materialize();

      votesView.addListener((data) => {
        votes = Array.from(data);
      });
    })();

    return () => {
      if (cupView) cupView.destroy();
      if (projectsView) projectsView.destroy();
      if (matchesView) matchesView.destroy();
      if (votesView) votesView.destroy();
    };
  });

  // Get the first round name based on cup size
  function getFirstRoundName(size) {
    return `round_${size}`;
  }

  // Get selected project IDs from cup.selectedProjectIds (not from matches during selection)
  const selectedProjectIds = $derived(() => {
    if (!cup) return new Set();

    // If cup is draft, read from selectedProjectIds field
    if (cup.status === "draft") {
      try {
        const ids = cup.selectedProjectIds
          ? JSON.parse(cup.selectedProjectIds)
          : [];
        return new Set(ids);
      } catch (e) {
        return new Set();
      }
    }

    // If cup is active/completed, read from matches (matches exist now)
    if (matches.length === 0) return new Set();
    const firstRound = getFirstRoundName(cup.size || 16);
    const firstRoundMatches = matches.filter((m) => m.round === firstRound);
    const ids = new Set();
    firstRoundMatches.forEach((match) => {
      // Only count projects that have non-empty IDs
      if (match.project1Id && match.project1Id.trim())
        ids.add(match.project1Id);
      if (match.project2Id && match.project2Id.trim())
        ids.add(match.project2Id);
    });
    return ids;
  });

  // Get available projects (not in cup)
  const availableProjects = $derived(() => {
    const selected = selectedProjectIds();
    return projects.filter((p) => !selected.has(p.id));
  });

  // Get selected projects (in cup)
  const selectedProjects = $derived(() => {
    const selected = selectedProjectIds();
    return projects.filter((p) => selected.has(p.id));
  });

  // Check if we can add more projects
  const canAddMoreProjects = $derived(() => {
    if (!cup) return false;
    return selectedProjects().length < (cup.size || 16);
  });

  // Check if cup is ready to start
  const isCupReadyToStart = $derived(() => {
    if (!cup) return false;
    return selectedProjects().length === (cup.size || 16);
  });

  // Add a project to the cup
  async function addProjectToCup(projectId) {
    if (!cup || addingProjects || !canAddMoreProjects()) return;

    addingProjects = true;

    try {
      const response = await fetch("/alpha/api/add-project-to-cup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cupId, projectId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to add project");
      }

      showSuccess("Project added to cup!");

      // Wait a bit for Zero to sync
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error("Failed to add project:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to add project. Please try again.";
      showError(message);
    } finally {
      addingProjects = false;
    }
  }

  // Remove a project from the cup
  async function removeProjectFromCup(projectId) {
    if (!cup || addingProjects) return;

    addingProjects = true;

    try {
      const response = await fetch("/alpha/api/remove-project-from-cup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cupId, projectId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove project");
      }

      showSuccess("Project removed from cup!");

      // Wait a bit for Zero to sync
      await new Promise((resolve) => setTimeout(resolve, 300));
    } catch (error) {
      console.error("Failed to remove project:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to remove project. Please try again.";
      showError(message);
    } finally {
      addingProjects = false;
    }
  }

  // Create fake projects
  async function createFakeProjects(count) {
    if (!zero || !cup || creatingFakeProjects) return;

    creatingFakeProjects = true;

    try {
      const now = new Date().toISOString();

      // Get existing project titles to avoid duplicates
      const existingTitles = new Set(
        projects.map((p) => p.title.toLowerCase().trim())
      );

      // Filter out fake projects that already exist
      const availableFakes = fakeProjectsData.filter(
        (fakeData) => !existingTitles.has(fakeData.title.toLowerCase().trim())
      );

      if (availableFakes.length === 0) {
        showError("All fake projects have already been created!");
        creatingFakeProjects = false;
        return;
      }

      // Shuffle available fake projects and take what we need
      const shuffledFakes = [...availableFakes].sort(() => Math.random() - 0.5);
      const fakesToCreate = shuffledFakes.slice(
        0,
        Math.min(count, availableFakes.length)
      );

      if (fakesToCreate.length < count) {
        showError(
          `Only ${fakesToCreate.length} unique fake projects available (${count} requested)`
        );
      }

      // Create fake projects in database as owned by cup creator
      const fakeProjectPromises = fakesToCreate.map(async (fakeData) => {
        const projectId = nanoid();
        const newProject = {
          id: projectId,
          title: fakeData.title,
          description: fakeData.description,
          country: fakeData.country || "",
          city: fakeData.city,
          userId: $session.data?.user?.id || "", // Cup creator owns fake projects
          sdgs: JSON.stringify(fakeData.sdgs || []),
          createdAt: now,
        };

        await zero.mutate.project.insert(newProject);
        return newProject;
      });

      await Promise.all(fakeProjectPromises);

      console.log(`✅ Created ${fakesToCreate.length} fake projects`);
      showSuccess(`🎉 Created ${fakesToCreate.length} fake projects!`);

      // Wait a bit for Zero to sync
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error("Failed to create fake projects:", error);
      showError("Failed to create fake projects. Please try again.");
    } finally {
      creatingFakeProjects = false;
    }
  }

  function requestStartCup() {
    if (!cup || cup.status !== "draft" || !isCupReadyToStart()) return;
    // Set default date/time to tomorrow at noon
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    startCupDate = tomorrow.toISOString().split("T")[0];
    startCupTime = "12:00";
    showStartCupModal = true;
  }

  async function startCup() {
    if (!cup || cup.status !== "draft") {
      console.error("Cannot start cup: cup is not in draft status");
      return;
    }

    if (!isCupReadyToStart()) {
      showError(
        `Please select exactly ${cup.size || 16} projects before starting`
      );
      return;
    }

    if (!startCupDate || !startCupTime) {
      showError("Please select both date and time");
      return;
    }

    const endDate = combineDateAndTime(startCupDate, startCupTime);
    if (!endDate) {
      showError("Invalid date/time selected");
      return;
    }

    console.log("🚀 Starting cup:", {
      cupId,
      endDate,
      selectedProjects: selectedProjects().length,
    });

    try {
      // Use server-side API to ensure persistence
      const response = await fetch("/alpha/api/start-cup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cupId: cupId, endDate }), // Use cupId from URL params
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
      showSuccess("🎉 Cup started! Voting is now enabled.");
      showStartCupModal = false;

      // Zero will automatically sync the updated cup status and matches
    } catch (error) {
      console.error("Failed to start cup:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      showError(`Failed to start cup: ${message}`);
    }
  }

  function requestStartNextRound() {
    if (!cup || cup.status !== "active" || !cup.currentRound) return;

    // Check if next round exists
    const currentRound = cup.currentRound;
    let nextRound = null;
    if (currentRound === "round_128") {
      nextRound = "round_64";
    } else if (currentRound === "round_64") {
      nextRound = "round_32";
    } else if (currentRound === "round_32") {
      nextRound = "round_16";
    } else if (currentRound === "round_16") {
      nextRound = "quarter";
    } else if (currentRound === "round_8") {
      nextRound = "semi";
    } else if (currentRound === "round_4") {
      nextRound = "final";
    } else if (currentRound === "quarter") {
      nextRound = "semi";
    } else if (currentRound === "semi") {
      nextRound = "final";
    }

    if (!nextRound) {
      showError("No next round available");
      return;
    }

    // Check if next round already exists
    const nextRoundMatches = matches.filter((m) => m.round === nextRound);
    if (nextRoundMatches.length > 0) {
      showError("Next round already exists");
      return;
    }

    // Set default date/time to tomorrow at noon
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    startNextRoundDate = tomorrow.toISOString().split("T")[0];
    startNextRoundTime = "12:00";
    showStartNextRoundModal = true;
  }

  async function startNextRound() {
    if (!cup || cup.status !== "active" || !cup.currentRound) return;
    if (!startNextRoundDate || !startNextRoundTime) {
      showError("Please select both date and time");
      return;
    }

    const endDate = combineDateAndTime(startNextRoundDate, startNextRoundTime);
    if (!endDate) {
      showError("Invalid date/time selected");
      return;
    }

    startingNextRound = true;

    try {
      const response = await fetch("/alpha/api/start-next-round", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cupId: cupId, endDate }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to start next round");
      }

      const result = await response.json();
      console.log("✅ Next round started:", result);
      showSuccess(result.message);
      showStartNextRoundModal = false;
    } catch (error) {
      console.error("Start next round error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      showError(`Failed to start next round: ${message}`);
    } finally {
      startingNextRound = false;
    }
  }

  function requestEndRound() {
    if (!cup || ending) return;
    showEndRoundConfirm = true;
  }

  async function endCurrentRound() {
    if (!cup || ending) return;

    ending = true;

    try {
      const response = await fetch("/alpha/api/end-round", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cupId: cupId }), // Use cupId from URL params
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to end round");
      }

      const result = await response.json();
      console.log("✅ Round ended successfully:", result);
      showSuccess(result.message);
    } catch (error) {
      console.error("End round error:", error);
      showError(`Failed to end round: ${error.message}`);
    } finally {
      ending = false;
    }
  }

  function getStatusLabel(status) {
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

  function getRoundLabel(round) {
    switch (round) {
      case "round_4":
        return "Round of 4";
      case "round_8":
        return "Round of 8";
      case "round_16":
        return "Round of 16";
      case "round_32":
        return "Round of 32";
      case "round_64":
        return "Round of 64";
      case "round_128":
        return "Round of 128";
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

  function getProjectById(id) {
    return projects.find((p) => p.id === id);
  }

  // Calculate vote totals from vote table
  function getMatchVotes(matchId, projectSide) {
    return votes
      .filter((v) => v.matchId === matchId && v.projectSide === projectSide)
      .reduce((sum, v) => sum + (v.votingWeight || 0), 0);
  }

  async function determineMatchWinner(matchId) {
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
      showSuccess("Winner determined successfully!");
    } catch (error) {
      console.error("Determine winner error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      showError(`Failed to determine winner: ${message}`);
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
        <div class="flex items-center justify-between flex-wrap gap-4">
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
          {#if cup.endDate}
            <div>
              <p class="text-navy/60 text-sm mb-1">Time Remaining</p>
              <p class="text-lg font-semibold text-navy">
                <CountdownTimer endDate={cup.endDate} displayFormat="compact" />
              </p>
            </div>
          {/if}
        </div>
      </div>

      <!-- Actions -->
      {#if cup.status === "draft"}
        <div class="card p-6 mb-8">
          <h2 class="text-2xl font-bold text-navy mb-4">Setup Tournament</h2>
          <p class="text-navy/60 mb-6">
            Select exactly {cup.size || 16} projects for your tournament bracket.
            Click projects to move them between available and selected pools.
          </p>

          <!-- Project Count -->
          <div class="project-count mb-6">
            <div class="project-count-item">
              <span class="project-count-label">Selected:</span>
              <span
                class="project-count-value"
                class:count-complete={isCupReadyToStart()}
              >
                {selectedProjects().length} / {cup.size || 16}
              </span>
            </div>
          </div>

          <!-- Two Column Layout -->
          <div class="project-selection-grid">
            <!-- Left Column: Available Projects -->
            <div class="project-column">
              <div class="project-column-header">
                <h3 class="project-column-title">Available Projects</h3>
                <div class="fake-project-buttons">
                  <button
                    onclick={() => createFakeProjects(4)}
                    disabled={creatingFakeProjects}
                    class="btn-fake"
                    title="Create 4 random fake projects"
                  >
                    +4
                  </button>
                  <button
                    onclick={() => createFakeProjects(8)}
                    disabled={creatingFakeProjects}
                    class="btn-fake"
                    title="Create 8 random fake projects"
                  >
                    +8
                  </button>
                  <button
                    onclick={() => createFakeProjects(16)}
                    disabled={creatingFakeProjects}
                    class="btn-fake"
                    title="Create 16 random fake projects"
                  >
                    +16
                  </button>
                </div>
              </div>
              <div class="project-list">
                {#if availableProjects().length === 0}
                  <p class="text-navy/50 text-sm p-4 text-center">
                    No available projects. Create some fake projects to get
                    started!
                  </p>
                {:else}
                  {#each availableProjects() as project}
                    <button
                      onclick={() => addProjectToCup(project.id)}
                      disabled={!canAddMoreProjects() || addingProjects}
                      class="project-card"
                      class:disabled={!canAddMoreProjects()}
                    >
                      <div class="project-card-content">
                        <h4 class="project-card-title">{project.title}</h4>
                        {#if project.description}
                          <p class="project-card-desc">{project.description}</p>
                        {/if}
                        {#if project.city}
                          <p class="project-card-location">
                            📍 {project.city}{project.country
                              ? `, ${project.country}`
                              : ""}
                          </p>
                        {/if}
                      </div>
                      <div class="project-card-action">
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </div>
                    </button>
                  {/each}
                {/if}
              </div>
            </div>

            <!-- Right Column: Selected Projects -->
            <div class="project-column">
              <div class="project-column-header">
                <h3 class="project-column-title">Selected Projects</h3>
                <span class="project-column-count">
                  {selectedProjects().length} / {cup.size || 16}
                </span>
              </div>
              <div class="project-list">
                {#if selectedProjects().length === 0}
                  <p class="text-navy/50 text-sm p-4 text-center">
                    No projects selected yet. Click projects on the left to add
                    them.
                  </p>
                {:else}
                  {#each selectedProjects() as project}
                    <button
                      onclick={() => removeProjectFromCup(project.id)}
                      disabled={addingProjects}
                      class="project-card project-card-selected"
                    >
                      <div class="project-card-content">
                        <h4 class="project-card-title">{project.title}</h4>
                        {#if project.description}
                          <p class="project-card-desc">{project.description}</p>
                        {/if}
                        {#if project.city}
                          <p class="project-card-location">
                            📍 {project.city}{project.country
                              ? `, ${project.country}`
                              : ""}
                          </p>
                        {/if}
                      </div>
                      <div class="project-card-action">
                        <svg
                          class="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </div>
                    </button>
                  {/each}
                {/if}
              </div>
            </div>
          </div>
        </div>
      {/if}

      {#if cup.status === "draft" && isCupReadyToStart()}
        <div
          class="card p-6 mb-8 border-2 border-teal/30 bg-gradient-to-br from-teal/5 to-yellow/5"
        >
          <h2 class="text-2xl font-bold text-navy mb-4">🚀 Ready to Start?</h2>
          <p class="text-navy/60 mb-6">
            Your tournament is set up with {selectedProjects().length} projects.
            Start the cup to enable voting!
          </p>
          <button onclick={requestStartCup} class="btn-start">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
            Start Cup & Enable Voting
          </button>
        </div>
      {:else if cup.status === "draft"}
        <div
          class="card p-6 mb-8 border-2 border-yellow/30 bg-gradient-to-br from-yellow/5 to-teal/5"
        >
          <h2 class="text-2xl font-bold text-navy mb-4">⏳ Not Ready Yet</h2>
          <p class="text-navy/60 mb-6">
            Please select exactly {cup.size || 16} projects before starting the cup.
            Currently selected: {selectedProjects().length} / {cup.size || 16}
          </p>
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
            End this round to determine winners for all matches. Use "Start Next
            Round" to advance winners after ending.
          </p>
          <button
            onclick={requestEndRound}
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
              End Round & Determine Winners
            {/if}
          </button>
        </div>
      {/if}

      {#if cup.status === "active" && cup.currentRound}
        {@const currentRound = cup.currentRound}
        {@const nextRound =
          currentRound === "round_128"
            ? "round_64"
            : currentRound === "round_64"
              ? "round_32"
              : currentRound === "round_32"
                ? "round_16"
                : currentRound === "round_16"
                  ? "quarter"
                  : currentRound === "round_8"
                    ? "semi"
                    : currentRound === "round_4"
                      ? "final"
                      : currentRound === "quarter"
                        ? "semi"
                        : currentRound === "semi"
                          ? "final"
                          : null}
        {@const nextRoundMatches = matches.filter((m) => m.round === nextRound)}
        {#if nextRound && nextRoundMatches.length === 0}
          {@const currentRoundMatches = matches.filter(
            (m) => m.round === currentRound
          )}
          {@const allHaveWinners =
            currentRoundMatches.length > 0 &&
            currentRoundMatches.every((m) => m.winnerId)}
          {#if allHaveWinners}
            <div
              class="card p-6 mb-8 border-2 border-teal/30 bg-gradient-to-br from-teal/5 to-yellow/5"
            >
              <h2 class="text-2xl font-bold text-navy mb-4">
                🚀 Start Next Round: {getRoundLabel(nextRound)}
              </h2>
              <p class="text-navy/60 mb-6">
                All winners have been determined. Start the next round to create
                matches and enable voting.
              </p>
              <button
                onclick={requestStartNextRound}
                class="btn-start"
                disabled={startingNextRound}
              >
                {#if startingNextRound}
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
                  Starting...
                {:else}
                  <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Start Next Round
                {/if}
              </button>
            </div>
          {/if}
        {/if}
      {/if}

      <!-- Matches (only show if cup is active/completed, not during draft selection) -->
      {#if cup.status !== "draft" && matches.length > 0}
        <div class="card p-6">
          <h2 class="text-2xl font-bold text-navy mb-6">Tournament Matches</h2>

          <div class="space-y-6">
            {#if cup}
              {@const roundsToShow = (() => {
                // Dynamically determine which rounds to show based on cup size
                const cupSize = cup.size || 16;
                const rounds = [];

                // Add first round based on size
                rounds.push(`round_${cupSize}`);

                // Add intermediate rounds if needed
                if (cupSize >= 32) rounds.push("round_16");
                if (cupSize >= 64) rounds.push("round_32");
                if (cupSize >= 128) rounds.push("round_64");

                // Add standard rounds
                if (cupSize >= 16) rounds.push("quarter");
                if (cupSize >= 8) rounds.push("semi");
                rounds.push("final");

                return rounds;
              })()}
              {#each roundsToShow as round}
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
                        {@const votes1 = getMatchVotes(match.id, "project1")}
                        {@const votes2 = getMatchVotes(match.id, "project2")}
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
            {/if}
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
  {@const votes1 = getMatchVotes(selectedMatch.id, "project1")}
  {@const votes2 = getMatchVotes(selectedMatch.id, "project2")}
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
    <div
      class="modal-content"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
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
            <p class="modal-team-city">
              📍 {project1.city}{project1?.country
                ? `, ${project1.country}`
                : ""}
            </p>
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
            <p class="modal-team-city">
              📍 {project2.city}{project2?.country
                ? `, ${project2.country}`
                : ""}
            </p>
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

<!-- End Round Confirmation Dialog -->
<ConfirmDialog
  bind:open={showEndRoundConfirm}
  title="End Current Round"
  message="Are you sure you want to end the current round?

This will:
- Determine winners for all matches
- Cannot be undone!"
  confirmText="End Round"
  cancelText="Cancel"
  variant="danger"
  onConfirm={endCurrentRound}
/>

<!-- Start Cup Date/Time Modal -->
{#if showStartCupModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    onclick={() => (showStartCupModal = false)}
    onkeydown={(e) => e.key === "Escape" && (showStartCupModal = false)}
  >
    <div
      class="modal-content"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <button
        class="modal-close"
        onclick={() => (showStartCupModal = false)}
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

      <h2 class="modal-title">Start Cup</h2>
      <p class="text-navy/60 mb-6">
        Set the end date and time for this cup. All matches in the first round
        will use this end date.
      </p>

      <div class="space-y-4">
        <div>
          <label
            for="start-cup-date"
            class="block text-sm font-semibold text-navy mb-2">End Date</label
          >
          <DatePicker
            id="start-cup-date"
            value={startCupDate}
            onChange={(value) => (startCupDate = value)}
            minDate={new Date().toISOString().split("T")[0]}
          />
        </div>

        <div>
          <label
            for="start-cup-time"
            class="block text-sm font-semibold text-navy mb-2">End Time</label
          >
          <TimePicker
            id="start-cup-time"
            value={startCupTime}
            onChange={(value) => (startCupTime = value)}
          />
        </div>
      </div>

      <div class="flex gap-4 mt-6">
        <button
          onclick={() => (showStartCupModal = false)}
          class="btn-secondary flex-1"
        >
          Cancel
        </button>
        <button onclick={startCup} class="btn-primary flex-1">
          Start Cup
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Start Next Round Date/Time Modal -->
{#if showStartNextRoundModal}
  <div
    class="modal-overlay"
    role="button"
    tabindex="0"
    onclick={() => (showStartNextRoundModal = false)}
    onkeydown={(e) => e.key === "Escape" && (showStartNextRoundModal = false)}
  >
    <div
      class="modal-content"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
    >
      <button
        class="modal-close"
        onclick={() => (showStartNextRoundModal = false)}
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

      <h2 class="modal-title">Start Next Round</h2>
      <p class="text-navy/60 mb-6">
        Set the end date and time for the next round. All matches in this round
        will use this end date.
      </p>

      <div class="space-y-4">
        <div>
          <label
            for="start-next-round-date"
            class="block text-sm font-semibold text-navy mb-2">End Date</label
          >
          <DatePicker
            id="start-next-round-date"
            value={startNextRoundDate}
            onChange={(value) => (startNextRoundDate = value)}
            minDate={new Date().toISOString().split("T")[0]}
          />
        </div>

        <div>
          <label
            for="start-next-round-time"
            class="block text-sm font-semibold text-navy mb-2">End Time</label
          >
          <TimePicker
            id="start-next-round-time"
            value={startNextRoundTime}
            onChange={(value) => (startNextRoundTime = value)}
          />
        </div>
      </div>

      <div class="flex gap-4 mt-6">
        <button
          onclick={() => (showStartNextRoundModal = false)}
          class="btn-secondary flex-1"
        >
          Cancel
        </button>
        <button
          onclick={startNextRound}
          class="btn-primary flex-1"
          disabled={startingNextRound}
        >
          {startingNextRound ? "Starting..." : "Start Next Round"}
        </button>
      </div>
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

  /* Project Selection Styles */
  .project-count {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: rgba(78, 205, 196, 0.05);
    border-radius: 12px;
    border: 2px solid rgba(78, 205, 196, 0.2);
  }

  .project-count-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .project-count-label {
    font-weight: 600;
    color: #1a1a4e;
  }

  .project-count-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: rgba(26, 26, 78, 0.6);
  }

  .project-count-value.count-complete {
    color: #4ecdc4;
  }

  .project-selection-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    margin-top: 1.5rem;
  }

  .project-column {
    display: flex;
    flex-direction: column;
    background: rgba(26, 26, 78, 0.02);
    border: 2px solid rgba(26, 26, 78, 0.08);
    border-radius: 16px;
    overflow: hidden;
  }

  .project-column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: rgba(26, 26, 78, 0.05);
    border-bottom: 2px solid rgba(26, 26, 78, 0.08);
  }

  .project-column-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1a1a4e;
  }

  .project-column-count {
    font-size: 0.875rem;
    font-weight: 600;
    color: rgba(26, 26, 78, 0.6);
    padding: 0.375rem 0.75rem;
    background: rgba(26, 26, 78, 0.1);
    border-radius: 8px;
  }

  .fake-project-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .btn-fake {
    padding: 0.5rem 0.75rem;
    background: rgba(78, 205, 196, 0.1);
    color: #1a1a4e;
    border: 1px solid rgba(78, 205, 196, 0.3);
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-fake:hover:not(:disabled) {
    background: rgba(78, 205, 196, 0.2);
    border-color: #4ecdc4;
    transform: translateY(-1px);
  }

  .btn-fake:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .project-list {
    flex: 1;
    overflow-y: auto;
    max-height: 600px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .project-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background: white;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .project-card:hover:not(:disabled) {
    border-color: #4ecdc4;
    box-shadow: 0 4px 12px rgba(78, 205, 196, 0.15);
    transform: translateY(-2px);
  }

  .project-card:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .project-card.disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .project-card-selected {
    background: rgba(78, 205, 196, 0.05);
    border-color: #4ecdc4;
  }

  .project-card-selected:hover:not(:disabled) {
    background: rgba(78, 205, 196, 0.1);
    border-color: #4ecdc4;
  }

  .project-card-content {
    flex: 1;
    min-width: 0;
  }

  .project-card-title {
    font-size: 1rem;
    font-weight: 600;
    color: #1a1a4e;
    margin-bottom: 0.25rem;
  }

  .project-card-desc {
    font-size: 0.875rem;
    color: rgba(26, 26, 78, 0.7);
    margin-bottom: 0.5rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .project-card-location {
    font-size: 0.75rem;
    color: rgba(26, 26, 78, 0.5);
  }

  .project-card-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    color: #4ecdc4;
    flex-shrink: 0;
  }

  .project-card-selected .project-card-action {
    color: #1a1a4e;
  }

  @media (max-width: 1024px) {
    .project-selection-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
  }
</style>
