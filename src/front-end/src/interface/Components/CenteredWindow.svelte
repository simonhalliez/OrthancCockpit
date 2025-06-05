<script lang="ts">
	export let showModal: boolean;
    export let header: string;
    export let width: number = 400;
</script>

<style>
    .modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 50;
        display: flex;
        align-items: center;
        justify-content: center;
    }

</style>

<!-- svelte-ignore a11y-click-events-have-key-events -->
{#if showModal}
	<div class="modal-backdrop" role="dialog" tabindex="0" on:close={() => (showModal = false)} on:click|self={() => showModal=false}>
		<div style="max-width: {width}px; width: 100%; z-index: 60;" role="document">
            <div class="modal-content rounded-4 shadow bg-white">
                <div class="modal-header justify-content-between p-3 pb-4 border-bottom-0">
                    <h1 class="fw-bold mb-0 fs-2 text-decoration-underline">{header}</h1>
                    <button type="button" class="btn-close" aria-label="Close" on:click={() => showModal=false}></button>
                </div>
                <div class="modal-body p-3 pt-0">
                    <slot name="form"/>
                </div>
            </div>
		</div>
	</div>
{/if}

