<script lang="ts">
	import Graph from '../components/Graph.svelte';
	import ButtonHeader from '../components/ButtonHeader.svelte';
	import CenteredWindow from '../components/CenteredWindow.svelte';
	import { goto } from "$app/navigation";
	import { network } from '../store/network';
	import axios from 'axios';
	import { env } from "$env/dynamic/public";

	const ipManager = env.PUBLIC_IP_MANAGER || "localhost";
	let showAddServer = false;
	let showAddLink = false;

	const initialAddServerValues = {
		orthancName: '',
		aet: '',
		hostNameSwarm: '',
		portWeb: '',
		portDicom: '',
		status: false
	};

	const initialAddLinkValues = {
		from: '',
		to: '',
		status: false,
		allowEcho: true,
		allowFind: false,
		allowGet: false,
		allowMove: false,
		allowStore: false

	};

	let addServerValues = { ...initialAddServerValues };
	let addLinkValues = { ...initialAddLinkValues };

	function addServer() {
		
		// if (!addServerValues.orthancName || !addServerValues.aet || !addServerValues.hostNameSwarm || !addServerValues.portWeb || !addServerValues.portDicom) {
		// 	alert("All fields are required.");
		// 	return;
		// }
		// if (addServerValues.orthancName.length > 50 || addServerValues.aet.length > 50 || addServerValues.hostNameSwarm.length > 50) {
		// 	alert("Fields cannot exceed 50 characters.");
		// 	return;
		// }

		axios.post(`http://${ipManager}:3002/add_Orthanc_server`, addServerValues)
			.then( () => {
				network.updateNetwork();
			})
			.catch((error: any) => {
				alert(error);
			});
		showAddServer = false;
		addServerValues = { ...initialAddServerValues };
	
	}

	function addLink() {
		axios.post(`http://${ipManager}:3002/add_edge`, addLinkValues)
			.then( () => {
				network.updateNetwork();
			}) .catch((error: any) => {
				alert(error);
			});
		showAddLink = false;
		addLinkValues = { ...initialAddLinkValues };
	}
</script>



<!-- Header-->
<header class="py-6 bg-blue-900">
	<div class="grid grid-flow-col gap-4 px-8">
		<button type="button" on:click={()=> location.reload()} style="cursor: pointer; background: none; border: none; padding: 0;">
			<img src="/OrthancLogo.png" alt="logo" class="w-1/3 h-auto">
		</button>
		<ButtonHeader text="Add a server" onClick={()=> showAddServer=true}/>
		<CenteredWindow bind:showModal={showAddServer} header="Add an Orthanc server">
			<div slot="form">
				<form on:submit|preventDefault={addServer}>
					<div class="mb-3">
						<label for="serverName" class="form-label fs-5">Orthanc server name:</label>
						<input bind:value={addServerValues.orthancName} type="text" class="form-control rounded-3" id="serverName" placeholder="Ex: cardiology_server_1" maxlength="50" required>
					</div>
					<div class="mb-3">
						<label for="aet" class="form-label fs-5">Application Entity Title (AET):</label>
						<input bind:value={addServerValues.aet} type="text" class="form-control rounded-3" id="aet" placeholder="Ex: CARDIOLOGY_1" maxlength="16" required>
					</div>
					<div class="mb-3">
						<label for="hostName" class="form-label fs-5">Host name in swarm:</label>
						<input bind:value={addServerValues.hostNameSwarm} type="text" class="form-control rounded-3" id="hostName" placeholder="Ex: OrthancPACS" maxlength="50" required>
					</div>
					<div class="mb-3">
						<label for="webPort" class="form-label fs-5">Port Web:</label>
						<input bind:value={addServerValues.portWeb} type="text" class="form-control rounded-3" id="webPort" placeholder="Ex: 8083" pattern="\d+" required>
					</div>
					<div class="mb-3">
						<label for="DICOMPort" class="form-label fs-5">Port DICOM:</label>
						<input bind:value={addServerValues.portDicom} type="text" class="form-control rounded-3" id="DICOMPort" placeholder="Ex: 4243" pattern="\d+" required>
					</div>
					<button class="w-100 mb-2 btn btn-lg rounded-3 btn-primary" style="background-color: #1c398e;" type="submit">Add a server</button>
				</form>	
			</div>

		</CenteredWindow>
		<ButtonHeader text="Add link" onClick={()=> showAddLink=true}/>
		<CenteredWindow bind:showModal={showAddLink} header="Add a DICOM link">
			<div slot="form">
				<form on:submit={addLink}>
					<div class="mb-3">
						<label for="from" class="form-label fs-5">From:</label>
						<input bind:value={addLinkValues.from} type="text" class="form-control rounded-3" id="from" placeholder="Ex: CARDIOLOGY_SERVER_1">
					</div>
					<div class="mb-3">
						<label for="to" class="form-label fs-5">To:</label>
						<input bind:value={addLinkValues.to} type="text" class="form-control rounded-3" id="to" placeholder="Ex: CARDIOLOGY_SERVER_2">
					</div>
					<div class="mb-3">
						<input bind:checked={addLinkValues.allowEcho} class="form-check-input" type="checkbox" id="echo">
						<label class="form-check-label fs-5" for="echo">
							Allow echo
						</label>
					</div>
					<div class="mb-3">
						<input bind:checked={addLinkValues.allowFind} class="form-check-input" type="checkbox" id="find">
						<label class="form-check-label fs-5" for="find">
							Allow find
						</label>
					</div>
					<div class="mb-3">
						<input bind:checked={addLinkValues.allowGet} class="form-check-input" type="checkbox" id="get">
						<label class="form-check-label fs-5" for="get">
							Allow get
						</label>
					</div>
					<div class="mb-3">
						<input bind:checked={addLinkValues.allowMove} class="form-check-input" type="checkbox" id="move">
						<label class="form-check-label fs-5" for="move">
							Allow move
						</label>
					</div>
					<div class="mb-3">
						<input bind:checked={addLinkValues.allowStore} class="form-check-input" type="checkbox" id="store">
						<label class="form-check-label fs-5" for="store">
							Allow store
						</label>
					</div>
					<button class="w-100 mb-2 btn btn-lg rounded-3 btn-primary" style="background-color: #1c398e;" type="submit">Add a link</button>
				</form>
			</div>
			
		</CenteredWindow>
		<ButtonHeader text="Log out" onClick={()=>goto('/login')}/>
	</div>
</header>	

<Graph />

