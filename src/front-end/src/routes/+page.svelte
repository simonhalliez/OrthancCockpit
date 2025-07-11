<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from "$app/navigation";
	import { get } from 'svelte/store';
	import { network } from '../store/network';
	import { connectedUser } from '../store/connectedUser';
	import axios from 'axios';
	import { env } from "$env/dynamic/public";
	import Graph from '../interface/Components/Graph.svelte';
	import ButtonHeader from '../interface/Components/ButtonHeader.svelte';
    import ServerFromWindow from '../interface/Nodes/ServerFormWindow.svelte';
	import EdgesFormWindow from '../interface/Edges/EdgesFormWindow.svelte';
	import ModalityFormWindow from '../interface/Nodes/ModalityFormWindow.svelte';
	import { alertMessage, alertType } from '../store/alert';

	const baseUrl = env.PUBLIC_BASE_URL;
	let showAddServer = false;
	let showAddLink = false;
	let showAddModality = false;

	const initialAddServerValues:OrthancServer = {
		orthancName: '',
		aet: '',
		ip: '',
		hostNameSwarm: '',
		publishedPortDicom: '',
		publishedPortWeb: '',
		targetPortDicom: '',
		targetPortWeb: '',
		visX: 0.0,
		visY: 0.0,
		status: 'pending',
		uuid: '',
		tags: [],
		users: [],
	};

	const initialAddLinkValues:Edge = {
		from: '',
		to: '',
		status: 'pending',
		allowEcho: true,
		allowFind: false,
		allowGet: false,
		allowMove: false,
		allowStore: false,
		id: '',
		uuidFrom: '',
		uuidTo: '',

	};

	const initialModalityValues:DICOMModality = {
		aet: '',
		ip: '',
		publishedPortDicom: '',
		description: '',
		status: 'pending',
		visX: 0.0,
    	visY: 0.0,
		uuid: '',
		tags: []
	};

	let addServerValues:OrthancServer = { ...initialAddServerValues };
	let addLinkValues:Edge = { ...initialAddLinkValues };
	let addModalityValues:DICOMModality = { ...initialModalityValues };

	function addServer() {

		axios.post(`${baseUrl}/nodes/orthanc-servers`, addServerValues)
			.then( () => {
				network.updateNetwork();
			})
			.catch((error: any) => {
				alertType.set('danger');
				alertMessage.set(error.response.data.message || 'An error occurred while adding the server');
			});
		showAddServer = false;
		addServerValues = { ...initialAddServerValues };
	
	}

	function addLink() {
		axios.post(`${baseUrl}/edges`, addLinkValues)
			.then( () => {
				network.updateNetwork();
			}) .catch((error: any) => {
				alertType.set('danger');
				alertMessage.set(error.response.data.message || 'An error occurred while adding the link');
			});
		showAddLink = false;
		addLinkValues = { ...initialAddLinkValues };
	}

	function addModality() {
		axios.post(`${baseUrl}/nodes/modalities`, addModalityValues)
			.then( () => {
				network.updateNetwork();
			})
			.catch((error: any) => {
				alertType.set('danger');
				alertMessage.set(error.response.data.message || 'An error occurred while adding the modality');
			});
		showAddModality = false;
		addModalityValues = { ...initialModalityValues };
	}

	function clickLogo() {
		axios.get(`${baseUrl}/network/update_status`)
			.then(() => {
				network.updateNetwork();
			})
			.catch((error: any) => {
				alertType.set('danger');
				alertMessage.set(error.response.data.message || 'An error occurred while updating the network status');
			});
	}

	onMount(() => {
        const user = get(connectedUser);
        if (!user.isLogged) {
            goto('/login');
        }
    });
</script>

<div class="d-flex flex-column min-vh-100" style="overflow: hidden;">
	<!-- Header -->
	<header class="py-6 bg-blue-900">
		<div class="grid grid-flow-col gap-4 px-8">
			<button type="button" on:click={clickLogo} style="cursor: pointer; background: none; border: none; padding: 0;">
				<img src="/OrthancLogo.png" alt="logo" class="w-1/3 h-auto">
			</button>
			<ButtonHeader text="Add a modality" onClick={()=> showAddModality=true}/>
			<ModalityFormWindow bind:showServerForm={showAddModality} bind:modalityValue={addModalityValues} submit={addModality} editMode={false}/>
			<ButtonHeader text="Add a server" onClick={()=> showAddServer=true}/>
			<ServerFromWindow bind:showServerForm={showAddServer} bind:serverValues={addServerValues} submit={addServer} editMode={false}/>
			<ButtonHeader text="Add link" onClick={()=> showAddLink=true}/>
			<EdgesFormWindow bind:showEdgeForm={showAddLink} bind:edgeValues={addLinkValues} submit={addLink} editMode={false}/>
			<ButtonHeader text="Log out" onClick={() => {connectedUser.set({ isLogged: false, token: null }); goto('/login');}}/>
		</div>
	</header>
  
	<!-- Main Content -->
	<div class="flex-grow-1 d-flex position-relative">
	  <!-- Graph Section -->
	  <Graph />
	</div>
  </div>


