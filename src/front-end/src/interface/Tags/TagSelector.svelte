<script lang="ts">
    import { onMount } from 'svelte';
    import { selectedTags } from '../../store/selectedTags';
    import { network } from '../../store/network';
    import TagBadge from './TagBadge.svelte';
    import TagFormWindow from './TagFormWindow.svelte';


    export let isIntersectMode = false;
    let headerHeight = 0;
    let showAddTagForm = false;
    let showEditTagForm = false;
    let tags: Tag[] = [];
    let currentEditTag: Tag = { name: '', color: '' };
    selectedTags.subscribe((value: Tag[]) => {
        tags = value;
    });

    onMount(() => {
        const header = document.querySelector('header');
        if (header) {
        headerHeight = header.offsetHeight;
        }
    });
</script>


<div class="d-flex flex-column flex-shrink-0 p-3 position-fixed fs-4"
    style="width: calc(100% - 300px);">
    <div class="d-flex gap-2 flex-wrap" >
        {#each tags as tag}
            <TagBadge 
                on:editTag={() => {
                    currentEditTag = tag;
                    showEditTagForm = true;
                }}
                bind:tag={tag} 
            />
        {/each}
        <span class="badge badge-pill bg-blue-900" style="color: white;">
            <button aria-label="Filter mode" on:click={() => {isIntersectMode = !isIntersectMode; selectedTags.update((tags) => {return tags;}); network.updateNetwork();}}>
                {#if isIntersectMode}
                    <i class="bi bi-intersect"></i>
                {:else}
                    <i class="bi bi-union"></i>
                {/if}
            </button>
        </span>
        
        <span class="badge badge-pill bg-blue-900" style="color: white;">
            <button aria-label="Add a tag" on:click={() => showAddTagForm = true}>
                <i class="bi bi-plus-circle"></i>
            </button>
        </span>
        <TagFormWindow bind:showTagForm={showAddTagForm}/>
        <TagFormWindow bind:showTagForm={showEditTagForm} tag={currentEditTag}/>
    </div>
</div>
