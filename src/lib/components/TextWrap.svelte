<script>
  let className = "";
  export { className as class };
</script>

<div
  class="min-h-screen bg-[#fefdfb] py-16 px-6 pb-[calc(4rem+200px)] flex justify-center md:py-8 md:px-4 md:pb-[calc(2rem+200px)]"
>
  <div
    class="max-w-[800px] w-full break-words overflow-wrap-anywhere hyphens-auto {className}"
  >
    <slot />
  </div>
</div>

<style>
  :global(.text-wrap-content a) {
    color: #3b82f6;
    text-decoration: underline;
    text-underline-offset: 2px;
    transition: color 0.2s;
  }

  :global(.text-wrap-content a:hover) {
    color: #2563eb;
  }

  :global(.text-wrap-content h1) {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 2rem;
    line-height: 1.3;
    color: #111827;
  }

  :global(.text-wrap-content h2) {
    font-size: 1.75rem;
    font-weight: 700;
    margin-top: 3rem;
    margin-bottom: 1rem;
    line-height: 1.3;
    color: #111827;
  }

  :global(.text-wrap-content h3) {
    font-size: 1.4rem;
    font-weight: 600;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
    line-height: 1.3;
    color: #111827;
  }

  :global(.text-wrap-content h4) {
    font-size: 1.2rem;
    font-weight: 600;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    line-height: 1.3;
    color: #374151;
  }

  :global(.text-wrap-content h5) {
    font-size: 1.1rem;
    font-weight: 600;
    margin-top: 1.3rem;
    margin-bottom: 0.5rem;
    line-height: 1.3;
    color: #374151;
  }

  :global(.text-wrap-content p) {
    font-size: 1rem;
    line-height: 1.7;
    margin-bottom: 1rem;
    color: #4b5563;
  }

  :global(.text-wrap-content ul) {
    margin-bottom: 1rem;
    padding-left: 1.5rem;
  }

  :global(.text-wrap-content li) {
    font-size: 1rem;
    line-height: 1.7;
    margin-bottom: 0.5rem;
    color: #4b5563;
  }

  :global(.text-wrap-content strong) {
    font-weight: 600;
    color: #111827;
  }

  @media (max-width: 768px) {
    :global(.text-wrap-content h1) {
      font-size: 2rem;
    }

    :global(.text-wrap-content h2) {
      font-size: 1.5rem;
    }

    :global(.text-wrap-content h3) {
      font-size: 1.25rem;
    }

    :global(.text-wrap-content h4),
    :global(.text-wrap-content h5) {
      font-size: 1.1rem;
    }

    :global(.text-wrap-content p),
    :global(.text-wrap-content li) {
      font-size: 0.938rem;
    }
  }
</style>
