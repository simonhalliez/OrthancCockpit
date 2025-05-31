<script lang="ts">
    import CenteredWindow from "./CenteredWindow.svelte";
    import { env } from "$env/dynamic/public";
    import axios from "axios";
    import { tags } from '../store/tags';
    import { selectedTags } from "../store/selectedTags";
    import { network } from "../store/network";

    export let showTagForm: boolean = false;
    export let node: DicomNode | null = null;
    export let tag: Tag | null = null;

    const ipManager = env.PUBLIC_IP_MANAGER || "localhost";
    let submitTags: Tag = {name: "", color: ""};
    let selectedTag: Tag = {name: "", color: ""};;
    let tagOptions: Tag[] = [];
    tags.subscribe((value: Tag[]) => {
        tagOptions = value;
    });
    let title: string;
    let submitButtonText: string;
    $: if (tag) {
        node = null;
        title = "Edit tag " + tag.name;
        submitButtonText = "Edit the tag";
        submitTags = {name: tag.name, color: tag.color};
    } else if (node) {
        title = "Add a tag to " + node.aet;
        submitButtonText = "Add the tag";
    } else {
        title = "Add a tag to filter";
        submitButtonText = "Add the tag";
    }    
    
    function submit() {
        // Validation: Ensure only one of the two options is chosen
        
        if (tag) {
            axios.post(`http://${ipManager}:3002/edit_tag`,
                {tagName: tag.name, newName: submitTags.name, newColor: submitTags.color})
                .then(() => {
                    tags.updateTags();
                    network.updateNetwork();
                    selectedTags.updateTags(tag,submitTags);
                }).catch((error: unknown) => {
                    alert(error);
                });
        } else if (node) {
            if (!selectedTag.name && !submitTags.name ) {
                alert("Please select an existing tag or create a new tag before adding a tag.");
                return;
            }

            if (selectedTag.name && submitTags.name) {
                alert("Please either select an existing tag or provide details for a new tag.");
                return;
            }
            axios.post(`http://${ipManager}:3002/tag_node`,
                {uuid: node.uuid, tagName: selectedTag.name || submitTags.name, color: selectedTag.color || submitTags.color})
                .then(() => {
                    if (node) {
                        node.tags = [...node.tags, {name: selectedTag.name || submitTags.name, color: selectedTag.color || submitTags.color}];
                    }
                    submitTags = {name: "", color: ""};
                    selectedTag = {name: "", color: ""};
                    tags.updateTags();
                }).catch((error: unknown) => {
                    alert(error);
                });
        } else {
            selectedTags.addTag(selectedTag);
        }
            
        // Close the modal after submission
        showTagForm = false;
        
        
    }
</script>

<CenteredWindow bind:showModal={showTagForm} header={title}>
    <div slot="form">
        <form on:submit={submit}>
            {#if tag === null}
                <div class="mb-3">
                    <label for="selectTag" class="form-label fs-4">Select a tag:</label>
                    <select class="form-control" id="selectTag" bind:value={selectedTag}>
                        <option value="">No tag selected</option>
                        {#each tagOptions as tag}
                            <option value={tag}>{tag.name}</option>
                        {/each}
                    </select>
                </div>
            {/if}
            {#if node || tag}
                {#if tag === null}
                    <p class="fs-4">Create a new tag:</p>
                {/if}
                <div class="mb-3">
                    
                    <label for="name" class="form-label fs-5">Tag name:</label>
                    <input bind:value={submitTags.name} type="text" class="form-control rounded-3" id="name" placeholder="Ex: Cardiology" maxlength="20">
                    
                </div>
                <div class="mb-3">
                    <div class="grid grid-cols-2 gap-3">
                        <label for="" class="form-label fs-5">Color: </label>
                        <input bind:value={submitTags.color} type="color" class="form-control rounded-3" id="color">
                    </div>
                </div>    
            {/if}
            <button class="w-100 mb-2 btn btn-lg rounded-3 btn-primary" style="background-color: #1c398e;" type="submit">{submitButtonText}</button>
        </form>
    </div>
    
</CenteredWindow>