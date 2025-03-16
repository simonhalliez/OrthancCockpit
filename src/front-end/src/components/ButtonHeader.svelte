<script>
    export let text = 'Default Button';
    export let onClick = () => {};
</script>

<button type="button" 
    class="btn position-relative btn-outline-light rounded-pill"
    style="border-width: 4px; font-size: 1.25rem;"
    on:click={onClick}
>
    {text}
</button>