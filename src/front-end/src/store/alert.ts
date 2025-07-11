import { writable } from 'svelte/store';

export const alertMessage = writable('');
export const alertType = writable('danger'); // 'success', 'info', 'warning', 'danger'