<script lang="ts">
    import vis from 'vis';
    import { onMount, onDestroy } from 'svelte';
    import { network } from '../store/network';
    import axios from 'axios';
    import { env } from "$env/dynamic/public";
    import NodeDetails from './NodeDetails.svelte';
    import EdgeDetails from './EdgeDetails.svelte';

    
    const ipManager = env.PUBLIC_IP_MANAGER || "localhost";
    let visNetwork: vis.Network;
    let edges: vis.DataSet<vis.Edge> = new vis.DataSet([]);
    let nodes: vis.DataSet<vis.Node> = new vis.DataSet([]);
    let networkData:Network = {nodes: {orthancServers: [], dicomModalities: []}, edges: []};
    let showEdgeDetails = false;
    let showNodeDetails = false;
    let lastNode: DicomNode;
    let lastEdge: Edge;

    network.subscribe((value: unknown) => {
        networkData = value as Network;
        nodes.clear();
        edges.clear();
        nodes.update(generateVisNodesData());
        edges.update(generateVisEdgesData());
    });

    function generateVisNodesData() {
        
        const orthancServers = networkData.nodes.orthancServers.map((node: OrthancServer) => {
            let label;
            let color = 'red';
            label = `<b>${node.aet}</b> \nOrthanc name: ${node.orthancName} \nHost Name Swarm: ${node.hostNameSwarm}\n Port HTTP: ${node.publishedPortWeb}:${node.targetPortWeb} \n Port DICOM: ${node.publishedPortDicom}:${node.targetPortDicom}`;
            
            if (node.status) {
                color = 'green';
            }
            return {
                id: node.uuid,
                label: label,
                color: { border: color },
                x: node.visX,
                y: node.visY
            };
        });
        
        const dicomModalities = networkData.nodes.dicomModalities.map((node: DICOMModality) => {
            let label;
            let color = 'red';
            label = `<b>${node.aet}</b> \nIp address: ${node.ip}\nPort DICOM: ${node.publishedPortDicom}:${node.outputPortDicom}`;
            
            if (node.status) {
                color = 'green';
            }
            return {
                id: node.uuid,
                label: label,
                color: { border: color },
                x: node.visX,
                y: node.visY
            };
        });
        
        const nodeDataset = [...orthancServers, ...dicomModalities];
        return nodeDataset;
    }

    function generateVisEdgesData() {
        const edgeDataSet = networkData.edges.map(edge => {
            let color = 'red';
            if (edge.status) {
                color = 'green';
            }
            return {
                from: edge.uuidFrom,
                to: edge.uuidTo,
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
            lastNode = networkData.nodes.dicomModalities.find(node => node.uuid === event.nodes[0]) || networkData.nodes.orthancServers.find(node => node.uuid === event.nodes[0]) || {} as DicomNode;
        }
        if (showEdgeDetails) {
            lastEdge = networkData.edges.find(edge => edge.id === event.edges[0]) || {} as Edge;
        }
    }

    function handleDragEnd(event: { nodes: string[], pointer: { canvas: { x: number, y: number } } }) {
        if (event.nodes.length == 1) {
            const movedNode = networkData.nodes.orthancServers.find(node => node.uuid === event.nodes[0]) || networkData.nodes.dicomModalities.find(node => node.uuid === event.nodes[0]);
            if (movedNode) {
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


<div class="container-fluid flex-grow-1 d-flex bg-light position-relative">
    <EdgeDetails bind:edge={lastEdge} bind:showEdgeDetails={showEdgeDetails}/>

    <NodeDetails bind:node={lastNode} bind:showNodeDetails={showNodeDetails}/>

    <div id="mynetwork" class="flex-grow-1"></div>
</div>
