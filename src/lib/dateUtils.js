/**
 * Combine date and time strings into ISO timestamp
 * @param {string} date - Date string in YYYY-MM-DD format
 * @param {string} time - Time string in HH:mm format
 * @returns {string} ISO timestamp string
 */
export function combineDateAndTime(date, time) {
  if (!date || !time) return "";
  const dateTime = new Date(`${date}T${time}`);
  return dateTime.toISOString();
}

/**
 * Parse ISO timestamp into date and time components
 * @param {string} iso - ISO timestamp string
 * @returns {{date: string, time: string}} Object with date (YYYY-MM-DD) and time (HH:mm)
 */
export function parseISOToDateAndTime(iso) {
  if (!iso) return { date: "", time: "" };
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
  };
}

/**
 * Format ISO timestamp for display
 * @param {string} iso - ISO timestamp string
 * @returns {string} Formatted date/time string (e.g., "Dec 15, 2024 at 3:00 PM")
 */
export function formatEndDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  const options = {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  return date.toLocaleString("en-US", options);
}

/**
 * Get match end date, falling back to round date if match doesn't have one
 * @param {object} match - Match object with endDate property
 * @param {array} roundMatches - All matches in the same round
 * @returns {string} ISO timestamp string (match endDate or first round match endDate)
 */
export function getMatchEndDate(match, roundMatches) {
  // If match has its own endDate, use it
  if (match.endDate) {
    return match.endDate;
  }

  // Otherwise, find the first match in the round that has an endDate
  const roundMatchWithDate = roundMatches.find((m) => m.endDate);
  return roundMatchWithDate?.endDate || "";
}

/**
 * Validate that date/time is in the future
 * @param {string} date - Date string in YYYY-MM-DD format
 * @param {string} time - Time string in HH:mm format
 * @returns {boolean} True if date/time is in the future
 */
export function isFutureDateTime(date, time) {
  if (!date || !time) return false;
  const dateTime = new Date(`${date}T${time}`);
  return dateTime > new Date();
}


