import { writable } from "svelte/store";
import axios from "axios";
import { env } from "$env/dynamic/public";

const ipManager = env.PUBLIC_IP_MANAGER || "localhost";

function createNetwork() {
    const { subscribe, set, update} = writable({nodes: [],edges: []})

    return {
        subscribe,
        updateNetwork: () => {
            axios.get(`http://${ipManager}:3002/network`)
            .then((res) => {
                set(res.data.data);
            })
            .catch((err) => {
                console.log(err)
            })
        },
    }
}

export const network = createNetwork();