<script lang="ts">
    import vis from 'vis';
    import { onMount, onDestroy } from 'svelte';
    import { network } from '../store/network';
    import Details from './Details.svelte';
    import AllowedRequest from './AllowedRequest.svelte';
    import ButtonDetails from './ButtonDetails.svelte';
    import ServerFromWindow from './ServerFormWindow.svelte';
    import axios from 'axios';
    import { env } from "$env/dynamic/public";
    import CenteredWindow from './CenteredWindow.svelte';

    
    const ipManager = env.PUBLIC_IP_MANAGER || "localhost";
    let visNetwork: vis.Network;
    let edges: vis.DataSet<vis.Edge> = new vis.DataSet([]);
    let nodes: vis.DataSet<vis.Node> = new vis.DataSet([]);
    let networkData:Network = {nodes: [], edges: []};
    let showEdgeDetails = false;
    let showNodeDetails = false;
    let lastNode: Node;
    let lastEdge: Edge;
    let showLinkEdit = false;
    let showNodeEdit = false;

    network.subscribe((value: unknown) => {
        networkData = value as Network;
        nodes.clear();
        edges.clear();
        nodes.update(generateVisNodesData());
        edges.update(generateVisEdgesData());
    });

    function generateVisNodesData() {
        
        const nodeDataset = networkData.nodes.map((node) => {
            let label;
            let color = 'red';
            if ("publishedPortWeb" in node) {
                label = `<b>${node.aet}</b> \nOrthanc name: ${node.orthancName} \nHost Name Swarm: ${node.hostNameSwarm}\n Port HTTP: ${node.publishedPortWeb}:${node.targetPortWeb} \n Port DICOM: ${node.publishedPortDicom}:${node.targetPortDicom}`;
            } else if ("IP" in node) {
                label = `<b>${node.aet}</b>\n IP: ${node.IP} \nPort DICOM: ${node.publishedPortDicom}`;
            } else if ("aet" in node && "publishedPortDicom" in node) {
                label = `<b>${node.aet}</b>\nPort DICOM: ${node.publishedPortDicom}`;
            } else {
                label = `Unvalid node`;
            }
            if (node.status) {
                color = 'green';
            }
            return {
                id: node.aet,
                label: label,
                color: { border: color },
                x: node.visX,
                y: node.visY
            };
        });
        return nodeDataset;
    }

    function generateVisEdgesData() {
        const edgeDataSet = networkData.edges.map(edge => {
            let color = 'red';
            if (edge.status) {
                color = 'green';
            }
            return {
                from: edge.from,
                to: edge.to,
                color: { color: color},
                id: edge.id
            };
        });
        return edgeDataSet;
    }

    function handleClick(event: { nodes: string[], edges: string[] }) {
        showEdgeDetails = (event.edges.length == 1) && (event.nodes.length == 0);
        showNodeDetails = (event.nodes.length == 1);
        if (showNodeDetails) {
            lastNode = networkData.nodes.find(node => node.aet === event.nodes[0]) || {} as Node;
        }
        if (showEdgeDetails) {
            lastEdge = networkData.edges.find(edge => edge.id === event.edges[0]) || {} as Edge;
        }
    }

    function handleDragEnd(event: { nodes: string[], pointer: { cavas: { x: number, y: number } } }) {
        if (event.nodes.length == 1) {
            const movedNode = networkData.nodes.find(node => node.aet === event.nodes[0]) || {} as Node;
            movedNode.visX = event.pointer.canvas.x;
            movedNode.visY = event.pointer.canvas.y;
            axios.post(`http://${ipManager}:3002/update_node_position`, movedNode)
            .then(response => {
                network.updateNetwork();
            }).catch(error => {
                alert(error);
            });
        }
    }

    function deleteServer() {
        if (lastNode) {
            axios.post(`http://${ipManager}:3002/delete_node`, lastNode)
            .then(() => {
                network.updateNetwork();
            }).catch((error: unknown) => {
                alert(error);
            });
            showNodeDetails = false;
        }
    }

    function deleteEdge() {
        if (lastEdge) {
            axios.post(`http://${ipManager}:3002/delete_edge`, lastEdge)
            .then(() => {
                network.updateNetwork();
            }).catch((error: unknown) => {
                alert(error);
            });
            showEdgeDetails = false;
            
        }
    }
    
    function editEdge() {
        if (lastEdge) {
            lastEdge.status = false;
            axios.post(`http://${ipManager}:3002/add_edge`, lastEdge)
			.then( () => {
				network.updateNetwork();
			}) .catch((error: any) => {
				alert(error);
			});
            showLinkEdit = false;
            showEdgeDetails = false;
        }
    }

    function editServer() {
        if (lastNode) {
            axios.post(`http://${ipManager}:3002/edit_server`, lastNode)
			.then( () => {
				network.updateNetwork();
			}) .catch((error: any) => {
				alert(error);
			});
            showNodeEdit = false;
        }
    }

    onMount(() => {
        network.updateNetwork();

        // create an array with nodes
        
        nodes.update(generateVisNodesData());

        // create an array with edges
        edges.update(generateVisEdgesData());

        // create a network
        var container = document.getElementById('mynetwork');

        // provide the data in the vis format
        var data = {
            nodes: nodes,
            edges: edges
        };
        var options = {
            nodes: {
                color: {
                    border: 'blue',
                    background: 'white'
                },
                shape: 'box',
                font: {
                    multi: 'html'
                },
            },
            physics: {
                enabled: false
            },
            edges: {
                smooth: false,
                arrows: {
                    to: {
                        enabled: true,
                        type: 'arrow'
                    }
                },
                
            }
        };

        if (container) {
            visNetwork = new vis.Network(container, data, options);
            visNetwork.on('click', handleClick);
            visNetwork.on('dragEnd', handleDragEnd);
        } else {
            console.error('Container element not found');
        }
    });

    onDestroy(() => {
        if (visNetwork) {
            visNetwork.destroy();
        }
    });
