<script>
  /**
   * Generic Autocomplete Component
   *
   * Props:
   * - value: bindable selected value (object with id, name, image, etc.)
   * - items: array of items to display
   * - onSearch: function to call when search query changes (async)
   * - placeholder: placeholder text for input
   * - displayKey: key to display from item (default: "name")
   * - valueKey: key to use as value (default: "id")
   * - disabled: whether input is disabled
   * - label: optional label for the input
   * - required: whether field is required
   */

  let {
    value = $bindable(null),
    items: initialItems = [],
    onSearch,
    placeholder = "Search...",
    displayKey = "name",
    valueKey = "id",
    disabled = false,
    label,
    required = false,
  } = $props();

  let items = $state(initialItems);
  let searchQuery = $state("");
  let isOpen = $state(false);
  let highlightedIndex = $state(-1);
  let loading = $state(false);
  let inputElement;
  let originalValue = $state(null); // Store original value when focusing
  let hasSelectedNewItem = $state(false); // Track if user selected a new item
  const inputId = `autocomplete-${Math.random().toString(36).substr(2, 9)}`;
  const dropdownId = `autocomplete-dropdown-${Math.random().toString(36).substr(2, 9)}`;

  // Debounce search
  let searchTimeout = null;

  // Filter items based on search query
  const filteredItems = $derived(() => {
    if (!searchQuery.trim()) {
      return items;
    }
    const query = searchQuery.toLowerCase();
    return items.filter((item) => {
      const displayValue = item[displayKey] || "";
      return displayValue.toLowerCase().includes(query);
    });
  });

  // Show current value in input
  const displayValue = $derived(() => {
    if (value) {
      return value[displayKey] || "";
    }
    return searchQuery;
  });

  async function handleInput(e) {
    const target = e.target;
    searchQuery = target.value;
    isOpen = true;
    highlightedIndex = -1;

    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    // Call onSearch callback if provided (with debounce)
    if (onSearch) {
      loading = true;
      searchTimeout = setTimeout(async () => {
        try {
          const results = await onSearch(searchQuery);
          if (Array.isArray(results)) {
            items = results;
          }
        } catch (error) {
          console.error("Search error:", error);
        } finally {
          loading = false;
        }
      }, 300);
    }
  }

  function selectItem(item) {
    value = item;
    searchQuery = "";
    isOpen = false;
    highlightedIndex = -1;
    hasSelectedNewItem = true; // Mark that a new item was selected
    originalValue = null; // Clear original value since we selected a new one
  }

  function handleKeydown(e) {
    if (!isOpen || filteredItems().length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        highlightedIndex = Math.min(
          highlightedIndex + 1,
          filteredItems().length - 1
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        highlightedIndex = Math.max(highlightedIndex - 1, -1);
        break;
      case "Enter":
        e.preventDefault();
        if (
          highlightedIndex >= 0 &&
          highlightedIndex < filteredItems().length
        ) {
          selectItem(filteredItems()[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        isOpen = false;
        highlightedIndex = -1;
        // Restore original value if user didn't select a new item
        if (!hasSelectedNewItem && originalValue !== null) {
          value = originalValue;
          searchQuery = "";
          originalValue = null;
        }
        break;
    }
  }

  function handleFocus() {
    // Store the original value and clear it temporarily for searching
    if (value && !hasSelectedNewItem) {
      originalValue = value;
      value = null;
      searchQuery = "";
    } else {
      // If no value or we already selected a new item, just clear search query
      searchQuery = "";
    }

    // Select all text in the input so typing replaces it
    if (inputElement) {
      inputElement.select();
    }

    isOpen = true;
    hasSelectedNewItem = false; // Reset flag
  }

  function handleBlur() {
    // Delay closing to allow click events on dropdown items
    setTimeout(() => {
      isOpen = false;
      highlightedIndex = -1;

      // If no new item was selected and we have an original value, restore it
      if (
        !hasSelectedNewItem &&
        originalValue !== null &&
        !searchQuery.trim()
      ) {
        value = originalValue;
        searchQuery = "";
        originalValue = null;
      } else if (
        !hasSelectedNewItem &&
        originalValue !== null &&
        searchQuery.trim()
      ) {
        // User typed something but didn't select - restore original
        value = originalValue;
        searchQuery = "";
        originalValue = null;
      }
    }, 200);
  }

  function clearSelection() {
    value = null;
    searchQuery = "";
    originalValue = null;
    hasSelectedNewItem = false;
    inputElement?.focus();
  }
</script>

<div class="autocomplete-wrapper">
  {#if label}
    <label for={inputId} class="autocomplete-label">
      {label}
      {#if required}
        <span class="required">*</span>
      {/if}
    </label>
  {/if}

  <div class="autocomplete-input-wrapper">
    <input
      id={inputId}
      bind:this={inputElement}
      type="text"
      value={displayValue()}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onfocus={handleFocus}
      onblur={handleBlur}
      {placeholder}
      {disabled}
      {required}
      class="autocomplete-input"
      autocomplete="off"
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-controls={isOpen ? dropdownId : undefined}
    />

    {#if value}
      <button
        type="button"
        onclick={clearSelection}
        class="autocomplete-clear"
        aria-label="Clear selection"
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
    {/if}
  </div>

  {#if isOpen && (filteredItems().length > 0 || loading)}
    <div id={dropdownId} class="autocomplete-dropdown" role="listbox">
      {#if loading}
        <div class="autocomplete-loading">Searching...</div>
      {:else}
        {#each filteredItems() as item, index}
          {@const displayText = item[displayKey] || ""}
          {@const isHighlighted = index === highlightedIndex}
          <button
            type="button"
            onclick={() => selectItem(item)}
            class="autocomplete-item"
            class:highlighted={isHighlighted}
            role="option"
            aria-selected={isHighlighted}
          >
            {#if item.image}
              <img
                src={item.image}
                alt={displayText}
                class="autocomplete-avatar"
                onerror={(e) => {
                  e.target.style.display = "none";
                }}
              />
            {:else}
              <div class="autocomplete-avatar-placeholder">
                {displayText[0]?.toUpperCase() || "?"}
              </div>
            {/if}
            <span class="autocomplete-item-text">{displayText}</span>
          </button>
        {/each}
      {/if}
    </div>
  {:else if isOpen && searchQuery && !loading && filteredItems().length === 0}
    <div class="autocomplete-dropdown">
      <div class="autocomplete-empty">No results found</div>
    </div>
  {/if}
</div>

<style>
  .autocomplete-wrapper {
    position: relative;
    width: 100%;
  }

  .autocomplete-label {
    display: block;
    color: rgba(26, 26, 78, 0.8);
    font-weight: 600;
    font-size: 0.9375rem;
    margin-bottom: 0.5rem;
  }

  .required {
    color: #ef4444;
    margin-left: 0.25rem;
  }

  .autocomplete-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .autocomplete-input {
    width: 100%;
    padding: 0.875rem 1rem;
    padding-right: 2.5rem;
    background: white;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 10px;
    color: #1a1a4e;
    transition: all 0.2s ease;
    font-size: 0.9375rem;
  }

  .autocomplete-input:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  }

  .autocomplete-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .autocomplete-clear {
    position: absolute;
    right: 0.5rem;
    width: 1.5rem;
    height: 1.5rem;
    border: none;
    background: transparent;
    color: rgba(26, 26, 78, 0.5);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .autocomplete-clear:hover {
    background: rgba(26, 26, 78, 0.1);
    color: #1a1a4e;
  }

  .autocomplete-clear svg {
    width: 1rem;
    height: 1rem;
  }

  .autocomplete-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    margin-top: 0.25rem;
    background: white;
    border: 2px solid rgba(26, 26, 78, 0.1);
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(26, 26, 78, 0.15);
    max-height: 300px;
    overflow-y: auto;
    z-index: 1000;
    animation: slideDown 0.2s ease-out;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .autocomplete-item {
    width: 100%;
    padding: 0.75rem 1rem;
    border: none;
    background: white;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    transition: all 0.15s;
    font-size: 0.9375rem;
    color: #1a1a4e;
  }

  .autocomplete-item:first-child {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }

  .autocomplete-item:last-child {
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
  }

  .autocomplete-item:hover,
  .autocomplete-item.highlighted {
    background: rgba(78, 205, 196, 0.1);
  }

  .autocomplete-avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
  }

  .autocomplete-avatar-placeholder {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: linear-gradient(135deg, #4ecdc4, #f4d03f);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 700;
    font-size: 0.875rem;
    flex-shrink: 0;
  }

  .autocomplete-item-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .autocomplete-loading,
  .autocomplete-empty {
    padding: 1rem;
    text-align: center;
    color: rgba(26, 26, 78, 0.6);
    font-size: 0.875rem;
  }

  /* Scrollbar styling */
  .autocomplete-dropdown::-webkit-scrollbar {
    width: 8px;
  }

  .autocomplete-dropdown::-webkit-scrollbar-track {
    background: rgba(26, 26, 78, 0.05);
    border-radius: 4px;
  }

  .autocomplete-dropdown::-webkit-scrollbar-thumb {
    background: rgba(26, 26, 78, 0.2);
    border-radius: 4px;
  }

  .autocomplete-dropdown::-webkit-scrollbar-thumb:hover {
    background: rgba(26, 26, 78, 0.3);
  }
</style>
