<script lang="ts">
	import Graph from '../components/Graph.svelte';
	import ButtonHeader from '../components/ButtonHeader.svelte';
	import { goto } from "$app/navigation";
	import { network } from '../store/network';
	import axios from 'axios';
	import { env } from "$env/dynamic/public";
    import ServerFromWindow from '../components/ServerFormWindow.svelte';
	import EdgesFormWindow from '../components/EdgesFormWindow.svelte';
	import ModalityFormWindow from '../components/ModalityFormWindow.svelte';

	const ipManager = env.PUBLIC_IP_MANAGER || "localhost";
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
		tags: []
	};

	const initialAddLinkValues:Edge = {
		from: '',
		to: '',
		status: false,
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

	function addModality() {
		axios.post(`http://${ipManager}:3002/add_modality`, addModalityValues)
			.then( () => {
				network.updateNetwork();
			})
			.catch((error: any) => {
				alert(error);
			});
		showAddModality = false;
		addModalityValues = { ...initialModalityValues };
	}

	function clickLogo() {
		axios.get(`http://${ipManager}:3002/update_status`)
			.then(() => {
				network.updateNetwork();
			})
			.catch((error: any) => {
				alert(error);
			});
	}
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
			<ButtonHeader text="Log out" onClick={()=>goto('/login')}/>
		</div>
	</header>
  
	<!-- Main Content -->
	<div class="flex-grow-1 d-flex position-relative">
	  <!-- Graph Section -->
	  <Graph />
	</div>
  </div>