</script>

<Details bind:showDetails={showEdgeDetails}>

    <div class="d-flex fs-3 gap-4">
        {#if lastEdge.status}
            <i class="bi bi-circle-fill text-success text-left"></i>
        {:else}
            <i class="bi bi-circle-fill text-danger text-left"></i>
        {/if}
        <p class="text-center text-decoration-underline fw-bold">Link details</p>
    </div>
    <div class="fs-4">
        <p class="fw-bold">From:</p>
        <p>{lastEdge.from}</p>
        <p class="fw-bold">To:</p>
        <p>{lastEdge.to}</p>
        <p class="fw-bold">DICOM request:</p>
    </div>
    <AllowedRequest bind:allowed={lastEdge.allowEcho} text="Allow echo" />
    <AllowedRequest bind:allowed={lastEdge.allowGet} text="Allow get" />
    <AllowedRequest bind:allowed={lastEdge.allowStore} text="Allow store" />
    <AllowedRequest bind:allowed={lastEdge.allowFind} text="Allow find" />
    <AllowedRequest bind:allowed={lastEdge.allowMove} text="Allow move" />
    <div class="d-flex justify-content-around">
        <ButtonDetails text="Delete" onClick={deleteEdge}/>
        <ButtonDetails text="Edit it" onClick={() => {showLinkEdit=true}}/>
        <CenteredWindow bind:showModal={showLinkEdit} header="Edit link">
            <div slot="form">
				<form on:submit={editEdge}>
					<div class="mb-3">
						<label for="from" class="form-label fs-5">From:</label>
						<input bind:value={lastEdge.from} type="text" class="form-control rounded-3" id="from" readonly>
					</div>
					<div class="mb-3">
						<label for="to" class="form-label fs-5">To:</label>
						<input bind:value={lastEdge.to} type="text" class="form-control rounded-3" id="to" readonly>
					</div>
					<div class="grid grid-cols-2 gap-3">
						<div class="mb-3">
							<input bind:checked={lastEdge.allowEcho} class="form-check-input" type="checkbox" id="echo">
							<label class="form-check-label fs-5" for="echo">
								Allow echo
							</label>
						</div>
						<div class="mb-3">
							<input bind:checked={lastEdge.allowFind} class="form-check-input" type="checkbox" id="find">
							<label class="form-check-label fs-5" for="find">
								Allow find
							</label>
						</div>
						<div class="mb-3">
							<input bind:checked={lastEdge.allowGet} class="form-check-input" type="checkbox" id="get">
							<label class="form-check-label fs-5" for="get">
								Allow get
							</label>
						</div>
						<div class="mb-3">
							<input bind:checked={lastEdge.allowMove} class="form-check-input" type="checkbox" id="move">
							<label class="form-check-label fs-5" for="move">
								Allow move
							</label>
						</div>
						<div class="mb-3">
							<input bind:checked={lastEdge.allowStore} class="form-check-input" type="checkbox" id="store">
							<label class="form-check-label fs-5" for="store">
								Allow store
							</label>
						</div>
					</div>
					<button class="w-100 mb-2 btn btn-lg rounded-3 btn-primary" style="background-color: #1c398e;" type="submit">Apply changes to the link</button>
				</form>
			</div>
        </CenteredWindow>
    </div>
    
    
</Details>

<Details bind:showDetails={showNodeDetails}>
    <div class="d-flex fs-3 gap-4">
        {#if lastNode.status}
            <i class="bi bi-circle-fill text-success text-left"></i>
        {:else}
            <i class="bi bi-circle-fill text-danger text-left"></i>
        {/if}
        <p class="text-center text-decoration-underline fw-bold">Node details</p>
    </div>
    <div class="fs-4">
        <p class="fw-bold">Orthanc name:</p>
        <p>{lastNode.orthancName}</p>
        <div class="d-flex gap-2">
            <p class="fw-bold">AET:</p>
            <p>{lastNode.aet}</p>
        </div>
        <p class="fw-bold">Swarm node:</p>
        <p>{lastNode.hostNameSwarm}</p>
        <div class="d-flex gap-2">
            <p class="fw-bold">IP:</p>
            <p>{lastNode.ip}</p>
        </div>
        <div class="d-flex gap-2">
            <p class="fw-bold">Port HTTP:</p>
            <p>{lastNode.publishedPortWeb}:{lastNode.targetPortWeb}</p>
        </div>
        <div class="d-flex gap-2">
            <p class="fw-bold">Port DICOM:</p>
            <p>{lastNode.publishedPortDicom}:{lastNode.targetPortDicom}</p>
        </div>
        
        
        <div class="d-flex gap-2">
            <a href={`http://${lastNode.ip}:${lastNode.publishedPortWeb}`} target="_blank">
                <p class="fw-bold">Link to server</p>
            </a>
        </div>
    </div>
    <div class="d-flex justify-content-around">
        <ButtonDetails text="Delete" onClick={deleteServer}/>
        <ButtonDetails text="Edit it" onClick={() => {showNodeEdit=true}}/>
        <ServerFromWindow bind:showServerForm={showNodeEdit} bind:serverValues={lastNode} submit={editServer} editMode={true}/>
        
    </div>
        
    
</Details>

<div class="container-fluid flex-grow-1 d-flex bg-light">
    <div id="mynetwork" class="flex-grow-1"></div>
</div>
