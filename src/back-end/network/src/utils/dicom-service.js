const log = require('debug')('network-d');
const axios = require('axios');
const { Neo4jDriver } = require('./neo4j-driver');

class DicomService {
  constructor(neo4jDriver) {
    this.neo4jDriver = neo4jDriver;
  }

  static async putModalityToOrthancServer(serverIp, serverPublishedPortWeb, modalityId, payload) {
    try {
      const response = await axios.put(
        `http://${serverIp}:${serverPublishedPortWeb}/modalities/${modalityId}`,
        payload,
        {
          auth: {
            username: 'admin',
            password: process.env.ADMIN_PASSWORD
          },
          headers: {
            'Content-Type': 'application/json'
          }
      });
    } catch (err) {
      throw new Error(`Adding a modality to host http://${serverIp}:${serverPublishedPortWeb}/modalities/${modalityId} : ${err.message}`);
    }
  }

  static async updateConnectedOrthancServer(nodeProperties, hostToIp, tx) {
    // Update the 'from' Orthanc servers that are connected to the modified Orthanc server.
    let connectedOrthancServers = await tx.run(`
      MATCH (node {uuid: $uuid}) 
      MATCH (node)-[:CONNECTED_TO]-(server:OrthancServer) 
      MATCH (server)-[:RUNNING]->(host:SwarmNode) 
      RETURN server, host`,
      nodeProperties
    );

    for (const connectedOrthancServer of connectedOrthancServers.records) {
      const serverFromProperties = connectedOrthancServer.get('server').properties;
      const hostFromProperties = connectedOrthancServer.get('host').properties;
      await DicomService.putModalityToOrthancServer(
        hostFromProperties.ip,
        serverFromProperties.publishedPortWeb,
        nodeProperties.uuid,
        {
          AET: nodeProperties.aet,
          Host: hostToIp,
          Port: nodeProperties.publishedPortDicom,
        }

      )
    }
  }

