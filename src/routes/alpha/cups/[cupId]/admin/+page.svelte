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
  import DatePicker from "$lib/DatePicker.svelte";
  import TimePicker from "$lib/TimePicker.svelte";
  import CountdownTimer from "$lib/CountdownTimer.svelte";
  import { combineDateAndTime, formatEndDate } from "$lib/dateUtils.js";
  import {
    allProjects,
    allVotes,
    cupById,
    matchesByCup,
  } from "$lib/synced-queries";
  import { Button } from "$lib/design-system/atoms";
  import { Card, PageHeader } from "$lib/design-system/molecules";
  import Loading from "$lib/components/Loading.svelte";
  import Modal from "$lib/Modal.svelte";
  import MatchListItem from "$lib/MatchListItem.svelte";

  const zeroContext = useZero();
  const session = authClient.useSession();
  const cupId = $page.params.cupId;

  let zero = null;
  let cup = $state(null);
  let projects = $state([]);
  let matches = $state([]);
  let votes = $state([]); // All vote records
  let loading = $state(true);
  let creatingFakeProjects = $state(false);
  let ending = $state(false);
  let startingNextRound = $state(false);
  let expandedMatch = $state(null); // Track which match is expanded
  let expandedVideo = $state(null); // Track which video is expanded
  let isAdmin = $state(false);
  let checkingAdmin = $state(true);
  let showEndRoundModal = $state(false);
  let showStartCupModal = $state(false);
  let showStartNextRoundModal = $state(false);
  let startCupDate = $state("");
  let startCupTime = $state("");
  let startNextRoundDate = $state("");
  let startNextRoundTime = $state("");

  // Function to set end date/time from duration preset with rounding
  function setEndDateFromDuration(duration) {
    const now = new Date();
    let targetDate = new Date(now);

    // Parse duration
    const durationMatch = duration.match(/^(\d+)([mhdwM])$/);
    if (!durationMatch) return;

    const amount = parseInt(durationMatch[1]);
    const unit = durationMatch[2];

    // Add the base duration
    switch (unit) {
      case "m": // minutes
        targetDate.setMinutes(targetDate.getMinutes() + amount);
        // Round up to next interval based on amount
        const minutes = targetDate.getMinutes();
        let roundedMinutes;
        if (amount === 15) {
          // Round up to next 15-minute interval (0, 15, 30, 45)
          roundedMinutes = Math.ceil(minutes / 15) * 15;
        } else if (amount === 30) {
          // Round up to next 30-minute interval (0, 30)
          roundedMinutes = Math.ceil(minutes / 30) * 30;
        } else {
          // For other minute amounts, round up to next interval
          roundedMinutes = Math.ceil(minutes / amount) * amount;
        }
        // Handle hour overflow
        if (roundedMinutes >= 60) {
          targetDate.setHours(targetDate.getHours() + 1);
          roundedMinutes = roundedMinutes % 60;
        }
        targetDate.setMinutes(roundedMinutes);
        targetDate.setSeconds(0);
        targetDate.setMilliseconds(0);
        break;
      case "h": // hours
        targetDate.setHours(targetDate.getHours() + amount);
        // Round up to next hour
        targetDate.setMinutes(0);
        targetDate.setSeconds(0);
        targetDate.setMilliseconds(0);
        break;
      case "d": // days
        targetDate.setDate(targetDate.getDate() + amount);
        targetDate.setHours(0);
        targetDate.setMinutes(0);
        targetDate.setSeconds(0);
        targetDate.setMilliseconds(0);
        break;
      case "w": // weeks
        targetDate.setDate(targetDate.getDate() + amount * 7);
        targetDate.setHours(0);
        targetDate.setMinutes(0);
        targetDate.setSeconds(0);
        targetDate.setMilliseconds(0);
        break;
      case "M": // months
        targetDate.setMonth(targetDate.getMonth() + amount);
        targetDate.setHours(0);
        targetDate.setMinutes(0);
        targetDate.setSeconds(0);
        targetDate.setMilliseconds(0);
        break;
    }

    // Format date and time
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, "0");
    const day = String(targetDate.getDate()).padStart(2, "0");
    const hours = String(targetDate.getHours()).padStart(2, "0");
    const minutes = String(targetDate.getMinutes()).padStart(2, "0");

    startNextRoundDate = `${year}-${month}-${day}`;
    startNextRoundTime = `${hours}:${minutes}`;
  }

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
      const cupQuery = cupById(cupId);
      cupView = zero.materialize(cupQuery);

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
      const projectsQuery = allProjects();
      projectsView = zero.materialize(projectsQuery);

      projectsView.addListener((data) => {
        projects = Array.from(data);
      });

      // Query cup matches
      const matchesQuery = matchesByCup(cupId);
      matchesView = zero.materialize(matchesQuery);

      matchesView.addListener((data) => {
        matches = Array.from(data);
      });

      // Query all votes to show vote counts using synced query
      const votesQuery = allVotes();
      votesView = zero.materialize(votesQuery);

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

  // Get selected project IDs from Zero-synced cup.selectedProjectIds
  // - For draft cups: read from cup.selectedProjectIds (synced via Zero)
  // - For active/completed cups: read from matches
  const selectedProjectIds = $derived(() => {
    if (!cup) return new Set();

    // If cup is draft, read from Zero-synced selectedProjectIds field
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

  // Add a project to the cup (Zero mutation - synced)
  function addProjectToCup(projectId) {
    if (!cup || !canAddMoreProjects() || !zero) return;

    // Only allow adding during draft phase
    if (cup.status !== "draft") {
      showError("Cannot modify projects in active or completed cups");
      return;
    }

    // Fire and forget - Zero handles optimistic updates and conflicts automatically
    zero.mutate.cup.addProject({
      cupId,
      projectId,
    });
  }

  // Remove a project from the cup (Zero mutation - synced)
  function removeProjectFromCup(projectId) {
    if (!cup || !zero) return;

    // Only allow removing during draft phase
    if (cup.status !== "draft") {
      showError("Cannot modify projects in active or completed cups");
      return;
    }

    // Fire and forget - Zero handles optimistic updates and conflicts automatically
    zero.mutate.cup.removeProject({
      cupId,
      projectId,
    });
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
          videoUrl: "",
          bannerImage: "",
          profileImageUrl: "",
          sdgs: JSON.stringify(fakeData.sdgs || []),
          createdAt: now,
        };

        // Fire and forget - Zero handles optimistic updates
        zero.mutate.project.create(newProject);
        return newProject;
      });

      await Promise.all(fakeProjectPromises);

      showSuccess(`Created ${fakesToCreate.length} fake projects!`);

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

    console.log("Starting cup:", {
      cupId,
      endDate,
      selectedProjects: selectedProjects().length,
    });

    try {
      // Use server-side API - reads selectedProjectIds from Zero-synced cup data
      const response = await fetch("/alpha/api/start-cup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cupId: cupId,
          endDate,
          // No need to send selectedProjectIds - server reads from Zero-synced cup
        }),
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
      showSuccess("Cup started! Voting is now enabled.");
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
    showEndRoundModal = true;
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

  // Helper functions for MatchListItem component
  function isMatchActive(match) {
    if (match.status === "voting") return true;
    if (
      match.status === "pending" &&
      cup?.status === "active" &&
      cup?.currentRound === match.round
    ) {
      return true;
    }
    return false;
  }

  function toggleVideo(videoKey) {
    if (expandedVideo === videoKey) {
      expandedVideo = null;
    } else {
      expandedVideo = videoKey;
    }
  }

  // Admin view doesn't allow voting, so these return false/empty
  function hasUserVotedOnMatch() {
    return false;
  }

  function getUserVotedSide() {
    return null;
  }

  function getUserVotingWeight() {
    return 0;
  }

  function canUserVoteOnMatch() {
    return false; // Admin view - no voting
  }

  function voteOnMatch() {
    // No-op for admin view
  }

  // Unified close handlers - single source of truth for closing modals
  function closeEndRoundModal() {
    showEndRoundModal = false;
  }

  function closeStartCupModal() {
    showStartCupModal = false;
  }

  function closeStartNextRoundModal() {
    showStartNextRoundModal = false;
  }

  // Expose modal actions to layout for navbar integration
  let rafId = null;
  $effect(() => {
    const isEndRoundOpen = showEndRoundModal;
    const isStartCupOpen = showStartCupModal;
    const isStartNextRoundOpen = showStartNextRoundModal;
    const isEnding = ending;
    const isStartingNextRound = startingNextRound;

    if (typeof window !== "undefined") {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        window.__adminModalActions = {
          showEndRoundModal: isEndRoundOpen,
          showStartCupModal: isStartCupOpen,
          showStartNextRoundModal: isStartNextRoundOpen,
          ending: isEnding,
          startingNextRound: isStartingNextRound,
          handleEndRound: () => {
            endCurrentRound();
            closeEndRoundModal();
          },
          handleStartCup: () => {
            startCup();
          },
          handleStartNextRound: () => {
            startNextRound();
          },
          handleCancelEndRound: closeEndRoundModal,
          handleCancelStartCup: closeStartCupModal,
          handleCancelStartNextRound: closeStartNextRoundModal,
        };
        rafId = null;
      });
    }
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  });
</script>

