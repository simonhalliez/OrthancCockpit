<script lang="ts">
    import CenteredWindow from "./CenteredWindow.svelte";

    export let edgeValues:Edge;
    export let submit;
    export let editMode: boolean = false;
    export let showEdgeForm: boolean = false;

    let centeredWindowHeader = "Add a DICOM link";
    let submitText = "Add a server";
    if (editMode) {
        centeredWindowHeader = "Edit Orthanc link";
        submitText = "Apply changes to the link";
    }
</script>

<CenteredWindow bind:showModal={showEdgeForm} header={centeredWindowHeader}>
    <div slot="form">
        <form on:submit={submit}>
            <div class="mb-3">
                <label for="from" class="form-label fs-5">From:</label>
                {#if editMode}
                    <input bind:value={edgeValues.from} type="text" class="form-control rounded-3" id="from" placeholder="Ex: CARDIOLOGY_SERVER_1" readonly>
                {:else}
                    <input bind:value={edgeValues.from} type="text" class="form-control rounded-3" id="from" placeholder="Ex: CARDIOLOGY_SERVER_1" required>
                {/if}
                
            </div>
            <div class="mb-3">
                <label for="to" class="form-label fs-5">To:</label>
                {#if editMode}
                    <input bind:value={edgeValues.to} type="text" class="form-control rounded-3" id="to" placeholder="Ex: CARDIOLOGY_SERVER_2" readonly>
                {:else}
                    <input bind:value={edgeValues.to} type="text" class="form-control rounded-3" id="to" placeholder="Ex: CARDIOLOGY_SERVER_2" required>
                {/if}
                
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div class="mb-3">
                    <input bind:checked={edgeValues.allowEcho} class="form-check-input" type="checkbox" id="echo">
                    <label class="form-check-label fs-5" for="echo">
                        Allow echo
                    </label>
                </div>
                <div class="mb-3">
                    <input bind:checked={edgeValues.allowFind} class="form-check-input" type="checkbox" id="find">
                    <label class="form-check-label fs-5" for="find">
                        Allow find
                    </label>
                </div>
                <div class="mb-3">
                    <input bind:checked={edgeValues.allowGet} class="form-check-input" type="checkbox" id="get">
                    <label class="form-check-label fs-5" for="get">
                        Allow get
                    </label>
                </div>
                <div class="mb-3">
                    <input bind:checked={edgeValues.allowMove} class="form-check-input" type="checkbox" id="move">
                    <label class="form-check-label fs-5" for="move">
                        Allow move
                    </label>
                </div>
                <div class="mb-3">
                    <input bind:checked={edgeValues.allowStore} class="form-check-input" type="checkbox" id="store">
                    <label class="form-check-label fs-5" for="store">
                        Allow store
                    </label>
                </div>
            </div>
            <button class="w-100 mb-2 btn btn-lg rounded-3 btn-primary" style="background-color: #1c398e;" type="submit">{submitText}</button>
        </form>
    </div>
    
</CenteredWindow>