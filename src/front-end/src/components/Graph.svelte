<script lang="ts">
    import vis from 'vis';
    import { onMount, onDestroy } from 'svelte';
    import { network } from '../store/network';
    import Details from './Details.svelte';

    type BaseNode = {
        AET: string;
        PORTS_DICOM: string;
        STATUS: boolean;
        TYPE: string;
    }
    
    interface OrthancServer extends BaseNode {
        ORTHANC_NAME: string;
        HOST_NAME_SWARM: string;
        PORTS_WEB: string;
    };

    interface DICOMModality extends BaseNode {
        IP: string;
    };

    type Node = OrthancServer | DICOMModality;

    type Edge = {
        FROM: string;
        TO: string;
        STATUS: boolean;
    };

    type Network = {
        nodes: Node[];
        edges: Edge[];
    };
    
    let visNetwork: vis.Network;
    let edges: vis.DataSet<vis.Edge> = new vis.DataSet([]);
    let nodes: vis.DataSet<vis.Node> = new vis.DataSet([]);
    let networkData:Network = {nodes: [], edges: []};
    let showDetails = false;
    let lastClick:{ nodes: string[], edges: string[] };

    network.subscribe((value: unknown) => {
        networkData = value as Network;
        nodes.update(generateVisNodesData());
        edges.update(generateVisEdgesData());
    });

    function generateVisNodesData() {
        const nodeDataset = networkData.nodes.map(node => {
            let label;
            let color = 'red';
            if (node.TYPE === "Orthanc_server" && "PORTS_WEB" in node) {
                label= `<b>${node.AET}</b> \nOrthanc name: ${node.ORTHANC_NAME} \nHost Name Swarm: ${node.HOST_NAME_SWARM}\n Port HTTP: ${node.PORTS_WEB} \n Port DICOM: ${node.PORTS_DICOM}`;
            } else if (node.TYPE === "Modality" && "IP" in node) {
                label= `<b>${node.AET}</b>\n IP: ${node.IP} \nPort DICOM: ${node.PORTS_DICOM}`;
            } else {
                label = `Unknown node type: ${node.TYPE}`;
            }
            if (node.STATUS) {
                color = 'green';
            }
            return {
                id: node.AET,
                label: label,
                color: { border: color }
            };
        });
        return nodeDataset;
    }

    function generateVisEdgesData() {
        const edgeDataSet = networkData.edges.map(edge => {
            let color = 'red';
            if (edge.STATUS) {
                color = 'green';
            }
            return {
                from: edge.FROM,
                to: edge.TO,
                color: { color: color}
            };
        });
        return edgeDataSet;
    }

    function handleClick(event: { nodes: string[], edges: string[] }) {
        console.log(event);
        lastClick = event;
        if (!showDetails) {
            showDetails = true;
        }
    }

    onMount(() => {
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

<Details bind:showDetails={showDetails}>

</Details>

<div class="container-fluid flex-grow-1 d-flex bg-light">
    <div id="mynetwork" class="flex-grow-1"></div>
</div>
