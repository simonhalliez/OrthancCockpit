<script lang="ts">
	import '../app.css';
	import axios from "axios";
	import { connectedUser } from "../store/connectedUser";
	import { get } from "svelte/store";
    import { alertMessage, alertType } from '../store/alert';

    axios.interceptors.request.use(
    config => {
        const user = get(connectedUser);
        if (user && user.token) {
            config.headers = config.headers || {};
            config.headers['Authorization'] = `Bearer ${user.token}`;
        }
        return config;
    },
    error => Promise.reject(error));

    let { children } = $props();
</script>

{#if $alertMessage}
    <div class="alert alert-{$alertType} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3" role="alert" style="z-index: 9999; min-width: 300px;">
        {$alertMessage}
        <button type="button" class="btn-close" aria-label="Close" on:click={() => alertMessage.set('')}></button>
    </div>
{/if}

{@render children()}
