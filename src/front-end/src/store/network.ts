import { writable } from "svelte/store";
import type { Writable } from "svelte/store";
import axios from "axios";
import { env } from "$env/dynamic/public";

const baseUrl = env.PUBLIC_BASE_URL;

function createNetwork() {
    const { subscribe, set, update}: Writable<Network> = writable<Network>({nodes: [],edges: []})

    return {
        subscribe,
        update,
        updateNetwork: () => {
            axios.get(`${baseUrl}/network`)
            .then((res) => {
                set(res.data.data);
            })
            .catch((err) => {
                console.log(err)
            })
        },
        updateOrthancServers: () => {
            axios.put(`${baseUrl}/orthanc-servers/update`, {});
        }
    }
}

export const network = createNetwork();