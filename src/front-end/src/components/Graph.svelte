<script lang="ts">
    import vis from 'vis';
    import { onMount, onDestroy } from 'svelte';
    import { network } from '../store/network';
    import Details from './Details.svelte';

    type BaseNode = {
        aet: string;
        portDicom: string;
        status: boolean;
        visX: number;
        visY: number;
    }
    
    interface OrthancServer extends BaseNode {
        orthancName: string;
        hostNameSwarm: string;
        portWeb: string;
    };

    interface DICOMModality extends BaseNode {
        IP: string;
    };

    type Node = OrthancServer | DICOMModality | BaseNode;

    type Edge = {
        from: string;
        to: string;
        status: boolean;
    };

    type Network = {
        nodes: Node[];
        edges: Edge[];
    };
    
    let visNetwork: vis.Network;
    let edges: vis.DataSet<vis.Edge> = new vis.DataSet([]);
    let nodes: vis.DataSet<vis.Node> = new vis.DataSet([]);
    let networkData:Network = {nodes: [], edges: []};
    let showEdgeDetails = false;
    let showNodeDetails = false;
    let lastNode: Node;
    let lastEdge: Edge;

    network.subscribe((value: unknown) => {
        networkData = value as Network;
        nodes.update(generateVisNodesData());
        edges.update(generateVisEdgesData());
    });

    function generateVisNodesData() {
        
        const nodeDataset = networkData.nodes.map((node) => {
            let label;
            let color = 'red';
            if ("portWeb" in node) {
                label = `<b>${node.aet}</b> \nOrthanc name: ${node.orthancName} \nHost Name Swarm: ${node.hostNameSwarm}\n Port HTTP: ${node.portWeb} \n Port DICOM: ${node.portDicom}`;
            } else if ("IP" in node) {
                label = `<b>${node.aet}</b>\n IP: ${node.IP} \nPort DICOM: ${node.portDicom}`;
            } else if ("aet" in node && "portDicom" in node) {
                label = `<b>${node.aet}</b>\nPort DICOM: ${node.portDicom}`;
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
                color: { color: color}
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
            visNetwork.on('click', handleClick);
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
    <h2>Edge details</h2>  
</Details>

<Details bind:showDetails={showNodeDetails}>
    <h2>Node details {lastNode.aet}</h2>
</Details>

<div class="container-fluid flex-grow-1 d-flex bg-light">
    <div id="mynetwork" class="flex-grow-1"></div>
</div>
