const log = require('debug')('network-d');
const { DockerService } = require('./docker-service');

/**
 * Service for managing Docker Swarm nodes in the Neo4j database.
 * Handles adding, updating, and removing Swarm nodes based on Docker events.
 */
class SwarmService {
    /**
     * @param {Neo4jDriver} neo4jDriver - The Neo4j driver instance.
     */
    constructor(neo4jDriver) {
        this.neo4jDriver = neo4jDriver;
    }

    /**
     * Adds a Swarm node to the Neo4j database by inspecting its Docker properties.
     * @param {string} nodeID - The Docker node ID.
     * @returns {Promise<void>}
     */
    addNodeInDB(nodeID) {
        DockerService.runCommand('docker',
            ['inspect', nodeID, '--format', 'json']
        ).then(async (nodeInspect) => {
            let node = JSON.parse(nodeInspect.trim())[0];
            await this.neo4jDriver.driver.executeQuery(`
                MERGE (n:SwarmNode {id: $id}) 
                SET n.ip = $ip, n.name = $name, n.status = $status, n.role = $role 
                RETURN n`,
                {
                    id: node.ID,
                    ip: node.Status.Addr,
                    name: node.Description.Hostname,
                    status: node.Status.State,
                    role: node.Spec.Role
                }
            );
        
            log(`Node ${node.ID} added to the database`);
        });
    }

    /**
     * Adds all initial Swarm nodes to the Neo4j database by listing Docker nodes.
     * @returns {Promise<void>}
     */
    addInitialSwarmNodes() {
        DockerService.runCommand('docker', [
            'node', 'ls', '--format', 'json'
        ]).then((output) => {
            let swarmNodes = output.split('\n').filter((line) => line !== '').map((jsonString) => JSON.parse(jsonString));
            // Add each node in the swarm.
            for (const node of swarmNodes) {
                this.addNodeInDB(node.ID);
            }
        });
    }

    /**
     * Listens for Docker Swarm node events and updates the Neo4j database accordingly.
     * Adds nodes when they become ready and removes nodes when they go down.
     * @returns {Promise<void>}
     */
    async updateSwarmNodes() {
        const onSwarmEvent = async (line) => {
            const nodeEvent = JSON.parse(line);
            if (nodeEvent.Actor.Attributes['state.new'] === 'ready') {
                this.addNodeInDB(nodeEvent.Actor.ID);
            }
            if (nodeEvent.Actor.Attributes['state.new'] === 'down') {
                await this.neo4jDriver.driver.executeQuery(
                    `
                    MATCH (n:SwarmNode {id: $id})
                    DETACH DELETE n
                    `,
                    { id: nodeEvent.Actor.ID }
                );
                log(`Swarm node ${nodeEvent.Actor.ID} removed from the database`);
            }
        };

        const onError = (error) => {
            log('Error in update node in swarm:', error.message);
        };
        DockerService.lineProcessListener('swarm', 'docker',
            [
                'events', '--filter', 'scope=swarm', '--filter', 'type=node',
                '--format', 'json'
            ],
            onSwarmEvent,
            onError
        );
    }

}

module.exports = { SwarmService };