<div class="min-h-screen bg-brand-cream-50 p-4 md:p-8">
  <div class="max-w-7xl mx-auto">
    {#if loading}
      <Card class="p-8 text-center">
        {#snippet children()}
          <Loading message="Loading cup..." />
        {/snippet}
      </Card>
    {:else if cup}
      <!-- Header -->
      <div class="mb-6 md:mb-8">
        <div>
          <h1
            class="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-500 mb-2"
          >
            {cup.name}
          </h1>
          <p class="text-primary-700/60 text-base md:text-lg">
            Cup Admin Panel
          </p>
        </div>
      </div>

      <!-- Cup Status -->
      <Card class="p-4 md:p-6 mb-6 md:mb-8">
        {#snippet children()}
          <div class="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p class="text-primary-700/60 text-sm mb-1">Status</p>
              <p class="text-2xl font-bold text-primary-500">
                {getStatusLabel(cup.status)}
              </p>
            </div>
            {#if cup.currentRound}
              <div>
                <p class="text-primary-700/60 text-sm mb-1">Current Round</p>
                <p class="text-xl font-bold text-secondary-500">
                  {getRoundLabel(cup.currentRound)}
                </p>
              </div>
            {/if}
            <div>
              <p class="text-primary-700/60 text-sm mb-1">Matches</p>
              <p class="text-2xl font-bold text-primary-500">
                {matches.length}
              </p>
            </div>
            {#if cup.endDate}
              <div>
                <p class="text-primary-700/60 text-sm mb-1">Time Remaining</p>
                <p class="text-lg font-semibold text-primary-500">
                  <CountdownTimer
                    endDate={cup.endDate}
                    displayFormat="compact"
                  />
                </p>
              </div>
            {/if}
          </div>
        {/snippet}
      </Card>

      <!-- Actions -->
      {#if cup.status === "draft"}
        <Card class="p-4 md:p-6 mb-6 md:mb-8">
          {#snippet children()}
            <h2 class="text-2xl font-bold text-primary-500 mb-4">
              Setup Tournament
            </h2>
            <p class="text-primary-700/60 mb-6">
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
                    <Button
                      size="sm"
                      variant="secondary"
                      onclick={() => createFakeProjects(4)}
                      disabled={creatingFakeProjects}
                      title="Create 4 random fake projects"
                    >
                      +4
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onclick={() => createFakeProjects(8)}
                      disabled={creatingFakeProjects}
                      title="Create 8 random fake projects"
                    >
                      +8
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onclick={() => createFakeProjects(16)}
                      disabled={creatingFakeProjects}
                      title="Create 16 random fake projects"
                    >
                      +16
                    </Button>
                  </div>
                </div>
                <div class="project-list">
                  {#if availableProjects().length === 0}
                    <p class="text-primary-700/50 text-sm p-4 text-center">
                      No available projects. Create some fake projects to get
                      started!
                    </p>
                  {:else}
                    {#each availableProjects() as project}
                      <button
                        onclick={() => addProjectToCup(project.id)}
                        disabled={!canAddMoreProjects()}
                        class="project-card"
                        class:disabled={!canAddMoreProjects()}
                      >
                        <div class="project-card-content">
                          <h4 class="project-card-title">{project.title}</h4>
                          {#if project.description}
                            <p class="project-card-desc">
                              {project.description}
                            </p>
                          {/if}
                          {#if project.city}
                            <p class="project-card-location">
                              {project.city}{project.country
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
                    <p class="text-primary-700/50 text-sm p-4 text-center">
                      No projects selected yet. Click projects on the left to
                      add them.
                    </p>
                  {:else}
                    {#each selectedProjects() as project}
                      <button
                        onclick={() => removeProjectFromCup(project.id)}
                        class="project-card project-card-selected"
                      >
                        <div class="project-card-content">
                          <h4 class="project-card-title">{project.title}</h4>
                          {#if project.description}
                            <p class="project-card-desc">
                              {project.description}
                            </p>
                          {/if}
                          {#if project.city}
                            <p class="project-card-location">
                              {project.city}{project.country
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
          {/snippet}
        </Card>
      {/if}

      {#if cup.status === "draft" && isCupReadyToStart()}
        <Card
          class="p-4 md:p-6 mb-6 md:mb-8 border-2 border-secondary-500/30 bg-gradient-to-br from-secondary-500/5 to-accent-500/5"
        >
          {#snippet children()}
            <h2 class="text-2xl font-bold text-primary-500 mb-4">
              Ready to Start?
            </h2>
            <p class="text-primary-700/60 mb-6">
              Your tournament is set up with {selectedProjects().length} projects.
              Start the cup to enable voting!
            </p>
            <Button
              variant="warning"
              size="lg"
              onclick={requestStartCup}
              icon="play"
              iconPosition="left"
            >
              Start Cup & Enable Voting
            </Button>
          {/snippet}
        </Card>
      {:else if cup.status === "draft"}
        <Card
          class="p-4 md:p-6 mb-6 md:mb-8 border-2 border-accent-500/30 bg-gradient-to-br from-accent-500/5 to-secondary-500/5"
        >
          {#snippet children()}
            <h2 class="text-2xl font-bold text-primary-500 mb-4">
              Not Ready Yet
            </h2>
            <p class="text-primary-700/60 mb-6">
              Please select exactly {cup.size || 16} projects before starting the
              cup. Currently selected: {selectedProjects().length} / {cup.size ||
                16}
            </p>
          {/snippet}
        </Card>
      {/if}

      {#if cup.status === "active" && cup.currentRound}
        {@const currentRound = cup.currentRound}
        {@const currentRoundMatches = matches.filter(
          (m) => m.round === currentRound
        )}
        {@const allHaveWinners =
          currentRoundMatches.length > 0 &&
          currentRoundMatches.every((m) => m.winnerId)}
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

        {#if !allHaveWinners}
          <!-- Show Current Round card only when not all winners are determined -->
          <Card
            class="p-4 md:p-6 mb-6 md:mb-8 border-2 border-accent-500/30 bg-gradient-to-br from-accent-500/5 to-secondary-500/5"
          >
            {#snippet children()}
              <h2 class="text-2xl font-bold text-primary-500 mb-4">
                Current Round: {getRoundLabel(cup.currentRound)}
              </h2>
              <p class="text-primary-700/60 mb-6">
                End this round to determine winners for all matches. Use "Start
                Next Round" to advance winners after ending.
              </p>
              <Button
                variant="primary"
                size="lg"
                onclick={() => (showEndRoundModal = true)}
              >
                End Round & Determine Winners
              </Button>
            {/snippet}
          </Card>
        {:else if nextRound && nextRoundMatches.length === 0}
          <!-- Show Start Next Round card only when all winners are determined and next round doesn't exist yet -->
          <Card
            class="p-4 md:p-6 mb-6 md:mb-8 border-2 border-accent-500/30 bg-gradient-to-br from-accent-500/5 to-secondary-500/5"
          >
            {#snippet children()}
              <h2 class="text-2xl font-bold text-primary-500 mb-4">
                Start Next Round: {getRoundLabel(nextRound)}
              </h2>
              <p class="text-primary-700/60 mb-6">
                All winners have been determined. Start the next round to create
                matches and enable voting.
              </p>
              <Button
                variant="primary"
                size="lg"
                onclick={() => (showStartNextRoundModal = true)}
                disabled={startingNextRound}
              >
                {startingNextRound ? "Starting..." : "Start Next Round"}
              </Button>
            {/snippet}
          </Card>
        {/if}
      {/if}

      <!-- Matches (only show if cup is active/completed, not during draft selection) -->
      {#if cup.status !== "draft" && matches.length > 0}
        <Card class="p-4 md:p-6">
          {#snippet children()}
            <h2 class="text-2xl font-bold text-primary-500 mb-6">
              Tournament Matches
            </h2>

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
                  {@const roundMatches = matches.filter(
                    (m) => m.round === round
                  )}
                  {#if roundMatches.length > 0}
                    <div>
                      <h3 class="text-xl font-bold text-primary-500 mb-4">
                        {getRoundLabel(round)}
                      </h3>
                      <div class="round-matches">
                        {#each roundMatches as match}
                          {@const project1 = getProjectById(match.project1Id)}
                          {@const project2 = getProjectById(match.project2Id)}
                          {@const votes1 = getMatchVotes(match.id, "project1")}
                          {@const votes2 = getMatchVotes(match.id, "project2")}
                          {@const totalVotes = votes1 + votes2}
                          {@const percent1 =
                            totalVotes > 0 ? (votes1 / totalVotes) * 100 : 50}
                          {@const percent2 =
                            totalVotes > 0 ? (votes2 / totalVotes) * 100 : 50}
                          {@const isActive = isMatchActive(match)}
                          <MatchListItem
                            {match}
                            {project1}
                            {project2}
                            {votes1}
                            {votes2}
                            {percent1}
                            {percent2}
                            {isActive}
                            {expandedMatch}
                            {expandedVideo}
                            votingAnimation={null}
                            {votes}
                            session={$session}
                            {getRoundLabel}
                            hasVoted={false}
                            userVotingWeight={0}
                            userVotedSide={null}
                            canVote={false}
                            {roundMatches}
                            onToggleExpand={() =>
                              (expandedMatch =
                                expandedMatch === match.id ? null : match.id)}
                            {toggleVideo}
                            {voteOnMatch}
                          />
                        {/each}
                      </div>
                    </div>
                  {/if}
                {/each}
              {/if}
            </div>
          {/snippet}
        </Card>
      {/if}
    {/if}
  </div>
</div>

<!-- End Round Modal -->
<Modal bind:open={showEndRoundModal} onClose={closeEndRoundModal}>
  {#snippet children()}
    <h2 class="text-2xl font-bold text-primary-500 mb-4">End Current Round</h2>
    <p class="text-primary-700/60 mb-6">
      Are you sure you want to end the current round? This will determine
      winners for all matches and cannot be undone.
    </p>
  {/snippet}
</Modal>

<!-- Start Cup Date/Time Modal -->
<Modal bind:open={showStartCupModal} onClose={closeStartCupModal}>
  {#snippet children()}
    <h2 class="text-2xl font-bold text-primary-500 mb-4">Start Cup</h2>
    <p class="text-primary-700/60 mb-6">
      Set the end date and time for this cup. All matches in the first round
      will use this end date.
    </p>

    <div class="space-y-4">
      <div>
        <label
          for="start-cup-date"
          class="block text-sm font-semibold text-primary-500 mb-2"
          >End Date</label
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
          class="block text-sm font-semibold text-primary-500 mb-2"
          >End Time</label
        >
        <TimePicker
          id="start-cup-time"
          value={startCupTime}
          onChange={(value) => (startCupTime = value)}
        />
      </div>
    </div>
  {/snippet}
</Modal>

<!-- Start Next Round Date/Time Modal -->
<Modal bind:open={showStartNextRoundModal} onClose={closeStartNextRoundModal}>
  {#snippet children()}
    <h2 class="text-2xl font-bold text-primary-500 mb-4">Start Next Round</h2>
    <p class="text-primary-700/60 mb-6">
      Set the end date and time for the next round. All matches in this round
      will use this end date.
    </p>

    <!-- Quick Select Buttons -->
    <div class="mb-6">
      <p class="text-sm font-semibold text-primary-500 mb-3">Quick Select:</p>
      <div class="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          onclick={() => setEndDateFromDuration("15m")}
        >
          15m
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onclick={() => setEndDateFromDuration("30m")}
        >
          30m
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onclick={() => setEndDateFromDuration("1h")}
        >
          1h
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onclick={() => setEndDateFromDuration("2h")}
        >
          2h
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onclick={() => setEndDateFromDuration("4h")}
        >
          4h
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onclick={() => setEndDateFromDuration("12h")}
        >
          12h
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onclick={() => setEndDateFromDuration("1d")}
        >
          1d
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onclick={() => setEndDateFromDuration("2d")}
        >
          2d
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onclick={() => setEndDateFromDuration("4d")}
        >
          4d
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onclick={() => setEndDateFromDuration("1w")}
        >
          1w
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onclick={() => setEndDateFromDuration("1M")}
        >
          1m
        </Button>
      </div>
    </div>

    <div class="space-y-4">
      <div>
        <label
          for="start-next-round-date"
          class="block text-sm font-semibold text-primary-500 mb-2"
          >End Date</label
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
          class="block text-sm font-semibold text-primary-500 mb-2"
          >End Time</label
        >
        <TimePicker
          id="start-next-round-time"
          value={startNextRoundTime}
          onChange={(value) => (startNextRoundTime = value)}
        />
      </div>
    </div>
  {/snippet}
</Modal>

<style>
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
    color: var(--color-primary-500);
  }

  .project-count-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-primary-700/60);
  }

  .project-count-value.count-complete {
    color: var(--color-secondary-500);
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
    background: rgba(8, 27, 71, 0.02);
    border: 2px solid var(--color-brand-navy-500/8);
    border-radius: 16px;
    overflow: hidden;
  }

  .project-column-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    background: rgba(8, 27, 71, 0.05);
    border-bottom: 2px solid var(--color-brand-navy-500/8);
  }

  .project-column-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-primary-500);
  }

  .project-column-count {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-primary-700/60);
    padding: 0.375rem 0.75rem;
    background: rgba(8, 27, 71, 0.1);
    border-radius: 8px;
  }

  .fake-project-buttons {
    display: flex;
    gap: 0.5rem;
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
    border: 2px solid var(--color-brand-navy-500/10);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    width: 100%;
  }

  .project-card:hover:not(:disabled) {
    border-color: var(--color-secondary-500);
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
    border-color: var(--color-secondary-500);
  }

  .project-card-selected:hover:not(:disabled) {
    background: rgba(78, 205, 196, 0.1);
    border-color: var(--color-secondary-500);
  }

  .project-card-content {
    flex: 1;
    min-width: 0;
  }

  .project-card-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-primary-500);
    margin-bottom: 0.25rem;
  }

  .project-card-desc {
    font-size: 0.875rem;
    color: var(--color-primary-700/70);
    margin-bottom: 0.5rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .project-card-location {
    font-size: 0.75rem;
    color: var(--color-primary-700/50);
  }

  .project-card-action {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    color: var(--color-secondary-500);
    flex-shrink: 0;
  }

  .project-card-selected .project-card-action {
    color: var(--color-primary-500);
  }

  /* Round matches - standalone, no card wrapper */
  .round-matches {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  @media (min-width: 768px) {
    .round-matches {
      gap: 0.875rem;
    }
  }

  @media (max-width: 1024px) {
    .project-selection-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
  }
</style>
