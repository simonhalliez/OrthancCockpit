<script lang="ts">
    import ButtonForm from "../Components/ButtonForm.svelte";
    import CenteredWindow from "../Components/CenteredWindow.svelte";
    import axios from "axios";
    import { env } from "$env/dynamic/public";
    import { network } from "../../store/network";
    import { alertMessage, alertType } from '../../store/alert';

    export let showUserForm: boolean = false;
    export let orthancNode: OrthancServer;

    const baseUrl = env.PUBLIC_BASE_URL;

    let userValues: OrthancUser = {
        username: "",
        state: "pending",
        password: "",
        userId: ""
    };
    let centeredWindowHeader = "Add a user to the Orthanc server " + orthancNode.orthancName;
    let submitText = "Add the user";

    function submit() {
        // Add a user to the orthancServer.
        axios.post(`${baseUrl}/nodes/orthanc-servers/${orthancNode.uuid}/users`, {
            ...userValues
        })
        .then(() => {
            network.updateNetwork();
        })
        .catch(error => {
            alertType.set('danger');
            alertMessage.set(error.response.data.message || 'An error occurred while adding the user');
        });
        showUserForm = false;
    }
    
</script>

<CenteredWindow bind:showModal={showUserForm} header={centeredWindowHeader}>
    <div slot="form">
        <form on:submit|preventDefault={submit}>
            <div class="mb-3">
                <label for="username" class="form-label fs-5">Username:</label>
                <input bind:value={userValues.username} type="text" class="form-control rounded-3" id="username" placeholder="Ex: user1" maxlength="50" required>
            </div>
            <div class="mb-3">
                <label for="password" class="form-label fs-5">Password:</label>
                <input bind:value={userValues.password} type="password" class="form-control rounded-3" id="password" placeholder="Ex: password123" maxlength="50" required>
            </div>
            <ButtonForm text={submitText}/>
        </form>	
    </div>
</CenteredWindow>