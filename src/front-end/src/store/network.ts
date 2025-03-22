import { writable } from "svelte/store";
import axios from "axios";

function createNetwork() {
    const { subscribe, set, update} = writable({nodes: [],edges: []})

    return {
        subscribe,
        updateNetwork: () => {
            axios.get('http://192.168.129.92:3002/network')
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