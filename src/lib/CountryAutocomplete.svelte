<script>
  /**
   * Country Autocomplete Component
   * Wrapper around Autocomplete specifically for selecting European countries
   */

  import Autocomplete from "./Autocomplete.svelte";

  let {
    value = $bindable(null), // Country object: { name: "Germany" }
    disabled = false,
    label,
    required = false,
    placeholder = "Search countries...",
  } = $props();

  // European countries list (excluding Russia and Vatican, including Andorra)
  const europeanCountries = [
    { name: "Albania" },
    { name: "Andorra" },
    { name: "Austria" },
    { name: "Belarus" },
    { name: "Belgium" },
    { name: "Bosnia and Herzegovina" },
    { name: "Bulgaria" },
    { name: "Croatia" },
    { name: "Cyprus" },
    { name: "Czech Republic" },
    { name: "Denmark" },
    { name: "Estonia" },
    { name: "Finland" },
    { name: "France" },
    { name: "Germany" },
    { name: "Greece" },
    { name: "Hungary" },
    { name: "Iceland" },
    { name: "Ireland" },
    { name: "Italy" },
    { name: "Kosovo" },
    { name: "Latvia" },
    { name: "Liechtenstein" },
    { name: "Lithuania" },
    { name: "Luxembourg" },
    { name: "Malta" },
    { name: "Moldova" },
    { name: "Monaco" },
    { name: "Montenegro" },
    { name: "Netherlands" },
    { name: "North Macedonia" },
    { name: "Norway" },
    { name: "Poland" },
    { name: "Portugal" },
    { name: "Romania" },
    { name: "San Marino" },
    { name: "Serbia" },
    { name: "Slovakia" },
    { name: "Slovenia" },
    { name: "Spain" },
    { name: "Sweden" },
    { name: "Switzerland" },
    { name: "Ukraine" },
    { name: "United Kingdom" },
  ];

  // Filter countries based on search query
  function searchCountries(query) {
    if (!query.trim()) {
      return europeanCountries;
    }
    const queryLower = query.toLowerCase();
    return europeanCountries.filter((country) =>
      country.name.toLowerCase().includes(queryLower)
    );
  }

  // Initial load: set countries if value is provided
  $effect(() => {
    if (value && value.name) {
      // Value is already set, no need to preload
    }
  });
</script>

<Autocomplete
  bind:value
  items={europeanCountries}
  onSearch={searchCountries}
  {placeholder}
  displayKey="name"
  valueKey="name"
  {disabled}
  {label}
  {required}
/>

