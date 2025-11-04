<script>
  import Card from "$lib/design-system/molecules/Card.svelte";
</script>

<div
  class="mb-16 py-12 md:py-16 bg-gradient-to-br from-secondary-50/50 via-accent-50/30 to-white rounded-3xl"
>
  <!-- Founder Quote -->
  <div class="max-w-4xl mx-auto px-1.5 md:px-10">
    <div class="flex flex-col md:flex-row items-center gap-6 md:gap-8">
      <img
        src="/hominiono1.jpg"
        alt="Samuel Andert"
        class="w-20 h-20 md:w-[120px] md:h-[120px] rounded-full object-cover flex-shrink-0 border-[3px] border-secondary-500 shadow-lg shadow-secondary-500/20"
      />
      <div class="flex-1 text-center md:text-left">
        <blockquote
          class="text-xl md:text-2xl lg:text-3xl leading-relaxed text-gray-900 italic mb-4 font-medium"
        >
          I see us building <span class="text-secondary-500 font-bold"
            >civilization</span
          >-<span class="text-accent-500 font-bold">upgrading</span> visions that
          reshape how we live and work tomorrow, unleashing humanities full potential
          of excellence.
        </blockquote>
        <p class="text-base md:text-lg text-gray-600 font-semibold">
          — Samuel Andert, Co-Founder of Hominio
        </p>
      </div>
    </div>
  </div>
</div>