  static async isOrthancServerUp(ip, portWeb) {
    let isServerUp = false;

    while (!isServerUp) {
      try {
        const response = await axios.get(`http://${ip}:${portWeb}/system`, {
          auth: {
            username: 'admin',
            password: process.env.ADMIN_PASSWORD
          }
        });
        isServerUp = (response.status === 200);
      } catch (err) {
        log(`Orthanc health check failed: http://${ip}:${portWeb}/system`, err.message);
      }
      if (!isServerUp) {
        // Optional: wait before retrying to avoid spamming
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  static async transferAllInstances(sourceIp, sourcePort, targetUuid) {
    // Get all instances from source
    let instanceIds;
    try {
      instanceIds = (await axios.get(`http://${sourceIp}:${sourcePort}/instances`,
        {
            auth: {
              username: 'admin',
              password: process.env.ADMIN_PASSWORD
            }
        }
      )).data;
    } catch (err) {
      throw new Error("Fail to recover instances for transfert: " + err.message);
    }

    // Send all to the target Orthanc via modality
    try {
      const res = await axios.post(
        `http://${sourceIp}:${sourcePort}/modalities/${targetUuid}/store`, 
        {
          "Asynchronous": false,
          "Permissive": true,
          "Resources": instanceIds,
          "StorageCommitment": true,
          "Synchronous": true,
          },
        {
            auth: {
              username: 'admin',
              password: process.env.ADMIN_PASSWORD
            },
            headers: {
              'Content-Type': 'application/json'
            }
        }
      );
    } catch(err) {
      throw new Error(`Fail to transfert instances (http://${sourceIp}:${sourcePort}/modalities/${targetUuid}/store): ${err.message}`);
    }
  }

  static async deleteConnectedOrthancServer(nodeProperties, tx) {
    // Update the 'from' Orthanc servers that are connected to the modified Orthanc server.
    let connectedOrthancServers = await tx.run(`
      MATCH (node {uuid: $uuid}) 
      MATCH (node)-[:CONNECTED_TO]-(server:OrthancServer) 
      MATCH (server)-[:RUNNING]->(host:SwarmNode) 
      RETURN server, host`,
      nodeProperties
    );
    for (const connectedOrthancServer of connectedOrthancServers.records) {
      const serverFromProperties = connectedOrthancServer.get('server').properties;
      const hostFromProperties = connectedOrthancServer.get('host').properties;
      try {
        await axios.delete(`http://${hostFromProperties.ip}:${serverFromProperties.publishedPortWeb}/modalities/${nodeProperties.uuid}`, 
        {
          auth: {
            username: 'admin',
            password: process.env.ADMIN_PASSWORD
          }
        });
      } catch (error) {
        log(`Request to delete the modality http://${hostFromProperties.ip}:${serverFromProperties.publishedPortDicom}/modalities/${nodeProperties.uuid} failed: ${error.message}`);
      }
    }
  }

  async addEdge(reqBody) {
    let serverFrom = null;
    let serverTo = null;
    let session = this.neo4jDriver.driver.session();
    let isReverseMissing = false;

    await session.executeWrite( async (tx) => {

      // Check if the 'from' server exists in the database.
      serverFrom = await tx.run(`
        MATCH (n {aet: $from}) 
        OPTIONAL MATCH (n)-[:RUNNING]->(h:SwarmNode) 
        RETURN n,h
        `,
        reqBody
      );
      if (serverFrom.records.length === 0) {
        throw new Error(`No entity found with AET ${reqBody.from}`);
      }
      // Check the status of the 'from' server.
      if (serverFrom.records[0].get('n').properties.status === false && serverFrom.records[0].get('n').labels.includes("OrthancServer")) {
        throw new Error(`The orthanc server ${reqBody.from} is not running`);
      }
      serverTo = await tx.run(`
        MATCH (n {aet: $to}) 
        OPTIONAL MATCH (n)-[:RUNNING]->(h:SwarmNode) 
        RETURN n,h
        `,
        reqBody
      );
      // Check if the 'to' server exists in the database.
      if (serverTo.records.length === 0) {
        throw new Error(`No entity found with AET ${reqBody.to}`);
      }
      // Check the status of the 'to' server.
      if (serverTo.records[0].get('n').properties.status === false && serverTo.records[0].get('n').labels.includes("OrthancServer")) {
        throw new Error(`The orthanc server ${reqBody.to} is not running`);
      }
      await tx.run(
        'MATCH (n1 {aet: $from}) ' +
        'MATCH (n2 {aet: $to}) ' +
        'MERGE (n1)-[r:CONNECTED_TO]->(n2) ' +
        'SET r.status = $status, ' +
        'r.allowEcho = $allowEcho, ' +
        'r.allowFind = $allowFind, ' +
        'r.allowGet = $allowGet, ' +
        'r.allowMove = $allowMove, ' +
        'r.allowStore = $allowStore ',
        reqBody
      );
      let res = await tx.run(
        'MATCH (n2 {aet: $to})-[reverse_r:CONNECTED_TO]->(n1 {aet: $from}) ' + 
        'RETURN reverse_r',
        reqBody
      );
      isReverseMissing = (res.records.length === 0)
    });
    await session.close();

    // Recover the IP address of the 'from' server.
    let ipFrom;
    if (serverFrom.records[0].get('n').labels.includes("OrthancServer")) {
      ipFrom = serverFrom.records[0].get('h').properties.ip
    } else {
      ipFrom = serverFrom.records[0].get('n').properties.ip
    }

    // Recover common properties of a 'Modality' and an 'OrthancServer' servers.
    const aetFrom = serverFrom.records[0].get('n').properties.aet;
    const aetTo = serverTo.records[0].get('n').properties.aet;
    const targetPortDicomFrom = serverFrom.records[0].get('n').properties.publishedPortDicom;
    const targetPortDicomTo = serverTo.records[0].get('n').properties.publishedPortDicom;

    // Recover the IP address of the 'to' server and add modality to OrthancServer.
    let ipTo;
    if (serverTo.records[0].get('n').labels.includes("OrthancServer")) {
      ipTo = serverTo.records[0].get('h').properties.ip

      await DicomService.putModalityToOrthancServer(
        ipTo, 
        serverTo.records[0].get('n').properties.publishedPortWeb,
        serverFrom.records[0].get('n').properties.uuid,
        {
          "AET": aetFrom,
          "AllowEcho": reqBody.allowEcho,
          "AllowFind": reqBody.allowFind,
          "AllowGet": reqBody.allowGet,
          "AllowMove": reqBody.allowMove,
          "AllowStore": reqBody.allowStore,
          "AllowFindWorklist": false,
          "AllowStorageCommitment": false,
          "AllowTranscoding": false,
          "UseDicomTls": false,
          "Host": ipFrom,
          "Port": targetPortDicomFrom,
        }
      )
    } else {
      ipTo = serverTo.records[0].get('n').properties.ip
    }

    // Add the modality to the server from if the modality is not already present.
    if (isReverseMissing && serverFrom.records[0].get('n').labels.includes("OrthancServer")) {
      await DicomService.putModalityToOrthancServer(
        ipFrom, 
        serverFrom.records[0].get('n').properties.publishedPortWeb,
        serverTo.records[0].get('n').properties.uuid,
        {
          "AET": aetTo,
          "Host": ipTo,
          "Port": targetPortDicomTo
        }
      )
        
    }
  }

  async testDicomConnections() {
    let session = this.neo4jDriver.driver.session();
    await session.executeWrite( async (tx) => {
      const relationResult = await tx.run(`
        MATCH (n_from)-[c:CONNECTED_TO]->(n_to) 
        MATCH (n_from)-[r1:RUNNING]->(h_from) 
        RETURN n_from,n_to,h_from
        `,
      );
      for (const relation of relationResult.records) {
        try {
          // Perform the DICOM echo request
          await axios.post(
            `http://${relation.get('h_from').properties.ip}:${relation.get('n_from').properties.publishedPortWeb}/modalities/${relation.get('n_to').properties.uuid}/echo`,
            { "CheckFind": false, "Timeout": 3 },
            {
              auth: {
                username: 'admin',
                password: process.env.ADMIN_PASSWORD
              },
              headers: {
                'Content-Type': 'application/json'
              }
            }
          );

          // If the echo succeeds, update the relationship status to true
          await tx.run(
            `
            MATCH (n1 {aet: $from})-[r:CONNECTED_TO]->(n2 {aet: $to})
            SET r.status = true
            `,
            {
              from: relation.get('n_from').properties.aet,
              to: relation.get('n_to').properties.aet
            }
          );
        } catch (err) {
          // If the echo fails, update the relationship status to false
          await tx.run(
            `
            MATCH (n1 {aet: $from})-[r:CONNECTED_TO]->(n2 {aet: $to})
            SET r.status = false
            `,
            {
              from: relation.get('n_from').properties.aet,
              to: relation.get('n_to').properties.aet
            }
          );
        }
      }
    })
  }

  async deleteLink(reqBody) {
    let session = this.neo4jDriver.driver.session();
    await session.executeWrite( async (tx) => {
      const modalities = await tx.run(`
        MATCH (m_from)-[r:CONNECTED_TO]->(m_to) 
        WHERE elementId(r) = $id 
        OPTIONAL MATCH (m_to)-[reversed_r:CONNECTED_TO]->(m_from)
        RETURN m_from, m_to, reversed_r
        `,
        reqBody
      );
      
      if (modalities.records.length === 0) {
        throw new Error(`No link found in the database between ${reqBody.from} and ${reqBody.to}`);
      }
      const isReverse = (modalities.records[0].get('reversed_r') !== null)
      // Check if the 'to' server is an Orthanc server.
      if (modalities.records[0].get('m_to').labels.includes("OrthancServer")) {
        let hostIp = await Neo4jDriver.recoverNodeIp(modalities.records[0].get('m_to'), tx);
        const publishedPortWeb = modalities.records[0].get('m_to').properties.publishedPortWeb;
        // If it is reversed, keep the modality in the Orthanc server to ensure the reversed communication.
        if (isReverse) {
          await DicomService.putModalityToOrthancServer(
            hostIp,
            publishedPortWeb,
            modalities.records[0].get('m_from').properties.uuid,
            {
              "AET": modalities.records[0].get('m_to').properties.aet,
              "Host": hostIp,
              "Port": modalities.records[0].get('m_to').properties.publishedPortDicom,
              "AllowEcho": false,
              "AllowFind": false,
              "AllowGet": false,
              "AllowMove": false,
              "AllowStore": false
            }
          )
        } else {
          // If it is not reversed, delete the modality from the Orthanc server.
          try {
            await axios.delete(`http://${hostIp}:${publishedPortWeb}/modalities/${modalities.records[0].get('m_from').properties.uuid}`, 
            {
              auth: {
                username: 'admin',
                password: process.env.ADMIN_PASSWORD
              }
            });
          } catch (error) {
            throw new Error(`Request to delete the modality to ${reqBody.to} failed: ${error.message}`);
          }
        }
      }
      // Delete the modality in the 'from' Orthanc server if it is not reversed.
      if (modalities.records[0].get('m_from').labels.includes("OrthancServer") && !isReverse) {
        let hostIp = await Neo4jDriver.recoverOrthancServerIp(modalities.records[0].get('m_from').properties.serviceId, tx);
        const publishedPortWeb = modalities.records[0].get('m_from').properties.publishedPortWeb;
        try {
          await axios.delete(`http://${hostIp}:${publishedPortWeb}/modalities/${modalities.records[0].get('m_to').properties.uuid}`, 
          {
            auth: {
              username: 'admin',
              password: process.env.ADMIN_PASSWORD
            }
          });
        } catch (error) {
          throw new Error(`Request to delete the modality to ${reqBody.to} failed: ${error.message}`);
        }
      }

      // Delete the link in the database.
      await tx.run(`
        MATCH (m_from)-[r:CONNECTED_TO]->(m_to) 
        WHERE elementId(r) = $id 
        DELETE r
        `,
        reqBody
      );
    });
    await session.close();
  }
}

module.exports = { DicomService };