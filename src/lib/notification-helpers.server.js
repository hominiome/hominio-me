import notificationConfig from "./notification-config.json";

/**
 * Get notification configuration for a given resource type and subtype
 * @param {string} resourceType - e.g., 'identityPurchase', 'newsletter'
 * @param {string} subtype - e.g., 'hominio', 'founder', 'other', 'received'
 * @param {Object} replacements - Object with key-value pairs to replace placeholders like {identityName}, {message}
 * @returns {Object|null} Notification config or null if not found
 */
export function getNotificationConfig(resourceType, subtype, replacements = {}) {
  const config = notificationConfig[resourceType]?.[subtype];
  if (!config) return null;

  // Deep clone to avoid mutating the original
  const cloned = JSON.parse(JSON.stringify(config));

  // Replace placeholders in title, previewTitle, message, and actions
  const replacePlaceholders = (str) => {
    if (typeof str !== "string") return str;
    let result = str;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
    }
    return result;
  };

  cloned.title = replacePlaceholders(cloned.title);
  cloned.previewTitle = replacePlaceholders(cloned.previewTitle);
  cloned.message = replacePlaceholders(cloned.message);

  // Replace placeholders in actions URLs
  if (cloned.actions && Array.isArray(cloned.actions)) {
    cloned.actions = cloned.actions.map((action) => ({
      ...action,
      url: replacePlaceholders(action.url),
    }));
  }

  return cloned;
}

