<script>
  /**
   * User Autocomplete Component
   * Wrapper around Autocomplete specifically for selecting users
   */

  import Autocomplete from "./Autocomplete.svelte";

  let {
    value = $bindable(null), // User object: { id, name, image }
    disabled = false,
    label,
    required = false,
    placeholder = "Search users by name...",
  } = $props();

  let users = $state([]);
  let loading = $state(false);

  // Search users from API
  async function searchUsers(query) {
    if (!query.trim()) {
      // If no query, return empty array (or could return recent users)
      return [];
    }

    loading = true;
    try {
      const response = await fetch(
        `/alpha/api/users?query=${encodeURIComponent(query)}`
      );
      if (!response.ok) {
        throw new Error("Failed to search users");
      }
      const results = await response.json();
      return results;
    } catch (error) {
      console.error("Error searching users:", error);
      return [];
    } finally {
      loading = false;
    }
  }

  // Initial load: fetch users if value is set
  $effect(() => {
    if (value && value.id) {
      // Optionally preload user data
      users = [value];
    }
  });
</script>

<Autocomplete
  bind:value
  items={users}
  onSearch={searchUsers}
  {placeholder}
  displayKey="name"
  valueKey="id"
  {disabled}
  {label}
  {required}
/>
