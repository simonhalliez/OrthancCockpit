<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { env } from "$env/dynamic/public";
    import axios from "axios";
    import { selectedTags } from "../../store/selectedTags";
    import { network } from "../../store/network";

    export let tag: Tag = {name: "", color: ""};
    export let node: DicomNode | null = null;

    const dispatch = createEventDispatcher();
    const detailsMode: boolean = null != node;
    const ipManager = env.PUBLIC_IP_MANAGER || "localhost";

    
    function removeTag() {
        if (node) {
            axios.post(`http://${ipManager}:3002/untag_node`, {uuid: node.uuid, tagName: tag.name})
            .then(() => {
                node.tags = node.tags.filter((t: Tag) => t.name !== tag.name);
                network.updateNetwork();
            }).catch((error: unknown) => {
                alert(error);
            });
        } else {
            // axios.post(`http://${ipManager}:3002/remove_tag`, tag)
            // .then(() => {
            //     // Assuming you have a function to update the tags in the parent component
            //     selectedTags.removeTag(tag);
            // }).catch((error: unknown) => {
            //     alert(error);
            // });
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