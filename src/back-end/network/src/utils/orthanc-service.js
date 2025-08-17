const fs = require('fs');
const path = require('path');
const log = require('debug')('network-d');
const { DockerService } = require('./docker-service');
const { Neo4jDriver } = require('./neo4j-driver');
const { UserService } = require('./user-service');
const { setTimeout } = require('timers/promises');
const { v4: uuidv4 } = require('uuid');
const { DicomService } = require('./dicom-service');
const { encrypt, decrypt, createUserId } = require('./crypto');
const axios = require('axios');

/**
 * Service for managing Orthanc servers in the Neo4j database and synchronizing with Docker and DICOM services.
 * Handles creation, update, deletion, status checks, and configuration file generation for Orthanc servers.
 */
class OrthancService {
  /**
   * @param {Neo4jDriver} neo4jDriver - The Neo4j driver instance.
   * @param {DicomService} dicomService - The DicomService instance.
   */
  constructor(neo4jDriver, dicomService) {
    this.neo4jDriver = neo4jDriver;
    this.dicomService = dicomService;
  }

  /**
   * Checks if an AET is unique among all nodes except the one with the given UUID.
   * @param {string} aet - The AET to check.
   * @param {string} uuid - The UUID to exclude from the check.
   * @param {object} tx - Neo4j transaction.
   * @throws {Error} If the AET is already in use.
   */
  static async checkAetUnique(aet, uuid, tx) {
    let result = await tx.run(`
        MATCH (n:Node)
        WHERE n.aet = $aet AND n.uuid <> $uuid
        RETURN n`,
        { aet, uuid }
      );
    if (result.records.length !== 0) {
      throw new Error(`AET ${aet} is already in use by another Orthanc server.`);
    }
  }

