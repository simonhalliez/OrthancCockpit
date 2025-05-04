<script>
    export let text = 'Default Button';
    export let onClick = () => {};
</script>

<button type="button" 
    class="btn rounded-pill position-relative btn btn-outline-light"
    style="border-width: 3px; font-size: 1.25rem; color: #0D47A1; border-color: #0D47A1;"
    on:click={onClick}
>
    {text}
</button>