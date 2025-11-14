<script lang="ts">
  let { imageUrl } = $props<{
    imageUrl: string;
  }>();

  let imageLoadFailed = $state(false);

  // Only render if imageUrl is provided and not empty
  const shouldRender = $derived(imageUrl && imageUrl.trim().length > 0);
</script>

{#if shouldRender && !imageLoadFailed}
  <div class="image-display">
    <img
      src={imageUrl}
      alt="Notification content"
      class="notification-image"
      onerror={() => {
        imageLoadFailed = true;
      }}
    />
  </div>
{/if}

<style>
  .image-display {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .notification-image {
    width: 100%;
    max-width: 600px;
    height: auto;
    border-radius: 12px;
    object-fit: contain;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  @media (max-width: 768px) {
    .notification-image {
      max-width: 100%;
      border-radius: 8px;
    }
  }
</style>

