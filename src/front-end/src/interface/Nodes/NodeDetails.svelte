<script lang="ts">
    import ButtonDetails from "../Components/ButtonDetails.svelte";
    import Details from "../Components/Details.svelte";
    import ModalityFormWindow from "./ModalityFormWindow.svelte";
    import ServerFormWindow from "./ServerFormWindow.svelte";
    import axios from "axios";
    import { network } from '../../store/network';
    import { env } from "$env/dynamic/public";
    import TagFormWindow from "../Tags/TagFormWindow.svelte";
    import TagBadge from "../Tags/TagBadge.svelte";
    import UserDetails from "../Users/UserDetails.svelte";

    export let node: DicomNode;
    export let showNodeDetails: boolean = false;

    const ipManager = env.PUBLIC_IP_MANAGER || "localhost";
    let showServerEdit = false;
    let showModalityEdit = false;
    let showAddTag = false;
    let showUserDetails = false;
    
    function editServer() {
        if (node) {
            node.status = "pending";
            axios.post(`http://${ipManager}:3002/edit_server`, node)
			.then( () => {
				network.updateNetwork();
			}) .catch((error: any) => {
				alert(error);
			});
            showServerEdit = false;
            showNodeDetails = false;
        }
    }

    function editModality() {
        if (node) {
            node.status = "pending";
            axios.post(`http://${ipManager}:3002/edit_modality`, node)
            .then( () => {
                network.updateNetwork();
            }) .catch((error: any) => {
                alert(error);
            });
            showModalityEdit = false;
            showNodeDetails = false;
        }
    }

    function deleteNode() {
        if (node) {
            axios.post(`http://${ipManager}:3002/delete_node`, node)
            .then(() => {
                network.updateNetwork();
            }).catch((error: unknown) => {
                alert(error);
            });
            showNodeDetails = false;
        }
    }
    
</script>


<Details bind:showDetails={showNodeDetails}>
    
    
    <div class="d-flex fs-4 gap-4 ">
        {#if node.status === 'up'}
            <i class="bi bi-circle-fill text-success text-left"></i>
        {:else if node.status === 'pending'}
            <i class="bi bi-circle-fill text-warning text-left"></i>
        {:else}
            <i class="bi bi-circle-fill text-danger text-left"></i>
        {/if}
        {#if 'hostNameSwarm' in node}
            <p class="text-center text-decoration-underline fw-bold">Orthanc server</p>
        {:else if 'orthancName' in node}
            <p class="text-center text-decoration-underline fw-bold">Remote Orthanc server</p>
        {:else}
            <p class="text-center text-decoration-underline fw-bold">Modality details</p>
        {/if}
        
        {#if 'orthancName' in node}
            <button type="button" aria-label="Show user details" on:click={() => { showUserDetails = true; }}>
                <i class="bi bi-person-square"></i>
            </button>
            <UserDetails bind:showUserDetails={showUserDetails} node={node} />
        {/if}
    </div>
    
    <div class="fs-5">
        <div class="d-flex gap-2" style="overflow-x: auto;">
            {#each node.tags as tag}
                <TagBadge {tag} bind:node={node}/>
            {/each}
        </div>
        {#if 'orthancName' in node}
            <p class="fw-bold">Orthanc name:</p>
            <p>{node.orthancName}</p>
        {/if}
        <div class="d-flex gap-2">
            <p class="fw-bold">AET:</p>
            <p>{node.aet}</p>
        </div>
        {#if 'orthancName' in node && node.hostNameSwarm !== undefined }
            <p class="fw-bold">Swarm node:</p>
            <p>{node.hostNameSwarm}</p>
        {/if}
        <div class="d-flex gap-2">
            <p class="fw-bold">IP:</p>
            <p>{node.ip}</p>
        </div>
        {#if 'orthancName' in node}
            <div class="d-flex gap-2">
                <p class="fw-bold">Port HTTP:</p>
                <p>{node.publishedPortWeb}:{node.targetPortWeb}</p>
            </div>
            <div class="d-flex gap-2">
                <p class="fw-bold">Port DICOM:</p>
                <p>{node.publishedPortDicom}:{node.targetPortDicom}</p>
            </div>
            <div class="d-flex gap-2">
                <a href={`http://${node.ip}:${node.publishedPortWeb}`} target="_blank">
                    <p class="fw-bold">Link to server</p>
                </a>
            </div>
        {:else}
            <div class="d-flex gap-2">
                <p class="fw-bold">Port DICOM:</p>
                <p>{node.publishedPortDicom}</p>
            </div>
            
            <p class="fw-bold">Description:</p>
            <div class="description-box  overflow-auto mb-3" style="max-height: 200px;">
                <p class="fs-5" style="white-space: pre-wrap;">{node.description}</p>
            </div>
        {/if}
        
        
        
    </div>
    <div class="d-flex justify-content-around">
        <ButtonDetails text="Delete" onClick={deleteNode}/>
        {#if 'orthancName' in node}
            <ButtonDetails text="Edit it" onClick={() => {showServerEdit=true}}/>
            {#if 'hostNameSwarm' in node}
                <ServerFormWindow bind:showServerForm={showServerEdit} serverValues={node} submit={editServer} editMode={true} isCreateMode={true}/>
            {:else}
                <ServerFormWindow bind:showServerForm={showServerEdit} serverValues={node} submit={editServer} editMode={true} isCreateMode={false}/>
            {/if}
            
        {:else}
            <ButtonDetails text="Edit it" onClick={() => {showModalityEdit=true}}/>
            <ModalityFormWindow bind:showServerForm={showModalityEdit} modalityValue={node} submit={editModality} editMode={true}/>
        {/if}
        
    </div>
    <div class="d-flex justify-content-center mt-3">
        <ButtonDetails text="Add a tag" onClick={() => {showAddTag=true}}/>
        <TagFormWindow bind:showTagForm={showAddTag} bind:node={node}/>
    </div>
    
</Details>