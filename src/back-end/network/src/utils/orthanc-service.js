const fs = require('fs');
const path = require('path');
const log = require('debug')('network-d');
const { DockerService } = require('./docker-service');
const { setTimeout } = require('timers/promises');
const { v4: uuidv4 } = require('uuid');
const { DicomService } = require('./dicom-service');
const { encrypt, decrypt } = require('./crypto');


class OrthancService {
  constructor(neo4jDriver, dicomService) {
    this.neo4jDriver = neo4jDriver;
    this.dicomService = dicomService;
  }

  static async createConfigurationFile(serverInfo, tx) {
    let secretName = `sec_${serverInfo.uuid}_V${serverInfo.configurationNumber}`;
    // Add the modality to the Orthanc server, they are not stored on this host.
    let modalities = await tx.run(`
      MATCH (edit_server:OrthancServer{uuid:$uuid})-[dicomLink:CONNECTED_TO]-(modality)
      OPTIONAL MATCH (modality)-[:RUNNING]->(host:SwarmNode)
      RETURN DISTINCT modality.uuid as modalityId,
      {
        AET: modality.aet,
        AllowEcho: dicomLink.allowEcho, 
        AllowFind: dicomLink.allowFind, 
        AllowGet: dicomLink.allowGet, 
        AllowMove: dicomLink.allowMove, 
        AllowStore: dicomLink.allowStore, 
        Port: modality.publishedPortDicom, 
        Host: COALESCE(modality.ip, host.ip)
      } as payload`,
      serverInfo
    )
    let modalitiesConfig = {};
    for (let i = 0; i < modalities.records.length; i++) {
      let modality = modalities.records[i];
      let payLoad = {
        ...modality.get('payload'),
        "AllowFindWorklist": false,
        "AllowStorageCommitment": false,
        "AllowTranscoding": false,
        "UseDicomTls": false,
          
      };
      modalitiesConfig[modality.get('modalityId')] = payLoad;
    }
    // Retrieve all the user of the Orthanc server.
    let users = await tx.run(`
      MATCH (edit_server:OrthancServer{uuid:$uuid})-[:HAS_USER]->(user:User)
      RETURN DISTINCT user.username AS username, user.password AS password`,
      serverInfo
    )
    let usersConfig = {};
    for (let i = 0; i < users.records.length; i++) {
      let user = users.records[i];
      usersConfig[user.get('username')] = decrypt(user.get('password'), process.env.ADMIN_PASSWORD);
    }
    // Create the configuration object for Orthanc server.
    let config = {
      "Name": serverInfo.orthancName,
      "DicomAet": serverInfo.aet,
      "DicomPort": Number(serverInfo.targetPortDicom),
      "HttpPort": Number(serverInfo.targetPortWeb),
      "RemoteAccessAllowed": true,
      "HttpServerEnabled": true,
      "DicomAlwaysAllowEcho" : false,
      "DicomAlwaysAllowStore" : false,
      "DicomTlsEnabled" : false,
      "RegisteredUsers" : {
          "admin" : process.env.ADMIN_PASSWORD, ...usersConfig
      },
      "StorageDirectory": "/var/lib/orthanc/db/",
      "DicomModalities" : modalitiesConfig
    };
    // Prepare output file path
    const outputFilePath = path.join(__dirname, '../../templates', `${secretName}.json`);

    // Write the modified config to a new JSON file
    fs.writeFile(outputFilePath, JSON.stringify(config, null, 2), (err) => {
        if (err) {
            log('Error writing output file:', err);
        } else {
            log(`Config saved to ${outputFilePath}`);
        }
    });
  }

