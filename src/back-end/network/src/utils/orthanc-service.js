const axios = require('axios');
const log = require('debug')('network-d');
const { DockerService } = require('./docker-service');


class OrthancService {
  constructor(neo4jDriver) {
    this.neo4jDriver = neo4jDriver;
  }

  async addOrthancServer(reqBody) {
    reqBody.visX = 0.0;
    reqBody.visY = 0.0;
    // Adding the Orthanc server to the database.
    let session = this.neo4jDriver.driver.session();
    await session.executeWrite( async (tx) => {

      // Check if the node exists in the database.
      let nodeResult = await tx.run(
        'MATCH (n:SwarmNode {name: $name}) RETURN n',
        { name: reqBody.hostNameSwarm }
      )
      if (nodeResult.records.length === 0) {
        throw new Error(`No node found with name ${reqBody.hostNameSwarm}`);
      }
      if (nodeResult.records.length > 1) {
        throw new Error(`Multiple nodes found with name ${reqBody.hostNameSwarm}`);
      }

      // Create the Orthanc service for the new server
      try {
        const serviceResult = await DockerService.runCommand('bash', [
          'orthancManager.sh',
          'new_server',
          reqBody.orthancName,
          reqBody.aet,
          reqBody.hostNameSwarm,
          `${reqBody.portWeb}:8042`,
          `${reqBody.portDicom}:${reqBody.portDicom}`
        ]);
        log(`Orthanc service created successfully: ${serviceResult}`);
      } catch (err) {
        throw new Error(`Error creating the Docker service: ${err.message}`);
      }
      
      // Create the Orthanc server node in DB.
      await tx.run(`
        MERGE (o:OrthancServer {aet: $aet}) 
        SET o.orthancName = $orthancName, 
        o.hostNameSwarm = $hostNameSwarm, 
        o.portWeb = $portWeb, 
        o.portDicom = $portDicom, 
        o.status = $status, 
        o.visX = $visX, 
        o.visY = $visY`,
        reqBody
      )
      // Create the relationship between the Orthanc server and the Swarm node.
      await tx.run(`
        MATCH (n:SwarmNode {name: $name})
        MATCH (o:OrthancServer {aet: $aet})
        MERGE (o)-[:RUNNING]->(n)
        `,
        {
          name: reqBody.hostNameSwarm,
          aet: reqBody.aet
        }
      )
    })
    await session.close();    
  }

  async updateServerStatus() {
    try {
      const serviceResult = await DockerService.runCommand('docker', [
        'service', 'ls', 
        '--format', '{"name": "{{.Name}}", "replica": "{{.Replicas}}", "image": "{{.Image}}"}'
      ]);
      const services = serviceResult.split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line.trim()))
        .filter((service) => service.image === 'jodogne/orthanc-plugins:1.12.6');
      const session = this.neo4jDriver.driver.session();
      await session.executeWrite( async (tx) => {
        for (const service of services) {
          const orthancName = service.name.replace("orthancServers_", "");
          const replicaNumber = parseInt(service.replica.charAt(0));
          if ( replicaNumber === 0) {
            await tx.run(
              'MATCH (n:OrthancServer {orthancName: $orthancName}) SET n.status = false',
              { orthancName }
            );
          } else {
            await tx.run(
              'MATCH (n:OrthancServer {orthancName: $orthancName}) SET n.status = true',
              { orthancName }
            );
          }

        }
      });
      await session.close();

    } catch (err) {
      throw new Error(`Error update the status: ${err.message}`);
    }
  }
      

  async deleteServer(reqBody) {
    // TODO: REMOVE THE JSON FOR THE SECRET + NOT USE THE orthancName
    // Create a promise to wait for the `docker service rm` command to complete
    try {
      const dockerRemoveResult = await DockerService.runCommand('docker', [
        'service', 'rm',
        'orthancServers_' + reqBody.orthancName
      ]);
      // Execute the Cypher query to delete the server from the database
      await this.neo4jDriver.driver.executeQuery(
        'MATCH (o:OrthancServer {orthancName: $orthancName}) ' +
        'DETACH DELETE o',
        {
          orthancName: reqBody.orthancName
        }
      );
      log(`Server ${reqBody.orthancName} deleted from the database.`);
    } catch (err) {
      throw new Error(`Error removing service: ${err.message}`);
    }
  }

}

module.exports = { OrthancService };