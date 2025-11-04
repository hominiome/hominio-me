<script>
  import { onMount } from 'svelte';
  
  // Target date: September 13, 2026
  const targetDate = new Date('2026-09-13');
  
  // Function to calculate days remaining
  function calculateDaysRemaining() {
    const today = new Date();
    // Set both dates to midnight for accurate day calculation
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    return daysDiff > 0 ? daysDiff : 0;
  }
  
  // Reactive calculation - updates when component loads
  $: daysRemaining = calculateDaysRemaining();
  
  // Optional: Update daily at midnight (for long-lived pages)
  onMount(() => {
    const updateDaily = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const msUntilMidnight = tomorrow - now;
      
      setTimeout(() => {
        daysRemaining = calculateDaysRemaining();
        // Set up interval to update every 24 hours
        setInterval(() => {
          daysRemaining = calculateDaysRemaining();
        }, 24 * 60 * 60 * 1000);
      }, msUntilMidnight);
    };
    
    updateDaily();
  });
</script>

<div class="mb-16 py-12 md:py-16">
  <div class="max-w-4xl mx-auto px-1.5 md:px-10">
    <!-- Section Header -->
    <p
      class="text-xs md:text-sm font-bold text-secondary-500 uppercase tracking-wider text-center mb-8"
    >
      The World Record We Are Breaking
    </p>
    
    <!-- This is the challenge - Centered above both columns -->
    <h3 class="text-2xl md:text-3xl font-bold text-primary-500 mb-8 text-center">
      This is the challenge
    </h3>

    <!-- Two Column Layout: Text Left, Image Right -->
    <div class="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
      <!-- Left Column: Storytelling Content -->
      <div class="flex-1 space-y-8">
        <!-- Challenge content -->
        <div>
          <p class="text-lg md:text-xl text-gray-700 leading-relaxed">
            In exactly <span class="font-extrabold text-primary-500 bg-primary-500/20 px-2 py-0.5 rounded-md whitespace-nowrap">{daysRemaining}</span> days, <span class="font-extrabold text-accent-500 bg-accent-500/20 px-2 py-0.5 rounded-md whitespace-nowrap">1 million co-founders</span> will launch 1 startup together, while voting with just 1€ each, which idea we turn from vision into reality.
          </p>
          <p class="text-lg md:text-xl text-gray-700 leading-relaxed mt-4">
            All while breaking the world record of stacking the largest 1€ coin tower of <span class="font-extrabold text-secondary-500 bg-secondary-500/20 px-2 py-0.5 rounded-md whitespace-nowrap">1.000.936</span> individual coins.
          </p>
        </div>

        <!-- Here is the twist -->
        <div>
          <h3 class="text-2xl md:text-3xl font-bold text-accent-500 mb-4">
            Here is the twist —
          </h3>
          <p class="text-lg md:text-xl text-gray-700 leading-relaxed">
            We have no idea what is going to happen - when we trust in the power of the crowd - but what we know for sure is this -
          </p>
          <p class="text-2xl md:text-3xl font-bold text-accent-500 italic mt-4">
            it will be magical.
          </p>
        </div>
      </div>

      <!-- Right Column: Image -->
      <div class="w-full md:w-1/2 lg:w-2/5 flex-shrink-0">
        <div class="rounded-2xl overflow-hidden shadow-xl">
          <img 
            src="/1milliontower.png" 
            alt="1 million coin tower"
            class="w-full h-auto"
          />
        </div>
      </div>
    </div>
  </div>
</div>


