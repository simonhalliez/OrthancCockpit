<script lang="ts">
  import { onMount } from 'svelte';

  export let showDetails: boolean = false;
  let headerHeight = 0;

  onMount(() => {
    const header = document.querySelector('header');
    if (header) {
      headerHeight = header.offsetHeight;
    }
  });
</script>

{#if showDetails}
  <div
    class="d-flex flex-column flex-shrink-0 p-3 position-fixed"
    style="width: 300px; right: 0; height: calc(100vh - {headerHeight}px); overflow-y: auto; z-index: 10; background-color: #bed0ed;"
  >
    <slot></slot>
  </div>
{/if}