import { writable } from 'svelte/store';

export const connectedUser = writable({ isLogged: false, token: null });