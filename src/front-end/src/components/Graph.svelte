<script lang="ts">
    import vis from 'vis';
    import { onMount, onDestroy } from 'svelte';
    import { network } from '../store/network';
    import { selectedTags } from '../store/selectedTags';
    import { tags } from '../store/tags';
    import axios from 'axios';
    import { env } from "$env/dynamic/public";
    import NodeDetails from './NodeDetails.svelte';
    import EdgeDetails from './EdgeDetails.svelte';
    import TagSelector from './TagSelector.svelte';

    
    const ipManager = env.PUBLIC_IP_MANAGER || "localhost";
    let visNetwork: vis.Network;
    let edges: vis.DataSet<vis.Edge> = new vis.DataSet([]);
    let nodes: vis.DataSet<vis.Node> = new vis.DataSet([]);
    let networkData:Network = {nodes: [], edges: []};
    let showEdgeDetails = false;
    let showNodeDetails = false;
    let isIntersectMode = false;
    let lastNode: DicomNode;
    let lastEdge: Edge;
    let tagSelected: Tag[] = [];

    network.subscribe((value) => {
        networkData = value;
        if (tagSelected.length > 0) {
            if (isIntersectMode) {
                networkData.nodes = networkData.nodes.filter(node => tagSelected.every(tag => node.tags.some(nodeTag => nodeTag.name === tag.name)));
            } else {
                networkData.nodes = networkData.nodes.filter(node => node.tags.some(tag => tagSelected.some(selectedTag => selectedTag.name === tag.name)));
            }
        }
        nodes.clear();
        edges.clear();
        nodes.update(generateVisNodesData());
        edges.update(generateVisEdgesData());
    });

    selectedTags.subscribe((value: Tag[]) => {
        tagSelected = value;
        
    });

    function generateVisNodesData() {
        
        const nodeDataset = networkData.nodes
        .map((node: DicomNode) => {
            let label;
            let color;
            if ("orthancName" in node){
                label = `<b>${node.aet}</b> \nOrthanc name: ${node.orthancName} \nHost Name Swarm: ${node.hostNameSwarm}\n Port HTTP: ${node.publishedPortWeb}:${node.targetPortWeb} \n Port DICOM: ${node.publishedPortDicom}:${node.targetPortDicom}`;
            } else {
                label = `<b>${node.aet}</b> \nIp address: ${node.ip}\nPort DICOM: ${node.publishedPortDicom}`;
            }

            if (node.status === 'up') {
                color = 'green';
            } else if (node.status === 'pending') {
                color = 'rgb(252, 219, 5)';
            } else {
                color = 'red';
            }
            return {
                id: node.uuid,
                label: label,
                color: { border: color },
                borderWidth: 2,
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
            lastNode = networkData.nodes.find(node => node.uuid === event.nodes[0]) || {} as DicomNode;
        }
        if (showEdgeDetails) {
            lastEdge = networkData.edges.find(edge => edge.id === event.edges[0]) || {} as Edge;
        }
    }

    function handleDragEnd(event: { nodes: string[], pointer: { canvas: { x: number, y: number } } }) {
        if (event.nodes.length == 1) {
            const movedNode = networkData.nodes.find(node => node.uuid === event.nodes[0]);
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
        tags.updateTags();

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
                smooth: {
                    enabled: true,
                    type: 'curvedCW', // or 'dynamic', 'curvedCCW', 'discrete', etc.
                    roundness: 0.075    // adjust for more/less curve
                },
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
<!-- Graph Section -->
<div class="flex-grow-1 bg-light">
    <div id="mynetwork" class="flex-grow-1" style="height: 100%;"></div>
</div>

<EdgeDetails bind:edge={lastEdge} bind:showEdgeDetails={showEdgeDetails} />
<NodeDetails bind:node={lastNode} bind:showNodeDetails={showNodeDetails} />
<TagSelector bind:isIntersectMode={isIntersectMode}/>
