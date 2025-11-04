<script>
  import Card from "$lib/design-system/molecules/Card.svelte";
  import CoOwnershipMechanism from "./CoOwnershipMechanism.svelte";
</script>

<div class="mb-16">
  <!-- The Problem - Large Statement -->
  <div class="mb-16">
    <div class="max-w-4xl mx-auto px-1.5 md:px-0">
      <div class="relative">
        <!-- Large broken text effect -->
        <div class="text-center mb-8">
          <p
            class="text-xs md:text-sm font-bold text-secondary-500 uppercase tracking-wider mb-6"
          >
            Why is this important?
          </p>
          <p
            class="text-3xl md:text-4xl lg:text-5xl font-semibold text-primary-500 leading-tight mb-4"
          >
            Our current way of working is
          </p>
          <p
            class="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-400 leading-none mb-6 line-through"
          >
            broken
          </p>
        </div>

        <!-- Split layout with visual element -->
        <div
          class="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 mt-12"
        >
          <div
            class="px-1.5 md:px-6 py-3 bg-secondary-50 rounded-full border-2 border-secondary-200"
          >
            <span class="text-lg font-semibold text-gray-700">We work to</span>
            <span class="text-xl font-bold text-secondary-800 ml-2"
              >survive</span
            >
          </div>

          <div class="text-2xl md:text-3xl text-gray-400 font-light">→</div>

          <div
            class="px-1.5 md:px-6 py-3 bg-accent-50 rounded-full border-2 border-accent-200"
          >
            <span class="text-lg font-semibold text-gray-700"
              >instead of living to</span
            >
            <span class="text-xl font-bold text-accent-800 ml-2">thrive</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- The Vision - Full width image with overlay text -->
  <div class="mb-0 relative overflow-hidden rounded-t-3xl aspect-square">
    <!-- Background Image -->
    <img
      src="/smile.jpg"
      alt="Joyful person with sparkling eyes"
      class="absolute inset-0 w-full h-full object-cover"
    />
    <!-- Overlay for text readability -->
    <div
      class="absolute inset-0 bg-gradient-to-br from-black/40 via-black/30 to-black/50"
    ></div>

    <!-- Text Content Overlay -->
    <div
      class="relative z-10 h-full flex flex-col justify-end items-center p-8 md:p-16 pb-8 md:pb-12"
    >
      <div class="max-w-4xl mx-auto text-center">
        <h3
          class="text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-6 tracking-tight drop-shadow-lg"
        >
          Picture This
        </h3>
        <p
          class="text-xl md:text-2xl lg:text-3xl text-white leading-relaxed mb-4 drop-shadow-lg"
        >
          You wake up with <span class="text-accent-300 font-bold"
            >sparkling eyes</span
          >
          and
          <span class="text-secondary-300 font-bold">fire in the belly</span> every
          day,
        </p>
        <p
          class="text-lg md:text-xl lg:text-2xl text-white leading-relaxed drop-shadow-lg"
        >
          because you are so <span
            class="text-xl md:text-2xl lg:text-3xl text-surface-light-300 font-bold"
            >excited</span
          >
          to continue working<br />
          on that important mission you
          <span
            class="text-xl md:text-2xl lg:text-3xl text-surface-light-300 font-bold"
            >deeply care</span
          > about.
        </p>
      </div>
    </div>
  </div>

  <!-- The Transformation - Centered with emphasis -->
  <div class="relative w-full -mt-0">
    <div class="w-full">
      <div
        class="bg-gradient-to-br from-accent-50 to-white rounded-b-3xl p-8 md:p-12 border-4 border-t-0 border-accent-300 shadow-xl"
      >
        <div class="text-center">
          <h2
            class="text-2xl md:text-3xl lg:text-4xl font-bold text-primary-500 leading-tight mb-6 tracking-tight"
          >
            This is what it feels like to become
          </h2>
          <div class="flex items-center justify-center gap-3 md:gap-4 mb-6">
            <img
              src="/logo.png"
              alt="Hominio Logo"
              class="w-12 h-12 md:w-16 md:h-16 lg:w-20 lg:h-20 flex-shrink-0"
            />
            <p
              class="text-4xl md:text-5xl lg:text-6xl font-bold text-primary-500"
            >
              Hominio
            </p>
          </div>
          <p
            class="text-xl md:text-2xl text-gray-700 leading-relaxed max-w-2xl mx-auto"
          >
            A new breed of entrepreneur, who lives at their <span
              class="text-accent-500 font-semibold">full potential</span
            >
            in alignment with their
            <span class="text-secondary-500 font-semibold">inner purpose</span>.
          </p>
        </div>
      </div>
    </div>
  </div>

  <!-- How It Works - Hominio Startups Section -->
  <div class="mb-16">
    <div class="max-w-5xl mx-auto px-1.5 md:px-0">
      <!-- Section Header -->
      <p
        class="text-xs md:text-sm font-bold text-secondary-500 uppercase tracking-wider text-center mb-12 mt-16"
      >
        And here is how...
      </p>

      <!-- The New Organization Type - Large Statement -->
      <div class="mb-16">
        <div class="text-center mb-8">
          <h3
            class="text-3xl md:text-4xl lg:text-5xl font-bold text-primary-500 leading-tight mb-6"
          >
            Introducing the °Hominio Startup
          </h3>
          <p
            class="text-xl md:text-2xl lg:text-3xl text-gray-700 leading-relaxed max-w-3xl mx-auto"
          >
            A new kind of organization, built differently from the ground up.
          </p>
        </div>
      </div>

      <!-- Core Concept - Split Layout with Cards -->
      <div
        class="mb-16 relative overflow-hidden rounded-3xl px-1.5 py-8 md:p-16 bg-gradient-to-br from-primary-50 via-secondary-50 to-accent-50"
      >
        <div class="max-w-5xl mx-auto">
          <div
            class="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-8"
          >
            <!-- Left: Smaller Card -->
            <div class="w-full md:w-auto flex-shrink-0">
              <div
                class="px-1.5 py-4 md:px-8 md:py-6 bg-white rounded-2xl border-2 border-primary-200 shadow-lg"
              >
                <p
                  class="text-lg md:text-xl font-bold text-primary-400 line-through text-center md:text-left"
                >
                  No Employees
                </p>
                <p
                  class="text-lg md:text-xl font-bold text-primary-400 line-through mt-2 text-center md:text-left"
                >
                  No Employers
                </p>
                <p
                  class="text-lg md:text-xl font-bold text-primary-400 line-through mt-2 text-center md:text-left"
                >
                  No traditional VCs
                </p>
              </div>
            </div>

            <!-- Separator -->
            <div
              class="text-3xl md:text-4xl text-gray-400 font-light flex-shrink-0"
            >
              →
            </div>

            <!-- Right: Bigger Card -->
            <div class="flex-1 w-full md:w-auto">
              <div
                class="px-1.5 py-4 md:px-10 md:py-8 bg-white rounded-2xl border-2 border-secondary-200 shadow-lg"
              >
                <p
                  class="text-lg md:text-xl text-gray-900 leading-relaxed font-semibold mb-4 text-center"
                >
                  Just
                </p>
                <div
                  class="inline-block px-1.5 md:px-6 py-3 bg-secondary-50 rounded-full mb-4"
                >
                  <p class="text-2xl md:text-3xl font-bold text-secondary-800">
                    Co-Founders
                  </p>
                </div>
                <p
                  class="text-lg md:text-xl text-gray-700 leading-relaxed mt-4 text-center"
                >
                  contributing to something bigger than themselves, while
                  earning and owning their fair share.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- The Purpose - Magazine Style Layout -->
      <div class="mb-16">
        <div class="max-w-5xl mx-auto px-1.5 md:px-0">
          <!-- Section Header -->
          <p
            class="text-xs md:text-sm font-bold text-secondary-500 uppercase tracking-wider text-center mb-8"
          >
            The Role of the Startup
          </p>

          <!-- Main Statement - Large Typography -->
          <div class="mb-12">
            <p
              class="text-2xl md:text-3xl lg:text-4xl text-gray-900 leading-relaxed text-center font-medium max-w-3xl mx-auto mb-6"
            >
              °Hominio Startups align and rally around one strong,
              purpose-driven cause.
            </p>
            <p
              class="text-lg md:text-xl lg:text-2xl text-gray-700 leading-relaxed text-center max-w-3xl mx-auto"
            >
              Rooted in impact driven values around<br />
              <span class="text-xl md:text-2xl lg:text-3xl font-bold"
                >— <span class="text-primary-500">purpose</span>,
                <span class="text-secondary-500">planet</span>
                and <span class="text-accent-500">profit</span> —</span
              ><br />
              with a clean and strong inspiring manifesto as guiding principles.
            </p>
          </div>

          <!-- Example Vision Statement - Letter Style Manifesto -->
          <div class="relative max-w-3xl mx-auto">
            <p
              class="text-xs md:text-sm font-bold text-primary-700 uppercase tracking-wider mb-8 text-center"
            >
              Example: Hominio's Purpose
            </p>
            <div
              class="relative px-6 md:px-16 py-12 md:py-16 bg-gradient-to-br from-surface-light-50 via-white to-surface-light-50 rounded-lg shadow-2xl border border-surface-light-300 transform rotate-[-0.5deg]"
            >
              <!-- Letter texture overlay -->
              <div
                class="absolute inset-0 opacity-5 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDAwIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')]"
              ></div>

              <!-- Letter content -->
              <div class="relative">
                <!-- Letter header styling -->
                <div class="mb-6 pb-4 border-b-2 border-primary-200">
                  <p
                    class="text-sm md:text-base text-primary-600 font-semibold tracking-wide"
                  >
                    Our Manifesto
                  </p>
                </div>

                <!-- Introductory paragraph -->
                <p
                  class="text-base md:text-lg lg:text-xl text-gray-800 leading-relaxed font-serif italic text-left mb-6"
                >
                  We are so utterly mindblown by the extraordinary awesomeness
                  of what humans are able to bring from vision into reality.
                  Just look at us - pyramids, human flight, harvesting
                  solar-energy, global internet, greening the desert - we are
                  such a great species with an unlimited amount of gigantic
                  untapped potential, that we just need to learn to
                  (re)discover.
                </p>

                <p
                  class="text-base md:text-lg lg:text-xl text-gray-800 leading-relaxed font-serif italic text-left mb-6"
                >
                  We believe, we are capable of far greater terra-visions,
                  creating stronger systems and better environments, for humans
                  to thrive in abundance and in harmony with our home planet -
                  earth - when we just dare to take magnificently larger leaps
                  of faith.
                </p>

                <p
                  class="text-base md:text-lg lg:text-xl text-gray-800 leading-relaxed font-serif italic text-left mb-6"
                >
                  And here we - Hominini - are coming together to build visions
                  so monumental - that each time we stop to take a breath, we
                  want to say - I can't believe humans actually build this.
                  Amazing!
                </p>

                <p
                  class="text-base md:text-lg lg:text-xl text-gray-800 leading-relaxed font-serif italic text-left mb-6 font-semibold"
                >
                  This is the mission.
                </p>

                <!-- Letter body -->
                <blockquote
                  class="text-lg md:text-xl lg:text-2xl text-gray-800 leading-relaxed font-serif italic text-left"
                >
                  During the next 10 years, we inspire <span
                    class="text-primary-600 font-bold not-italic"
                    >1 billion humans</span
                  >
                  to unite, unlocking humanities full
                  <span class="text-primary-600 font-bold not-italic"
                    >collective potential</span
                  >
                  — while we upgrade civilization from the
                  <span class="text-secondary-600 font-semibold not-italic"
                    >age of survival</span
                  >
                  into the
                  <span class="text-accent-600 font-semibold not-italic"
                    >age of abundance</span
                  >.
                </blockquote>

                <!-- Letter signature area -->
                <div class="mt-8 pt-4 border-t border-surface-light-300">
                  <p class="text-sm text-gray-500 italic text-right">
                    — Hominio Co-Founders
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Co-Ownership Mechanism Section -->
      <CoOwnershipMechanism />
    </div>
  </div>
</div>
