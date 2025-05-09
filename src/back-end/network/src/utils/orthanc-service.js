const axios = require('axios');
const log = require('debug')('network-d');
const { DockerService } = require('./docker-service');
const { setTimeout } = require('timers/promises');
const { v4: uuidv4 } = require('uuid');
const { DicomService } = require('./dicom-service');


class OrthancService {
  constructor(neo4jDriver) {
    this.neo4jDriver = neo4jDriver;
  }

  async addOrthancServer(reqBody) {
    reqBody.visX = 0.0;
    reqBody.visY = 0.0;
    reqBody.configurationNumber = 0;
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

      const resultNode = await tx.run(`
        MERGE (n:Counter {name: 'orthancServerCounter'})
        ON CREATE SET n.count = 0
        ON MATCH SET n.count = n.count + 1
        RETURN n.count
        `
      );
      const serverNumber =  resultNode.records[0].get('n.count').toInt();

      // Create the Orthanc service for the new server
      let serviceResult = "";
      try {
        serviceResult = await DockerService.runCommand('bash', [
          'orthancManager.sh',
          'new_server',
          reqBody.orthancName,
          reqBody.aet,
          reqBody.hostNameSwarm,
          reqBody.publishedPortWeb,
          reqBody.targetPortWeb,
          reqBody.publishedPortDicom,
          reqBody.targetPortDicom,
          serverNumber,
          reqBody.configurationNumber
        ]);
        log(`Orthanc service created successfully:\n${serviceResult}`);
      } catch (err) {
        throw new Error(`Error creating the Docker service: ${err.message}`);
      }
      const res = JSON.parse(serviceResult.trim());
      // Create the Orthanc server node in DB.
      await tx.run(`
        MERGE (o:OrthancServer {uuid: $uuid}) 
        SET o.serviceId = $serviceId, 
        o.orthancName = $orthancName, 
        o.hostNameSwarm = $hostNameSwarm, 
        o.publishedPortWeb = $publishedPortWeb, 
        o.publishedPortDicom = $publishedPortDicom, 
        o.targetPortWeb = $targetPortWeb,
        o.targetPortDicom = $targetPortDicom,
        o.status = $status, 
        o.visX = $visX, 
        o.visY = $visY,
        o.aet = $aet,
        o.secretName = $secretName,
        o.volumeName = $volumeName,
        o.configurationNumber = $configurationNumber,
        o.serverNumber = $serverNumber
        `,
        {...reqBody,...res, serverNumber: serverNumber, uuid: uuidv4()}
        
      )
      // Create the relationship between the Orthanc server and the Swarm node.
      await tx.run(`
        MATCH (n:SwarmNode {name: $name})
        MATCH (o:OrthancServer {serviceId: $serviceId})
        MERGE (o)-[:RUNNING]->(n)
        `,
        {
          name: reqBody.hostNameSwarm,
          serviceId: res.serviceId
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
          let serviceInspectResult = await DockerService.runCommand('docker', [
            'service', 'inspect', 
            '--format', '{{.ID}}', service.name
          ]);
          const serviceId = serviceInspectResult.trim();
          const replicaNumber = parseInt(service.replica.charAt(0));
          if ( replicaNumber === 0) {
            await tx.run(
              'MATCH (n:OrthancServer {serviceId: $serviceId}) SET n.status = false',
              { serviceId }
            );
          } else {
            await tx.run(
              'MATCH (n:OrthancServer {serviceId: $serviceId}) SET n.status = true',
              { serviceId }
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
    let session = this.neo4jDriver.driver.session();
    await session.executeWrite( async (tx) => {
      await DicomService.deleteConnectedOrthancServer(reqBody, tx);
      try {
        let deletedServerResponse = await tx.run(
          'MATCH (o {uuid: $uuid}) ' +
          'return o',
          reqBody
        );
        // Check if the request is for an Orthanc server.
        if (deletedServerResponse.records[0].get('o').labels.includes("OrthancServer")) {
          const deletedServer = deletedServerResponse.records[0].get('o').properties;
          // Remove the Docker service for the Orthanc server.
          const dockerRemoveResult = await DockerService.runCommand('docker', [
            'service', 'rm',
            deletedServer.serviceId
          ]);
          // Remove the Docker secret for the Orthanc server.
          const secretRemove = await DockerService.runCommand('docker', [
            'secret', 'rm',
            deletedServer.secretName
          ]);
          
          // Remove the Docker volume for the Orthanc server.
          let isVolumeCleaned = false;
          const regex = /^Error response from daemon: remove (.+): volume is in use - \[(.+)\]$/;
          while (!isVolumeCleaned) {
            await setTimeout(1000);
            try {
              const volumeRemove = await DockerService.runCommand('docker', [
                'volume', 'rm', '-f',
                deletedServer.volumeName
              ]);
              isVolumeCleaned = true;
            } catch (err) {
              if (!(regex.test(err.message.trim()))) {
                // If the error message does not match the regex, throw the error
                throw new Error(`Error removing Docker volume: ${err.message}`);
              }
            }
          }
        }
        // Execute the Cypher query to delete the server from the database
        await tx.run(
          'MATCH (o {uuid: $uuid}) ' +
          'DETACH DELETE o',
          reqBody
        );
        log(`Server ${reqBody.orthancName} deleted from the database.`);
      } catch (err) {
        throw new Error(`Error removing service: ${err.message}`);
      }
    })
  }

  async editServer(reqBody) {
    log("Editing server: ", reqBody);
    let session = this.neo4jDriver.driver.session();
    await session.executeWrite( async (tx) => {
      // Check if the node exists in the database.
      let nodeResult = await tx.run(`
        MATCH (n {uuid: $uuid})  
        RETURN n`,
        reqBody
      )
      if (nodeResult.records.length === 0) {
        throw new Error(`No node found with uuid ${reqBody.uuid}`);
      }
      if (nodeResult.records.length > 1) {
        throw new Error(`Multiple nodes found with uuid ${reqBody.uuid}`);
      }
      const nodeProperties = nodeResult.records[0].get('n').properties;

      // Update the Orthanc service for the new server.
      let serviceResult = "";
      reqBody.configurationNumber = nodeProperties.configurationNumber + 1;
      try {
        serviceResult = await DockerService.runCommand('bash', [
          'orthancManager.sh',
          'new_server',
          reqBody.orthancName,
          reqBody.aet,
          reqBody.hostNameSwarm,
          reqBody.publishedPortWeb,
          reqBody.targetPortWeb,
          reqBody.publishedPortDicom,
          reqBody.targetPortDicom,
          nodeProperties.serverNumber,
          reqBody.configurationNumber,
        ]);
        log(`Orthanc service update successfully:\n${serviceResult}`);
      } catch (err) {
        throw new Error(`Error creating the Docker service: ${err.message}`);
      }
      
      // Update the modalities in connected Orthanc servers.
      if ((reqBody.hostNameSwarm !== nodeProperties.hostNameSwarm) ||
          (reqBody.aet !== nodeProperties.aet) ||
          (reqBody.publishedPortDicom !== nodeProperties.publishedPortDicom)
        ) {
        let hostToIp = reqBody.ip;
        // Get the IP of the new host.
        if (reqBody.hostNameSwarm !== nodeProperties.hostNameSwarm) {
          let newHostTo = await tx.run(`
            MATCH (host_to:SwarmNode{name: $hostNameSwarm}) 
            RETURN host_to`,
            reqBody
          );
          if (newHostTo.records.length === 0) {
            throw new Error(`No swarm node found with name ${reqBody.hostNameSwarm}`);
          }
          if (newHostTo.records.length > 1) {
            throw new Error(`Multiple nodes found with name ${reqBody.hostNameSwarm}`);
          }
          hostToIp = newHostTo.records[0].get('host_to').properties.ip;
        }
        await DicomService.updateConnectedOrthancServer(reqBody, hostToIp, tx)
      }

      // Remove the old Docker secret for the Orthanc server.
      const res = JSON.parse(serviceResult.trim());
      let newSecretName = res.secretName;
      if (newSecretName !== nodeProperties.secretName) {  
        await DockerService.runCommand('docker', [
          'secret', 'rm', nodeProperties.secretName
        ]);
        reqBody.secretName = newSecretName;
      }

      // Update the Orthanc server in the database.
      await tx.run(`
        MATCH (o:OrthancServer {serviceId: $serviceId}) 
        SET o.orthancName = $orthancName,
        o.aet = $aet,  
        o.hostNameSwarm = $hostNameSwarm, 
        o.publishedPortWeb = $publishedPortWeb, 
        o.publishedPortDicom = $publishedPortDicom, 
        o.targetPortWeb = $targetPortWeb,
        o.targetPortDicom = $targetPortDicom,
        o.status = $status, 
        o.secretName = $secretName,
        o.configurationNumber = $configurationNumber
        `,
        reqBody
      )
      // Change the relationship between the Orthanc server and the Swarm node.
      if (reqBody.hostNameSwarm !== nodeProperties.hostNameSwarm) {
        await tx.run(`
          MATCH (o:OrthancServer {serviceId: $serviceId})-[r:RUNNING]->(old_host:SwarmNode {name: $oldHostNameSwarm})
          DELETE r
          WITH o
          MATCH (new_host:SwarmNode {name: $newHostNameSwarm})
          CREATE (o)-[:RUNNING]->(new_host)`,
          {
            serviceId: reqBody.serviceId,
            oldHostNameSwarm: nodeProperties.hostNameSwarm,
            newHostNameSwarm: reqBody.hostNameSwarm
          }
        )
      }
    })
    await session.close();
  }

}

module.exports = { OrthancService };