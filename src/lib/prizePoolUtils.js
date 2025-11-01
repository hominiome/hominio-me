/**
 * Format prize pool amount in European format (1.000€ without decimals)
 * @param {number} amountInCents - Amount in cents
 * @returns {string} Formatted string (e.g., "1.000€")
 */
export function formatPrizePool(amountInCents) {
  if (!amountInCents || amountInCents === 0) {
    return "0€";
  }
  
  // Convert cents to euros (divide by 100)
  const euros = amountInCents / 100;
  
  // Format with thousand separators (.) and no decimals
  return `${Math.floor(euros).toLocaleString("de-DE")}€`;
}

/**
 * Calculate prize pool for a cup by summing all identity purchase prices
 * @param {Array} purchases - Array of identityPurchase objects with price property
 * @returns {number} Total prize pool in cents
 */
export function calculatePrizePool(purchases) {
  if (!purchases || purchases.length === 0) {
    return 0;
  }
  
  return purchases.reduce((total, purchase) => {
    return total + (purchase.price || 0);
  }, 0);
}

