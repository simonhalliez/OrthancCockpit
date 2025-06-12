<script lang="ts">
    import ButtonForm from "../Components/ButtonForm.svelte";
    import CenteredWindow from "../Components/CenteredWindow.svelte";
    import RemoteServerForm from "./RemoteServerForm.svelte";

    export let serverValues:OrthancServer ;
    export let submit;
    export let editMode: boolean = false;
    export let showServerForm: boolean = false;
    export let isCreateMode = true;
    
    let centeredWindowHeader = "Add an Orthanc server";
    let submitText = "Create the server";
    
    let classCard = "card rounded-0 shadow-sm border-1 border-top-0";
    if (editMode) {
        classCard = "card rounded-0 shadow-sm border-1";
        centeredWindowHeader = "Edit Orthanc server";
        submitText = "Apply changes to the server";
        
    }
</script>


<CenteredWindow bind:showModal={showServerForm} header={centeredWindowHeader}>
    <div slot="form">
        {#if !editMode}
            <ul class="nav nav-tabs">
                {#if isCreateMode}
                    <li class="nav-item flex-fill text-center">
                        <button on:click={() => isCreateMode = true} class="nav-link active bold">
                            Create a new server</button>
                    </li>
                    <li class="nav-item flex-fill text-center">
                        <button on:click={() => isCreateMode = false} class="nav-link text-dark">
                            Add a remote server
                        </button>
                    </li>
                {:else}
                    <li class="nav-item flex-fill text-center">
                        <button on:click={() => isCreateMode = true} class="nav-link text-dark">
                            Create a new server
                        </button>
                    </li>
                    <li class="nav-item flex-fill text-center">
                        <button on:click={() => isCreateMode = false} class="nav-link active">
                            Add a remote server
                        </button>
                    </li>
                {/if}
            </ul>
        {/if}
        {#if isCreateMode}
            <form on:submit|preventDefault={submit}>
                <div class={classCard} style="max-height: 450px; overflow-y: auto;">
                    <div class="card-body">
                        <div class="mb-3">
                            <label for="serverName" class="form-label fs-5">Orthanc server name:</label>
                            <input bind:value={serverValues.orthancName} type="text" class="form-control rounded-3" id="serverName" placeholder="Ex: cardiology_server_1" maxlength="50" required>
                        </div>
                        <div class="mb-3">
                            <label for="aet" class="form-label fs-5">Application Entity Title (AET):</label>
                            <input bind:value={serverValues.aet} type="text" class="form-control rounded-3" id="aet" placeholder="Ex: CARDIOLOGY_1" maxlength="16" required>
                        </div>
                        <div class="mb-3">
                            <label for="hostName" class="form-label fs-5">Host name in swarm:</label>
                            <input bind:value={serverValues.hostNameSwarm} type="text" class="form-control rounded-3" id="hostName" placeholder="Ex: OrthancPACS" maxlength="50" required>
                        </div>
                        <div class="mb-3">
                            <p class="form-label fs-5">Ports Web:</p>
                            <div class="grid grid-cols-2 gap-3">
                            
                                <div class="mb">
                                    <label for="publishedPortWeb" class="form-label fs-7">Published:</label>
                                    <input bind:value={serverValues.publishedPortWeb} type="text" class="form-control rounded-3" id="publishedPortWeb" placeholder="Ex: 8083" pattern="\d+" required>
                                </div>
                                <div class="mb">
                                    <label for="targetPortWeb" class="form-label fs-7">Target:</label>
                                    <input bind:value={serverValues.targetPortWeb} type="text" class="form-control rounded-3" id="targetPortWeb" placeholder="Ex: 8042" pattern="\d+" required>
                                </div>
                            </div>
                        </div>
                        <div class="mb-3">
                            <p class="form-label fs-5">Ports DICOM:</p>
                            <div class="grid grid-cols-2 gap-3">
                                <div class="mb">
                                    <label for="publishedPortDicom" class="form-label fs-7">Published:</label>
                                    <input bind:value={serverValues.publishedPortDicom} type="text" class="form-control rounded-3" id="publishedPortDicom" placeholder="Ex: 4243" pattern="\d+" required>
                                </div>
                                <div class="mb">
                                    <label for="targetPortDicom" class="form-label fs-7">Target:</label>
                                    <input bind:value={serverValues.targetPortDicom} type="text" class="form-control rounded-3" id="targetPortDicom" placeholder="Ex: 4242" pattern="\d+" required>
                                </div>
                            </div>
                        </div>
                        <ButtonForm text={submitText}/>
                    </div>
                </div>
            </form>	
        {:else}
            <RemoteServerForm bind:serverValues={serverValues} bind:editMode={editMode} bind:showServerForm={showServerForm}></RemoteServerForm>
        {/if}
    </div>
</CenteredWindow>