import { writable } from "svelte/store";
import type { Writable } from "svelte/store";
import axios from "axios";
import { env } from "$env/dynamic/public";

const baseUrl = env.PUBLIC_BASE_URL || "http://localhost:3002";

function createTags() {
    const { subscribe, set, update}: Writable<Tag[]> = writable<Tag[]>([]);

    return {
        subscribe,
        updateTags: () => {
            axios.get(`${baseUrl}/nodes/tags`)
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