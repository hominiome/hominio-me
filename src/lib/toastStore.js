/**
 * Toast notification store
 * Manages toast notifications across the application
 */

import { writable } from "svelte/store";

let toastIdCounter = 0;

// Create a writable store for toasts
export const toasts = writable([]);

export function showToast(message, type = "info", duration = 5000) {
  const id = toastIdCounter++;
  const toast = {
    id,
    message,
    type,
    duration,
  };

  // Update the store by adding the new toast
  toasts.update((currentToasts) => [...currentToasts, toast]);

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, duration);
  }

  return id;
}

export function removeToast(id) {
  toasts.update((currentToasts) => currentToasts.filter((t) => t.id !== id));
}

export function clearToasts() {
  toasts.set([]);
}

// Convenience functions
export function showSuccess(message, duration = 5000) {
  return showToast(message, "success", duration);
}

export function showError(message, duration = 7000) {
  return showToast(message, "error", duration);
}

export function showInfo(message, duration = 5000) {
  return showToast(message, "info", duration);
}
