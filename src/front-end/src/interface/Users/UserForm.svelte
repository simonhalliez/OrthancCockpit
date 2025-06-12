<script lang="ts">
    import ButtonForm from "../Components/ButtonForm.svelte";
    import CenteredWindow from "../Components/CenteredWindow.svelte";
    import axios from "axios";
    import { env } from "$env/dynamic/public";
    import { network } from "../../store/network";

    export let showUserForm: boolean = false;
    export let orthancNode: OrthancServer;

    const ipManager = env.PUBLIC_IP_MANAGER || "localhost";

    let userValues: OrthancUser = {
        username: "",
        state: "pending",
        password: "",
        id: ""
    };
    let centeredWindowHeader = "Add a user to the Orthanc server " + orthancNode.orthancName;
    let submitText = "Add the user";

    function submit() {
        // Add a user to the orthancServer.
        axios.post(`http://${ipManager}:3002/add_user`, {
            uuid: orthancNode.uuid,
            ...userValues
        })
        .then(() => {
            network.updateNetwork();
        })
        .catch(error => {
            alert(`Error adding user: ${error}`);
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