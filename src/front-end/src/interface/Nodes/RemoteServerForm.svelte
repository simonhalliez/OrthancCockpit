 <script lang="ts">
    import ButtonForm from "../Components/ButtonForm.svelte";
    import axios from "axios";
    import { env } from "$env/dynamic/public";
    import { network } from '../../store/network';
    import { alertType, alertMessage } from '../../store/alert';

    export let serverValues: OrthancServer;
    export let editMode: boolean = false;
    export let showServerForm: boolean = false;

    let textButton = "Add the server";
    let classCard = "card rounded-0 shadow-sm border-1 border-top-0";
    if (editMode) {
        classCard = "card rounded-0 shadow-sm border-1";
        textButton = "Edit the server in database";
    }
    const userInit:OrthancUser = {
        username: "",
        password: "",
        state: "pending",
        userId: "",
    };
    let user:OrthancUser = { ...userInit };
    const baseUrl = env.PUBLIC_BASE_URL;
    const ipManager = env.PUBLIC_IP_MANAGER || "localhost";

    function submit() {
        if (!editMode) {
            axios.post(`${baseUrl}/nodes/orthanc-servers/remote`, {
                ...user,
                ip: serverValues.ip,
                publishedPortWeb: serverValues.publishedPortWeb,
                publishedPortDicom: serverValues.publishedPortDicom
            })
                .then( () => {
                    network.updateNetwork();
                    user = { ...userInit };
                    serverValues.ip = "";
                    serverValues.publishedPortWeb = "";
                    serverValues.publishedPortDicom = "";
                }) .catch((error: any) => {
                    alertType.set('danger');
				    alertMessage.set(error.response.data.message || 'An error occurred while adding the remote server');
                });
        } else {
            serverValues.status = "pending";
            axios.put(`${baseUrl}/nodes/orthanc-servers/remote/${serverValues.uuid}`, serverValues)
			.then( () => {
				network.updateNetwork();
			}) .catch((error: any) => {
				alertType.set('danger');
                alertMessage.set(error.response.data.message || 'An error occurred while editing the remote server');
			});
        }
        showServerForm = false;
    }
</script>

<form on:submit|preventDefault={submit}>
    <div class={classCard} style="max-height: 450px; overflow-y: auto;">
        <div class="card-body">
            <div class="mb-3">
                <label for="ip" class="form-label fs-5">IP address:</label>
                <input bind:value={serverValues.ip} type="text" class="form-control rounded-3" id="ip" placeholder="Ex: 192.168.1.1" required>
            </div>
            <div class="mb-3">
                <p class="form-label fs-5">Published ports:</p>
                <div class="grid grid-cols-2 gap-3">
                    <div class="mb">
                        <label for="publishedPortWeb" class="form-label fs-7">Web:</label>
                        <input bind:value={serverValues.publishedPortWeb} type="text" class="form-control rounded-3" id="publishedPortWeb" placeholder="Ex: 8043" pattern="\d+" required>
                    </div>
                    <div class="mb">
                        <label for="targetPortDicom" class="form-label fs-7">DICOM:</label>
                        <input bind:value={serverValues.publishedPortDicom} type="text" class="form-control rounded-3" id="publishedPortDicom" placeholder="Ex: 4242" pattern="\d+" required>
                    </div>
                </div>
            </div>
            {#if !editMode}
                <div class="mb-3">
                    <p class="form-label fs-5">First server user:</p>
                    <div class="grid grid-cols-2 gap-3">
                        <div class="mb">
                            <label for="username" class="form-label fs-7">Username:</label>
                            <input bind:value={user.username} type="text" class="form-control rounded-3" id="username" placeholder="Ex: admin" required>
                        </div>
                        <div class="mb">
                            <label for="password" class="form-label fs-7">Password:</label>
                            <input bind:value={user.password} type="text" class="form-control rounded-3" id="password" placeholder="Ex: g85qf$kwhtg" required>
                        </div>
                    </div>
                </div>
            {/if}
            <ButtonForm text={textButton}/>
        </div>
    </div>
</form>