import { writable } from "svelte/store";
import type { Writable } from "svelte/store";
import { env } from "$env/dynamic/public";

const ipManager = env.PUBLIC_IP_MANAGER || "localhost";

function createTags() {
    const { subscribe, set, update}: Writable<Tag[]> = writable<Tag[]>([]);

    return {
        subscribe,
        update,
        updateTags: (tag: Tag, newTag: Tag) => {
            update((tags) => {
                const index = tags.findIndex(t => t.name === tag.name);
                if (index !== -1) {
                    tags[index] = newTag;
                }
                return tags;
            })
        },
        addTag: (tag: Tag) => {
            update((tags) => {
                const existingTag = tags.find(t => t.name === tag.name);
                if (!existingTag) {
                    return [...tags, tag];
                }
                return tags;
            });
        },
        removeTag: (tag: Tag) => {
            update((tags) => {
                return tags.filter(t => t.name !== tag.name);
            });
        }
    }
}

export const selectedTags = createTags();