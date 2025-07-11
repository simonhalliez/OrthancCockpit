<script lang="ts">
  import CenteredWindow from "../Components/CenteredWindow.svelte";
  import UserForm from "./UserForm.svelte";
  import axios from "axios";
  import { env } from "$env/dynamic/public";
  import { network } from "../../store/network";
  import { alertMessage, alertType } from '../../store/alert';

  export let showUserDetails: boolean = false;
  export let node: OrthancServer;

  const baseUrl = env.PUBLIC_BASE_URL;
  let showUserForm: boolean = false;

  network.subscribe((n) => {
    if (n.nodes.length > 0) {
      node = n.nodes.find((n) => n.uuid === node.uuid) as OrthancServer;
    }
  });

  function deleteUser(user: OrthancUser) {
    axios.delete(`${baseUrl}/nodes/orthanc-servers/${node.uuid}/users/${user.userId}`).then(() => {
      // Remove the user from the local list
      node.users = node.users.filter(u => u.username !== user.username);
    }).catch(error => {
      alertType.set('danger');
      alertMessage.set(error.response.data.message || 'An error occurred while deleting the user');
    });
  }

</script>

<CenteredWindow bind:showModal={showUserDetails} header="Users in {node.orthancName}:" width={600}>
    <div slot="form">
        <div class="table-responsive" style="max-height: 300px; overflow-y: auto;">
            <table class="table table-striped">
                <thead>
                    <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Password</th>
                    <th scope="col">State</th>
                    <th scope="col">Delete</th>
                    </tr>
                </thead>
                <tbody>
                    {#each node.users as user, i}
                    <tr>
                        <td>{user.username}</td>
                        <td>{user.password}</td>
                        <td>
                          {#if user.state === "valid"}
                            <i class="bi bi-check-square text-success"></i>
                          {:else if user.state === "pending"}
                            <i class="bi bi-hourglass-split text-warning"></i>
                          {:else if user.state === "invalid"}
                            <i class="bi bi-x-square text-danger"></i>
                          {/if}
                        </td>
                        <td>
                            <button class="btn btn-danger btn-sm" on:click={() => deleteUser(user)}>Delete</button>
                        </td>
                    </tr>
                    {/each}
                    
                </tbody>
            </table>
        </div>
        <button class="w-100 my-3 btn btn-lg rounded-3 btn-primary" style="background-color: #1c398e;" type="button" on:click={() => showUserForm = true}>Add a user</button>
        <UserForm bind:showUserForm={showUserForm} bind:orthancNode={node}/>
    </div>
</CenteredWindow>