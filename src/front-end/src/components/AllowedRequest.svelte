<script lang="ts">
    export let allowed: boolean;
    export let text: string;
</script>

<div class="d-flex gap-2 fs-6">
    {#if allowed}
    
        <i class="bi bi-check-square text-success"></i>
        <p>{text}</p>
        
    {:else}

        <i class="bi bi-x-square text-danger"></i>
        <p>{text}</p>

    {/if}
</div>