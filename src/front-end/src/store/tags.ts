import { writable } from "svelte/store";
import type { Writable } from "svelte/store";
import axios from "axios";
import { env } from "$env/dynamic/public";

const ipManager = env.PUBLIC_IP_MANAGER || "localhost";

function createTags() {
    const { subscribe, set, update}: Writable<Tag[]> = writable<Tag[]>([]);

    return {
        subscribe,
        updateTags: () => {
            axios.get(`http://${ipManager}:3002/get_tags`)
            .then((res) => {
                set(res.data.data);
            })
            .catch((err) => {
                console.log(err)
            })
        },
    }
}

export const tags = createTags();