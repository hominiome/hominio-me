import { zeroDb } from "$lib/db.server.js";
import { getMatchEndDate } from "$lib/dateUtils.js";

/**
 * Check and close expired matches based on their endDate
 * @param {Array} matches - Array of match objects
 * @returns {Promise<number>} Number of matches that were closed
 */
export async function checkAndCloseExpiredMatches(matches) {
  if (!matches || matches.length === 0) return 0;
  
  const now = new Date();
  const nowISO = now.toISOString();
  let closedCount = 0;
  
  // Group matches by cupId and round to efficiently check round-level endDates
  const matchesByCupAndRound = new Map();
  for (const match of matches) {
    if (match.status === "completed") continue; // Skip already completed matches
    
    const key = `${match.cupId}|${match.round}`;
    if (!matchesByCupAndRound.has(key)) {
      matchesByCupAndRound.set(key, []);
    }
    matchesByCupAndRound.get(key).push(match);
  }
  
  // Check each group of matches
  for (const [key, roundMatches] of matchesByCupAndRound) {
    for (const match of roundMatches) {
      // Get effective end date (match-specific or round-level)
      const matchEndDate = getMatchEndDate(match, roundMatches);
      
      if (matchEndDate) {
        const endDate = new Date(matchEndDate);
        if (now >= endDate) {
          // Match has expired - close it
          try {
            // Only update if not already completed
            if (match.status !== "completed") {
              await zeroDb
                .updateTable("cupMatch")
                .set({
                  status: "completed",
                  completedAt: nowISO,
                })
                .where("id", "=", match.id)
                .execute();
              closedCount++;
            }
          } catch (error) {
            console.error(`Failed to close expired match ${match.id}:`, error);
          }
        }
      }
    }
  }
  
  return closedCount;
}

/**
 * Check and close expired cups based on their endDate
 * @param {Array} cups - Array of cup objects
 * @returns {Promise<number>} Number of cups that were closed
 */
export async function checkAndCloseExpiredCups(cups) {
  if (!cups || cups.length === 0) return 0;
  
  const now = new Date();
  const nowISO = now.toISOString();
  let closedCount = 0;
  
  for (const cup of cups) {
    if (cup.status === "completed") continue; // Skip already completed cups
    
    if (cup.endDate) {
      const endDate = new Date(cup.endDate);
      if (now >= endDate) {
        // Cup has expired - mark as completed
        try {
          // Only update if not already completed
          if (cup.status !== "completed") {
            await zeroDb
              .updateTable("cup")
              .set({
                status: "completed",
                completedAt: nowISO,
                updatedAt: nowISO,
              })
              .where("id", "=", cup.id)
              .execute();
            closedCount++;
          }
        } catch (error) {
          console.error(`Failed to close expired cup ${cup.id}:`, error);
        }
      }
    }
  }
  
  return closedCount;
}

/**
 * Check and close expired matches and cups in a single operation
 * This is the main function to call when querying data
 * @param {Array} matches - Array of match objects (optional)
 * @param {Array} cups - Array of cup objects (optional)
 * @returns {Promise<{matchesClosed: number, cupsClosed: number}>}
 */
export async function checkAndCloseExpired(matches = [], cups = []) {
  const [matchesClosed, cupsClosed] = await Promise.all([
    checkAndCloseExpiredMatches(matches),
    checkAndCloseExpiredCups(cups),
  ]);
  
  return { matchesClosed, cupsClosed };
}

