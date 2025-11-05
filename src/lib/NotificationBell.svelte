<script lang="ts">
  import Icon from "@iconify/svelte";

  let { unreadCount, onClick, latestTitle, latestIcon, latestMessage } =
    $props<{
      unreadCount: number;
      onClick: () => void;
      latestTitle?: string;
      latestIcon?: string;
      latestMessage?: string;
    }>();

  const hasUnread = $derived(unreadCount > 0);

  function handleClick() {
    onClick();
  }
</script>

{#if hasUnread}
  <div class="fixed bottom-[calc(56px+0.375rem+0.5rem)] left-0 right-0 w-full z-[1001] flex flex-row items-end justify-center gap-0 p-0 m-0 md:bottom-[calc(56px+0.375rem+0.5rem)] md:left-0 md:right-0 md:transform-none md:w-full md:p-0 md:m-0">
    <!-- Main notification preview -->
      <button
        class="group relative bg-accent-100 border-2 border-accent-500 rounded-full w-fit min-w-[280px] max-w-[500px] h-12 px-4 pb-[env(safe-area-inset-bottom)] flex items-center cursor-pointer transition-all duration-200 ease-out z-[1] overflow-visible mx-auto shadow-[0_2px_8px_rgba(244,208,63,0.15)] hover:bg-accent-500 hover:border-accent-500 hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(244,208,63,0.25)] active:bg-accent-600 active:border-accent-600 active:translate-y-0 active:shadow-[0_2px_8px_rgba(244,208,63,0.2)] md:w-fit md:min-w-[240px] md:max-w-[calc(100vw-2rem)] md:h-11 md:px-3.5 md:pb-[env(safe-area-inset-bottom)] md:rounded-full"
        onclick={handleClick}
        aria-label={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
      >
        <div class="flex items-center gap-4 w-full min-h-0 overflow-visible">
          <div class="flex items-center gap-2 flex-1 min-w-0 relative justify-start md:gap-1.5">
          <Icon icon="mdi:bell" color="var(--color-accent-500)" class="w-5 h-5 text-accent-500 shrink-0 transition-colors duration-200 md:w-[1.125rem] md:h-[1.125rem] group-hover:text-accent-100" />
            <div class="flex-1 min-w-0 flex flex-col gap-1 overflow-hidden text-left">
              {#if latestTitle && typeof latestTitle === "string" && latestTitle.trim() !== ""}
                <div class="text-sm font-semibold text-accent-700 leading-[1.2] overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-200 group-hover:text-accent-100 md:text-[0.8125rem] md:text-accent-700">{latestTitle}</div>
              {:else}
                <!-- Only show fallback if we truly have no title (shouldn't happen normally) -->
                <div class="text-sm font-semibold text-accent-700 leading-[1.2] overflow-hidden text-ellipsis whitespace-nowrap transition-colors duration-200 group-hover:text-accent-100 md:text-[0.8125rem] md:text-accent-700">New notification</div>
              {/if}
            </div>
            {#if unreadCount > 0}
              <span class="bg-accent-500 text-accent-900 rounded-full min-w-6 w-auto h-6 px-2 flex items-center justify-center text-xs font-bold leading-none shrink-0 static ml-auto border-none shadow-[0_2px_4px_rgba(244,208,63,0.2)] outline-none md:min-w-[1.375rem] md:w-auto md:h-[1.375rem] md:text-[0.6875rem] md:px-[0.4375rem] md:static md:rounded-full md:leading-none md:ml-auto md:border-none md:shadow-[0_2px_4px_rgba(244,208,63,0.2)] md:outline-none md:bg-accent-500 md:text-accent-900"
                >{unreadCount > 99 ? "99+" : unreadCount}</span
              >
            {/if}
          </div>
          <div class="w-6 h-6 text-accent-500 shrink-0 flex items-center justify-center transition-colors duration-200 group-hover:text-accent-100 md:w-5 md:h-5">
            <Icon icon="mdi:chevron-up" class="w-full h-full" />
          </div>
        </div>
      </button>
  </div>
{/if}

