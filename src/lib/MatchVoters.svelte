<script>
  import { getUserProfile } from "$lib/userProfileCache";

  let { matchId, projectSide, votes = [] } = $props();

  // Aggregate votes by user from vote records
  const voters = $derived(() => {
    const voterMap = new Map();

    // Filter votes for this specific match and project side
    const projectVotes = votes.filter(
      (vote) => vote.matchId === matchId && vote.projectSide === projectSide
    );

    projectVotes.forEach((vote) => {
      const userId = vote.userId;
        if (userId) {
          if (voterMap.has(userId)) {
            const existing = voterMap.get(userId);
          existing.totalVotes += vote.votingWeight;
          } else {
            voterMap.set(userId, {
              userId,
            totalVotes: vote.votingWeight,
            });
        }
      }
    });

    // Convert to array and sort by total votes (descending)
    return Array.from(voterMap.values()).sort(
      (a, b) => b.totalVotes - a.totalVotes
    );
  });

  // Fetch user profiles for display
  let userProfiles = $state(new Map());

  $effect(() => {
    const voterList = voters();
    voterList.forEach(async (voter) => {
      if (!userProfiles.has(voter.userId)) {
        try {
          const profile = await getUserProfile(voter.userId);
          if (profile) {
            userProfiles = new Map(userProfiles).set(voter.userId, profile);
          }
        } catch (e) {
          console.error("Error fetching user profile:", e);
        }
      }
    });
  });

  const topVoters = $derived(
    voters().map((voter) => {
      const profile = userProfiles.get(voter.userId);
      return {
        ...voter,
        userName: profile?.name || "Anonymous",
        userImage: profile?.image || null,
      };
    })
  );
</script>

{#if topVoters.length > 0}
  <div class="voters-container">
    {#each topVoters as voter, index}
      <div class="voter-item" class:top-voter={index === 0}>
        <div class="voter-avatar-wrapper">
          {#if voter.userImage}
            <img
              src={voter.userImage}
              alt={voter.userName}
              class="voter-avatar"
            />
          {:else}
            <div class="voter-avatar-placeholder">
              {voter.userName?.[0]?.toUpperCase() || "?"}
            </div>
          {/if}
          <span class="vote-count">{voter.totalVotes}</span>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .voters-container {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: rgba(26, 26, 78, 0.02);
    border-top: 1px solid rgba(26, 26, 78, 0.06);
    overflow-x: auto;
    flex: 0 0 auto; /* Fixed size - don't grow/shrink */
    min-height: 60px; /* Consistent minimum height for alignment */
  }

  .voter-item {
    flex-shrink: 0;
  }

  .voter-avatar-wrapper {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .voter-avatar,
  .voter-avatar-placeholder {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 2px solid rgba(244, 208, 63, 0.3);
    object-fit: cover;
  }

  .top-voter .voter-avatar,
  .top-voter .voter-avatar-placeholder {
    width: 40px;
    height: 40px;
    border: 3px solid #f4d03f;
    box-shadow: 0 2px 8px rgba(244, 208, 63, 0.3);
  }

  .voter-avatar-placeholder {
    background: linear-gradient(135deg, #1a1a4e 0%, #2a2a6e 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 0.75rem;
  }

  .top-voter .voter-avatar-placeholder {
    font-size: 0.875rem;
  }

  .vote-count {
    position: absolute;
    bottom: -4px;
    right: -4px;
    background: linear-gradient(135deg, #f4d03f 0%, #e6c43a 100%);
    color: #1a1a4e;
    font-size: 0.625rem;
    font-weight: 800;
    padding: 0.125rem 0.25rem;
    border-radius: 6px;
    line-height: 1;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    min-width: 16px;
    text-align: center;
  }

  .top-voter .vote-count {
    font-size: 0.75rem;
    padding: 0.25rem 0.375rem;
    bottom: -6px;
    right: -6px;
  }

  @media (max-width: 768px) {
    .voters-container {
      padding: 0.5rem 1rem;
      gap: 0.375rem;
    }

    .voter-avatar,
    .voter-avatar-placeholder {
      width: 28px;
      height: 28px;
    }

    .top-voter .voter-avatar,
    .top-voter .voter-avatar-placeholder {
      width: 36px;
      height: 36px;
    }

    .vote-count {
      font-size: 0.5625rem;
    }

    .top-voter .vote-count {
      font-size: 0.6875rem;
    }
  }
</style>

