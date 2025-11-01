<script>
  let { value = "", onChange, minDate, maxDate } = $props();

  function handleChange(event) {
    const newValue = event.target.value;
    if (onChange) {
      onChange(newValue);
    }
  }
</script>

<input
  type="date"
  {value}
  oninput={handleChange}
  min={minDate}
  max={maxDate}
  class="date-picker"
/>

<style>
  .date-picker {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 2px solid rgba(26, 26, 78, 0.2);
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 500;
    color: #1a1a4e;
    background: white;
    transition: all 0.2s;
    font-family: inherit;
  }

  .date-picker:focus {
    outline: none;
    border-color: #4ecdc4;
    box-shadow: 0 0 0 3px rgba(78, 205, 196, 0.1);
  }

  .date-picker:hover {
    border-color: rgba(78, 205, 196, 0.4);
  }
</style>
