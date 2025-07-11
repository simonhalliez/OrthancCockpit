<script lang="ts">
    import Details from "../Components/Details.svelte";
    import AllowedRequest from "./AllowedRequest.svelte";
    import ButtonDetails from "../Components/ButtonDetails.svelte";
    import { network } from '../../store/network';
    import { env } from "$env/dynamic/public";
    import EdgesFormWindow from "./EdgesFormWindow.svelte";
    import axios from 'axios';
    import { alertMessage, alertType } from '../../store/alert';

    export let edge: Edge;
    export let showEdgeDetails: boolean = false;

    const baseUrl = env.PUBLIC_BASE_URL;
    let showLinkEdit = false;
    
    function editEdge() {
        if (edge) {
            edge.status = "pending";
            axios.post(`${baseUrl}/edges`, edge)
			.then( () => {
				network.updateNetwork();
			}) .catch((error: any) => {
				alertType.set('danger');
                alertMessage.set(error.response.data.message || 'An error occurred while editing the edge');
			});
            showLinkEdit = false;
            showEdgeDetails = false;
        }
    }

    function deleteEdge() {
        if (edge) {
            axios.delete(`${baseUrl}/edges/${edge.id}`)
            .then(() => {
                network.updateNetwork();
            }).catch((error: any) => {
                alertType.set('danger');
				alertMessage.set(error.response.data.message || 'An error occurred while deleting the edge');
            });
            showEdgeDetails = false;
            
        }
    }

</script>
<Details bind:showDetails={showEdgeDetails}>

    <div class="d-flex fs-3 gap-4">

        {#if edge.status === "up"}
            <i class="bi bi-circle-fill text-success text-left"></i>
        {:else if edge.status === "pending"}
            <i class="bi bi-circle-fill text-left" style="color: rgb(252, 219, 5);"></i>
        {:else if edge.status === "down"}
            <i class="bi bi-circle-fill text-danger text-left"></i>
        {:else}
            <i class="bi bi-circle-fill text-left" style="color: grey;"></i>
        {/if}
        <p class="text-center text-decoration-underline fw-bold">Link details</p>
    </div>
    <div class="fs-4">
        <p class="fw-bold">From:</p>
        <p>{edge.from}</p>
        <p class="fw-bold">To:</p>
        <p>{edge.to}</p>
        <p class="fw-bold">DICOM request:</p>
    </div>
    <AllowedRequest bind:allowed={edge.allowEcho} text="Allow echo" />
    <AllowedRequest bind:allowed={edge.allowGet} text="Allow get" />
    <AllowedRequest bind:allowed={edge.allowStore} text="Allow store" />
    <AllowedRequest bind:allowed={edge.allowFind} text="Allow find" />
    <AllowedRequest bind:allowed={edge.allowMove} text="Allow move" />
    <div class="d-flex justify-content-around">
        <ButtonDetails text="Delete" onClick={deleteEdge}/>
        <ButtonDetails text="Edit it" onClick={() => {showLinkEdit=true}}/>
        <EdgesFormWindow bind:showEdgeForm={showLinkEdit} bind:edgeValues={edge} submit={editEdge} editMode={true}/>
    </div>
    
    
</Details>
