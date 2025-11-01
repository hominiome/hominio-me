import { json } from "@sveltejs/kit";
import { nanoid } from "nanoid";
import { requireAdmin } from "$lib/api-helpers.server.js";
import { zeroDb } from "$lib/db.server.js";

export async function POST({ request }) {
  // Require admin access (throws 401/403 if not authenticated/admin)
  await requireAdmin(request);

  const { cupId, endDate } = await request.json();

  if (!cupId) {
    return json({ error: "Cup ID required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  try {
    // Get cup
    const cup = await zeroDb
      .selectFrom("cup")
      .selectAll()
      .where("id", "=", cupId)
      .executeTakeFirst();

    if (!cup) {
      return json({ error: "Cup not found" }, { status: 404 });
    }

    if (cup.status !== "draft") {
      return json({ error: "Cup already started" }, { status: 400 });
    }

    // Check if cup has selected projects (no need to check matches - they don't exist yet)
    let selectedProjectIds = [];
    try {
      if (cup.selectedProjectIds && cup.selectedProjectIds.trim()) {
        selectedProjectIds = JSON.parse(cup.selectedProjectIds);
      } else {
        selectedProjectIds = [];
      }
    } catch (e) {
      console.error("Error parsing selectedProjectIds:", e);
      selectedProjectIds = [];
    }

    const cupSize = cup.size || 16;
    console.log(
      `Cup ${cupId}: size=${cupSize}, selected=${selectedProjectIds.length}, selectedProjectIds=${cup.selectedProjectIds}`
    );

    if (selectedProjectIds.length !== cupSize) {
      return json(
        {
          error: `Cup requires exactly ${cupSize} projects, but ${selectedProjectIds.length} are selected.`,
        },
        { status: 400 }
      );
    }

    if (selectedProjectIds.length === 0) {
      return json(
        {
          error:
            "No projects selected. Please select projects before starting the cup.",
        },
        { status: 400 }
      );
    }

    // Determine first round based on cup size
    const firstRound = `round_${cupSize}`;

    // Use the selected projects we already parsed
    const allProjects = selectedProjectIds;

    // Delete any existing matches for this cup (clean slate - shouldn't be any, but just in case)
    await zeroDb.deleteFrom("cupMatch").where("cupId", "=", cupId).execute();

    // Shuffle projects randomly (Fisher-Yates shuffle) - multiple times for better randomization
    for (let shuffleRound = 0; shuffleRound < 3; shuffleRound++) {
      for (let i = allProjects.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allProjects[i], allProjects[j]] = [allProjects[j], allProjects[i]];
      }
    }

    // Create pairs by randomly selecting projects (not consecutive)
    const pairs = [];
    const availableProjects = [...allProjects];

    while (availableProjects.length >= 2) {
      // Randomly pick two projects
      const idx1 = Math.floor(Math.random() * availableProjects.length);
      const project1 = availableProjects.splice(idx1, 1)[0];

      const idx2 = Math.floor(Math.random() * availableProjects.length);
      const project2 = availableProjects.splice(idx2, 1)[0];

      // Randomly decide which is project1 and which is project2
      if (Math.random() < 0.5) {
        pairs.push({ project1, project2 });
      } else {
        pairs.push({ project1: project2, project2: project1 });
      }
    }

    // If there's one leftover project (odd number), add it to the last pair
    if (availableProjects.length === 1) {
      if (pairs.length > 0) {
        pairs[pairs.length - 1].project2 = availableProjects[0];
      }
    }

    // Shuffle the pairs themselves to randomize match positions
    for (let i = pairs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
    }

    // Create all matches with shuffled pairs (matches don't exist yet, we're creating them fresh)
    console.log(
      `Creating ${pairs.length} matches for cup ${cupId}, round ${firstRound}`
    );
    console.log(
      `Pairs:`,
      pairs.map((p) => `${p.project1} vs ${p.project2}`)
    );

    const matchPromises = [];
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const matchId = nanoid();

      if (!pair.project1 || !pair.project2) {
        console.error(`Invalid pair at index ${i}:`, pair);
        continue;
      }

      matchPromises.push(
        zeroDb
          .insertInto("cupMatch")
          .values({
            id: matchId,
            cupId: cupId,
            round: firstRound,
            position: i,
            project1Id: pair.project1,
            project2Id: pair.project2,
            winnerId: "",
            status: "voting",
            completedAt: "",
            endDate: endDate || "",
          })
          .execute()
      );
    }

    // Wait for all matches to be created
    await Promise.all(matchPromises);
    console.log(`✅ Created ${matchPromises.length} matches successfully`);

    // Verify matches were created
    const createdMatches = await zeroDb
      .selectFrom("cupMatch")
      .select(zeroDb.fn.count("id").as("count"))
      .where("cupId", "=", cupId)
      .where("round", "=", firstRound)
      .executeTakeFirst();

    const matchCount = createdMatches ? Number(createdMatches.count) : 0;
    console.log(
      `Verified: ${matchCount} matches exist for cup ${cupId} in round ${firstRound}`
    );

    if (matchCount === 0) {
      throw new Error(
        "Failed to create matches - no matches found after creation"
      );
    }

    // Update cup status
    const updateData = {
      status: "active",
      currentRound: firstRound,
      startedAt: now,
    };
    if (endDate) {
      updateData.endDate = endDate;
    }
    await zeroDb
      .updateTable("cup")
      .set(updateData)
      .where("id", "=", cupId)
      .execute();

    return json({
      success: true,
      status: "active",
      currentRound: firstRound,
      startedAt: now,
    });
  } catch (error) {
    console.error("Start cup error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return json(
      {
        error: "Failed to start cup",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
