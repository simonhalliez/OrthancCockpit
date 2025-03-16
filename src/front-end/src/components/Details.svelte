<script lang="ts">
  export let showDetails: boolean = true;
</script>


	
<!-- svelte-ignore a11y-click-events-have-key-events -->

  {#if showDetails}
    <div style="z-index: 10">
        <div class="d-flex flex-column flex-shrink-0 p-3"style="width: 300px; position: fixed; right: 0; height: 100%; background-color: #bed0ed;">
          <span></span>
       </div>
    </div>
  {/if}