  /**
   * Creates a configuration file for an Orthanc server based on its modalities and users.
   * @param {object} serverInfo - Information about the Orthanc server.
   * @param {object} tx - Neo4j transaction.
   * @returns {Promise<void>}
   */
  static async createConfigurationFile(serverInfo, tx) {
    let secretName = `sec_${serverInfo.uuid}_V${serverInfo.configurationNumber}`;
    // Add the modality to the Orthanc server, they are not stored on this host.
    let modalities = await tx.run(`
      MATCH (edit_server:OrthancServer{uuid:$uuid})-[dicomLink:CONNECTED_TO]-(modality)
      OPTIONAL MATCH (modality)-[:RUNNING]->(host)
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

  /**
   * Adds a new Orthanc server to the database and creates its Docker service.
   * @param {object} reqBody - Properties for the new Orthanc server.
   * @returns {Promise<object>} Properties of the created Orthanc server.
   */
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

      // Check if the AET is unique.
      await OrthancService.checkAetUnique(reqBody.aet, reqBody.uuid, tx);
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
      } catch (err) {
        throw new Error(`Error creating the Docker service: ${err.message}`);
      }
      const res = JSON.parse(serviceResult.trim());
      // Create the Orthanc server node in DB.
      newServerResult = await tx.run(`
        MATCH (n:SwarmNode {name: $hostNameSwarm})
        MERGE (o:OrthancServer:Node {uuid: $uuid}) 
        MERGE (o)-[:RUNNING]->(n)
        MERGE (u:User {userId: $userId})
        MERGE (o)-[link:HAS_USER]->(u) 
        SET o.serviceId = $serviceId, 
        o.orthancName = $orthancName, 
        o.hostNameSwarm = $hostNameSwarm, 
        o.publishedPortWeb = $publishedPortWeb, 
        o.publishedPortDicom = $publishedPortDicom, 
        o.targetPortWeb = $targetPortWeb,
        o.targetPortDicom = $targetPortDicom,
        o.status = "pending", 
        o.visX = $visX, 
        o.visY = $visY,
        o.aet = $aet,
        o.secretName = $secretName,
        o.volumeName = $volumeName,
        o.configurationNumber = $configurationNumber,
        u.username = "admin",
        u.password = $password,
        link.state = "pending"
        RETURN o
        `,
        {...reqBody,...res, password: encrypt(process.env.ADMIN_PASSWORD, process.env.ADMIN_PASSWORD), userId: createUserId("admin", process.env.ADMIN_PASSWORD, process.env.ADMIN_PASSWORD) }
        
      )
    })
    await session.close();
    return newServerResult.records[0].get('o').properties;  
  }

  /**
   * Updates the status of all Orthanc servers by checking their health endpoints.
   * Sets status to 'up' or 'down' and updates properties from the live server.
   * @returns {Promise<void>}
   */
  async updateServerStatus() {
    const session = this.neo4jDriver.driver.session();
    await session.executeWrite( async (tx) => {
      let result = await tx.run(`
        MATCH (o:OrthancServer)
        OPTIONAL MATCH (o)-[l:HAS_USER]->(u:User)
        WHERE l.state = "valid"
        MATCH (o)-[:RUNNING]->(host)
        RETURN 
          o.uuid AS uuid,
          o.publishedPortWeb AS portWeb, 
          host.ip AS hostIp, 
          collect({username: u.username, password: u.password}) AS users
      `);
      for (const record of result.records) {
        let status;
        let response;
        const uuid = record.get('uuid');
        try {
          const portWeb = record.get('portWeb');
          const hostIp = record.get('hostIp');
          const firstUser = record.get('users')[0];
          response = await axios.get(`http://${hostIp}:${portWeb}/system`, {
            auth: {
              username: firstUser.username,
              password: decrypt(firstUser.password, process.env.ADMIN_PASSWORD)
            },
            timeout: 3000
          });
          status = 'up';
          await tx.run(`
            MATCH (o:OrthancServer {uuid: $uuid})
            SET o.status = 'up',
                o.orthancName = $Name,
                o.aet = $DicomAet,
                o.targetPortDicom = $DicomPort
          `, { uuid, ...response.data });

        } catch (err) {
          await tx.run(`
            MATCH (o:OrthancServer {uuid: $uuid})
            SET o.status = 'down'
          `, { uuid });
        }
        
      }
    });
    await session.close();
  }

  /**
   * Deletes a modality or Orthanc server from the database and cleans up Docker resources.
   * @param {string} uuid - UUID of the modality or server to delete.
   * @param {object} tx - Neo4j transaction.
   * @returns {Promise<void>}
   */
  async deleteModalitySession(uuid, tx) {
    await DicomService.deleteConnectedOrthancServer(uuid, tx);
    try {
      let deletedModalityResponse = await tx.run(
        'MATCH (o {uuid: $uuid}) ' +
        'return o',
        { uuid }
      );

      if (deletedModalityResponse.records.length === 0) {
        throw new Error(`No Orthanc server found with uuid ${uuid}`);
      }
      // Check if the request is for an Orthanc server.
      if (deletedModalityResponse.records[0].get('o').labels.includes("OrthancServer") &&
          !deletedModalityResponse.records[0].get('o').labels.includes("Remote")) {
        const deletedServer = deletedModalityResponse.records[0].get('o').properties;
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

      if (deletedModalityResponse.records[0].get('o').labels.includes("Remote")) {
        // If the server is a remote Orthanc server, shutdown it.
        const user = await UserService.getValidUsers(uuid, tx);
        const ip = await Neo4jDriver.recoverOrthancServerIp(uuid, tx);
        const portWeb = deletedModalityResponse.records[0].get('o').properties.publishedPortWeb;
        try {
          const remoteServerResponse = await axios.post(
            `http://${ip}:${portWeb}/tools/shutdown`,
            {},
            {
              auth: {
                username: user.username,
                password: decrypt(user.password, process.env.ADMIN_PASSWORD)
              }
            }
          );
        } catch (err) {
          throw new Error(`Error shutting down remote Orthanc server: ${err.message}`);
        }
      }
      // Execute the Cypher query to delete the server from the database
      await tx.run(
        'MATCH (o {uuid: $uuid}) ' +
        'DETACH DELETE o',
        { uuid }
      );
    } catch (err) {
      throw new Error(`Error removing service: ${err.message}`);
    }
  }

  /**
   * Deletes a modality or Orthanc server by UUID.
   * @param {string} uuid - UUID of the modality or server to delete.
   * @returns {Promise<void>}
   */
  async deleteModality(uuid) {
    let session = this.neo4jDriver.driver.session();
    await session.executeWrite( async (tx) => {
      await this.deleteModalitySession(uuid, tx);
    })
    await session.close();
  }

  /**
   * Edits an Orthanc server's properties, handles host changes, port changes, and data migration if needed.
   * Updates Docker secrets and configuration files as required.
   * @param {object} reqBody - Updated properties for the Orthanc server.
   * @returns {Promise<string>} UUID of the updated server.
   */
  async editServer(reqBody) {
    let session = this.neo4jDriver.driver.session();
    await session.executeWrite( async (tx) => {
      // Check if the node exists in the database.
      let nodeResult = await tx.run(`
        MATCH (n {uuid: $uuid}) 
        OPTIONAL MATCH (n)-[:RUNNING]->(host) 
        RETURN n, host`,
        reqBody
      )
      if (nodeResult.records.length === 0) {
        throw new Error(`No node found with uuid ${reqBody.uuid}`);
      }
      if (nodeResult.records.length > 1) {
        throw new Error(`Multiple nodes found with uuid ${reqBody.uuid}`);
      }
      if (!nodeResult.records[0].get('n').labels.includes("Remote")) {
        await OrthancService.checkAetUnique(reqBody.aet, reqBody.uuid, tx);
      }
      let nodeProperties = nodeResult.records[0].get('n').properties;
      let hostFromIp = nodeResult.records[0].get('host').properties.ip;
      // Edit if the host changed.
      let hostToIp = hostFromIp;

      // Get the IP of the new host.
      if (!nodeResult.records[0].get('n').labels.includes("Remote") && reqBody.hostNameSwarm !== nodeProperties.hostNameSwarm) {
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
              "visX": nodeProperties.visX,
              "visY": nodeProperties.visY,
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
        await DicomService.waitUntilServerUp(newServer.uuid, hostToIp, publishedPortWeb, tx);
        const edgeValue = {
          "from": nodeProperties.aet,
          "to": newServer.aet,
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

        // Add a connection between old and new servers
        await this.dicomService.addEdgeSession(edgeValue, tx);
        
        // Transfer data between servers
        await DicomService.transferAllInstances(hostFromIp, nodeProperties.publishedPortWeb, newServer.uuid);

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
          await this.dicomService.addEdgeSession(serverFrom.get('body'), tx);
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
            await this.dicomService.addEdgeSession(serverTo.get('body'), tx);
          }
        }
        // Remove the old server.
        await this.deleteModalitySession(nodeProperties.uuid, tx);
        // Change the nodeProperties and uuid of reqBody to change the port number and aet of the new server
        // to desired one.
        nodeProperties = newServer;
        reqBody.uuid = newServer.uuid;
      }
      // Update the modalities in connected Orthanc servers.
      if (
          (reqBody.aet !== nodeProperties.aet) ||
          (reqBody.publishedPortDicom !== nodeProperties.publishedPortDicom)
        ) {
        
        await DicomService.updateConnectedOrthancServer(reqBody, hostToIp, tx);
      }

      if (!nodeResult.records[0].get('n').labels.includes("Remote")) {
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
        } catch (err) {
          throw new Error(`Error creating the Docker service: ${err.message}`);
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
          o.status = "pending", 
          o.secretName = $secretName,
          o.configurationNumber = $configurationNumber
          `,
          reqBody
        )
      } else {
        // If the server is a remote Orthanc server, update its properties.
        await tx.run(`
          MATCH (o:OrthancServer {uuid: $uuid})
          OPTIONAL MATCH (o)-[r:RUNNING]->(:Host)
          DELETE r
          MERGE (h:Host {ip: $ip})
          MERGE (o)-[:RUNNING]->(h)
          SET o.publishedPortWeb = $publishedPortWeb, 
              o.publishedPortDicom = $publishedPortDicom, 
              o.status = "pending"
          `,
          reqBody
        )
      }
    })
    await session.close();
    return reqBody.uuid;
  }

  /**
   * Adds a tag to a node (Orthanc server or modality).
   * @param {object} reqBody - Contains uuid, tagName, color.
   * @returns {Promise<void>}
   */
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

  /**
   * Removes a tag from a node.
   * @param {object} reqBody - Contains uuid, tagName.
   * @returns {Promise<void>}
   */
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

  /**
   * Adds a remote Orthanc server to the database by retrieving its configuration via HTTP.
   * @param {object} reqBody - Properties for the remote server (ip, publishedPortWeb, username, password, etc.).
   * @returns {Promise<string>} UUID of the created remote server.
   */
  async addRemoteServer(reqBody) {
    // Retrieve the remote Orthanc server configuration.
    try {
      const response = await axios.get(`http://${reqBody.ip}:${reqBody.publishedPortWeb}/system`, {
      auth: {
        username: reqBody.username,
        password: reqBody.password
      }
      });
      reqBody.orthancName = response.data.Name;
      reqBody.aet = response.data.DicomAet;
      reqBody.targetPortDicom = Number(response.data.DicomPort);
      reqBody.targetPortWeb = Number(response.data.HttpPort);
      reqBody.visX = 0.0;
      reqBody.visY = 0.0;
      reqBody.status = "up";
      reqBody.userId = createUserId(reqBody.username, reqBody.password, process.env.ADMIN_PASSWORD);
      reqBody.uuid = uuidv4();
      reqBody.password = encrypt(reqBody.password, process.env.ADMIN_PASSWORD);
      await this.neo4jDriver.driver.executeQuery(`
        MERGE (h:Host {ip: $ip})
        MERGE (o:OrthancServer:Node {uuid: $uuid})
        SET o:Remote
        MERGE (o)-[:RUNNING]->(h)
        MERGE (u:User {userId: $userId})
        MERGE (o)-[link:HAS_USER]->(u) 
        SET o.orthancName = $orthancName,
            o.aet = $aet,
            o.publishedPortWeb = $publishedPortWeb,
            o.publishedPortDicom = $publishedPortDicom,
            o.targetPortWeb = $targetPortWeb,
            o.targetPortDicom = $targetPortDicom,
            o.status = $status,
            o.visX = $visX,
            o.visY = $visY,
            link.state = "valid",
            u.username = $username,
            u.password = $password
        `,
        reqBody
      )
    } catch (error) {
      throw new Error(`Error retrieving remote server configuration: ${error.message}`);
    }
    return reqBody.uuid;
  }
}

module.exports = { OrthancService };