<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { env } from "$env/dynamic/public";
    import axios from "axios";
    import { selectedTags } from "../../store/selectedTags";
    import { network } from "../../store/network";
    import { alertType, alertMessage } from "../../store/alert";

    export let tag: Tag = {name: "", color: ""};
    export let node: DicomNode | null = null;

    const dispatch = createEventDispatcher();
    const detailsMode: boolean = null != node;
    const baseUrl = env.PUBLIC_BASE_URL;
    
    function removeTag() {
        if (node) {
            axios.post(`${baseUrl}/nodes/untag`, {uuid: node.uuid, tagName: tag.name})
            .then(() => {
                node.tags = node.tags.filter((t: Tag) => t.name !== tag.name);
                network.updateNetwork();
            }).catch((error: any) => {
                alertType.set('danger');
                alertMessage.set(error.response.data.message || 'An error occurred while removing the tag from the node');
            });
        } else {
            selectedTags.removeTag(tag);
            network.updateNetwork();
        }
    }

</script>

<span class="badge badge-pill" style="background-color: {tag.color}; color: white;">
    {tag.name} | 
    {#if !detailsMode}
        <button aria-label="Edit tag {tag.name}" on:click={() => dispatch('editTag', tag)}>
            <i class="bi bi-pencil"></i>
        </button> |
    {/if}
    <button aria-label="Remove tag {tag.name}" on:click={removeTag}>
        <i class="bi bi-x"></i>
    </button>
</span>