  async addOrthancServer(reqBody) {
    reqBody.visX = 0.0;
    reqBody.visY = 0.0;
    reqBody.configurationNumber = 0;
    // Adding the Orthanc server to the database.
    let session = this.neo4jDriver.driver.session();
    let newServerResult;
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

      reqBody.uuid = uuidv4();
      // Create the Docker secret for the Orthanc server with configuration.
      await OrthancService.createConfigurationFile(reqBody, tx);

      // Create the Orthanc service for the new server
      let serviceResult = "";
      try {
        serviceResult = await DockerService.runCommand('bash', [
          'orthancManager.sh',
          'new_server',
          reqBody.hostNameSwarm,
          reqBody.publishedPortWeb,
          reqBody.targetPortWeb,
          reqBody.publishedPortDicom,
          reqBody.targetPortDicom,
          reqBody.uuid,
          reqBody.configurationNumber
        ]);
        log(`Orthanc service created successfully:\n`);
      } catch (err) {
        throw new Error(`Error creating the Docker service: ${err.message}`);
      }
      const res = JSON.parse(serviceResult.trim());
      // Create the Orthanc server node in DB.
      newServerResult = await tx.run(`
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
        o.configurationNumber = $configurationNumber
        RETURN o
        `,
        {...reqBody,...res}
        
      )
      // Create the relationship between the Orthanc server and the Swarm node.
      await tx.run(`
        MATCH (n:SwarmNode {name: $name})
        MATCH (o:OrthancServer {uuid: $uuid})
        MERGE (o)-[:RUNNING]->(n)
        `,
        {
          name: reqBody.hostNameSwarm,
          uuid: reqBody.uuid
        }
      )
      await tx.run(`
        MATCH (o:OrthancServer {uuid: $uuid})
        MERGE (u:User {username: "admin"})
        SET u.password = $password
        MERGE (o)-[link:HAS_USER]->(u) 
        SET link.state = "pending"
        `,
        {
          password: encrypt(process.env.ADMIN_PASSWORD, process.env.ADMIN_PASSWORD),
          uuid: reqBody.uuid
        }
      )
    })
    await session.close();
    return newServerResult.records[0].get('o').properties;  
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
              'MATCH (n:OrthancServer {serviceId: $serviceId}) SET n.status = "down"',
              { serviceId }
            );
          } else {
            await tx.run(
              'MATCH (n:OrthancServer {serviceId: $serviceId}) SET n.status = "up"',
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
      let nodeProperties = nodeResult.records[0].get('n').properties;
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
        
        // Create a new orthanc server on the new host.
        let isServerCreated = false;
        const regex = /port '\d+' is already in use by service/;
        let publishedPortDicom = Number(reqBody.publishedPortDicom) + 1;
        let publishedPortWeb = Number(reqBody.publishedPortWeb) + 1;
        let newServer;
        while (!isServerCreated) {
          try {
            let new_server = {
              "orthancName": reqBody.orthancName + "_TMP",
              "aet": reqBody.aet + "_TMP",
              "ip": "",
              "hostNameSwarm": reqBody.hostNameSwarm,
              "publishedPortDicom": publishedPortDicom,
              "publishedPortWeb": publishedPortWeb,
              "targetPortDicom": reqBody.targetPortDicom,
              "targetPortWeb": reqBody.targetPortWeb,
              "visX": 0,
              "visY": 0,
              "status": "pending",
            };
            newServer = await this.addOrthancServer(new_server);
            isServerCreated = true;
          } catch (err) {
            publishedPortDicom += 1;
            publishedPortWeb += 1;
            if (!(regex.test(err.message.trim()))) {
              // If the error message does not match the regex, throw the error
              throw new Error(`Error when searching for free port of new host ${err.message}`);
            }
          }
        }
        await DicomService.isOrthancServerUp(hostToIp, publishedPortWeb);
        const edgeValue = {
          "from": reqBody.aet,
          "to": reqBody.aet + "_TMP",
          "status": false,
          "allowEcho": true,
          "allowFind": true,
          "allowGet": true,
          "allowMove": true,
          "allowStore": true,
          "id": "",
          "uuidFrom": "",
          "uuidTo": ""
        }

        // Add a connection between servers
        await this.dicomService.addEdge(edgeValue);

        // Transfer data between servers
        await DicomService.transferAllInstances(reqBody.ip, nodeProperties.publishedPortWeb, newServer.uuid);

        // Create DICOM links.
        let bodiesToAddFromServer = await tx.run(`
          MATCH (node {uuid: $uuid})  
          MATCH (server)-[c:CONNECTED_TO]->(node)
          RETURN {
                  from: server.aet,
                  to: $newAet,
                  status: false,
                  allowEcho: c.allowEcho,
                  allowFind: c.allowFind,
                  allowGet: c.allowGet,
                  allowMove: c.allowMove,
                  allowStore: c.allowStore
                } AS body
          `,
          {uuid: nodeProperties.uuid, newAet: newServer.aet}
        );
        
        for (const serverFrom of bodiesToAddFromServer.records) {
          await this.dicomService.addEdge(serverFrom.get('body'));
        }

        let bodiesToAddToServer = await tx.run(`
          MATCH (node {uuid: $uuid})  
          MATCH (node)-[c:CONNECTED_TO]->(server)
          RETURN {
                  from: $newAet,
                  to: server.aet,
                  status: false,
                  allowEcho: c.allowEcho,
                  allowFind: c.allowFind,
                  allowGet: c.allowGet,
                  allowMove: c.allowMove,
                  allowStore: c.allowStore
                } AS body
          `,
          {uuid: nodeProperties.uuid, newAet: newServer.aet}
        );
        for (const serverTo of bodiesToAddToServer.records) {
          // Do not add the edge created for transfert instances.
          if (serverTo.get('body').to !== newServer.aet) {
            await this.dicomService.addEdge(serverTo.get('body'));
          }
        }

        // Remove the old server.
        await this.deleteServer(nodeProperties)

        // Change the nodeProperties and uuid of reqBody to change the port number and aet of the new server
        // to desired one.
        nodeProperties = newServer;
        reqBody.uuid = newServer.uuid;
      }

      // Update the Orthanc service for the new server.
      let serviceResult = "";
      reqBody.configurationNumber = nodeProperties.configurationNumber + 1;
      await OrthancService.createConfigurationFile(reqBody, tx);
      try {
        serviceResult = await DockerService.runCommand('bash', [
          'orthancManager.sh',
          'new_server',
          reqBody.hostNameSwarm,
          reqBody.publishedPortWeb,
          reqBody.targetPortWeb,
          reqBody.publishedPortDicom,
          reqBody.targetPortDicom,
          nodeProperties.uuid,
          reqBody.configurationNumber,
        ]);
        log(`Orthanc service update successfully:\n`);
      } catch (err) {
        throw new Error(`Error creating the Docker service: ${err.message}`);
      }
      
      // Update the modalities in connected Orthanc servers.
      if (
          (reqBody.aet !== nodeProperties.aet) ||
          (reqBody.publishedPortDicom !== nodeProperties.publishedPortDicom)
        ) {
        
        await DicomService.updateConnectedOrthancServer(reqBody, hostToIp, tx);
      }

      // Remove the old Docker secret for the Orthanc server.
      const res = JSON.parse(serviceResult.trim());
      let newSecretName = res.secretName;
      if (newSecretName !== nodeProperties.secretName) { 
        const oldSecretFilePath = path.join(__dirname, '../../templates', `${nodeProperties.secretName.replace(/^.*?(sec_)/, '$1')}`);
        await DockerService.runCommand('docker', [
          'secret', 'rm', nodeProperties.secretName
        ]);
        await DockerService.runCommand('rm', [
          oldSecretFilePath
        ]);
        reqBody.secretName = newSecretName;
      }

      // Update the Orthanc server in the database.
      await tx.run(`
        MATCH (o:OrthancServer {uuid: $uuid}) 
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
    
    })
    await session.close();
  }

  async addTag(reqBody) {
    let session = this.neo4jDriver.driver.session();
    await session.executeWrite( async (tx) => {
      const tagResult = await tx.run(`
        MATCH (node {uuid:$uuid}) 
        MERGE (tag:Tag {name: $tagName}) 
        MERGE (tag)-[:TAG]->(node) 
        SET tag.color = $color 
        RETURN node`,
        reqBody
      )
      if (tagResult.records.length === 0) {
        throw new Error(`No node found with uuid ${reqBody.uuid}`);
      }
    })
    await session.close();
  }

  async untagNode(reqBody) {
    let session = this.neo4jDriver.driver.session();
    await session.executeWrite( async (tx) => {
      const tagResult = await tx.run(`
        MATCH (node {uuid:$uuid}) 
        MATCH (tag:Tag {name: $tagName}) 
        MATCH (tag)-[r:TAG]->(node) 
        DELETE r 
        RETURN node`,
        reqBody
      )
      if (tagResult.records.length === 0) {
        throw new Error(`No node found with uuid ${reqBody.uuid}`);
      }
    })
    await session.close();
  }

  async addUser(reqBody) {
    let userResult;
    // Encrypt the password before storing it in the database.
    reqBody.password = encrypt(reqBody.password, process.env.ADMIN_PASSWORD);
    log(reqBody);
    userResult = await this.neo4jDriver.driver.executeQuery(`
      MATCH (o:OrthancServer {uuid: $uuid})
      MERGE (u:User {username: $username})
      SET u.password = $password
      MERGE (o)-[link:HAS_USER]->(u)
      SET link.state = $state
      RETURN o`, reqBody);
    
    if (userResult.records.length === 0) {
      throw new Error(`No node found with uuid ${reqBody.uuid}`);
    }
    await this.editServer(userResult.records[0].get('o').properties);
  }

  async removeUser(reqBody) {
    let userResult;
    userResult = await this.neo4jDriver.driver.executeQuery(`
      MATCH (o:OrthancServer {uuid: $uuid})-[r:HAS_USER]->(u:User {username: $username})
      DELETE r
      RETURN o`, reqBody);
    
    if (userResult.records.length === 0) {
      throw new Error(`No node found with uuid ${reqBody.uuid}`);
    }
    await this.editServer(userResult.records[0].get('o').properties);
  }
}

module.exports = { OrthancService };