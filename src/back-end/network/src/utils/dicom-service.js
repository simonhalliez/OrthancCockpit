const log = require('debug')('network-d');
const axios = require('axios');
const { DockerService } = require('./docker-service');

class DicomService {
  constructor(neo4jDriver) {
    this.neo4jDriver = neo4jDriver;
  }

  async addEdge(reqBody) {
    log(process.env.ADMIN_PASSWORD)
    let serverFrom = null;
    let serverTo = null;
    let session = this.neo4jDriver.driver.session();
    let isReverseMissing = false;

    await session.executeWrite( async (tx) => {

      // Check if the 'from' server exists in the database.
      serverFrom = await tx.run(
        'MATCH (n:OrthancServer {aet: $from})-[:RUNNING]->(h:SwarmNode)  RETURN n,h',
        reqBody
      );
      if (serverFrom.records.length === 0) {
        throw new Error(`No orthanc server found with AET ${reqBody.from}`);
      }
      // Check the status of the 'from' server.
      if (serverFrom.records[0].get('n').properties.status === false) {
        throw new Error(`The orthanc server ${reqBody.from} is not running`);
      }
      serverTo = await tx.run(
        'MATCH (n:OrthancServer {aet: $to})-[:RUNNING]->(h:SwarmNode)  RETURN n,h',
        reqBody
      );
      // Check if the 'to' server exists in the database.
      if (serverTo.records.length === 0) {
        throw new Error(`No orthanc server found with AET ${reqBody.to}`);
      }
      // Check the status of the 'to' server.
      if (serverTo.records[0].get('n').properties.status === false) {
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
    
    const serverFromProperties = serverFrom.records[0].get('n').properties;
    const serverToProperties = serverTo.records[0].get('n').properties;
    const nodeFromPoperties = serverFrom.records[0].get('h').properties;
    const nodeToPoperties = serverTo.records[0].get('h').properties;
    // Add the peer to the server 'from'.
    try {
      const response = await axios.put(
       `http://${nodeFromPoperties.ip}:${serverFromProperties.publishedPortWeb}/peers/${serverToProperties.serviceId}`,
      { Url: `http://${nodeToPoperties.ip}:${serverToProperties.publishedPortWeb}` },
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
      log(`Error when adding a peer to ${reqBody.from}: ${err.message}`);
    }

    // Add the peer to the server 'to'.
    try {
      const response = await axios.put(
        `http://${nodeToPoperties.ip}:${serverToProperties.publishedPortWeb}/peers/${serverFromProperties.serviceId}`,
        { Url: `http://${nodeFromPoperties.ip}:${serverFromProperties.publishedPortWeb}` },
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

    } catch (err) {
      log(`Error when adding a peer to ${reqBody.to}: ${err.message}`);
    }
      
    // Add the modality to the server 'to'.
    try {
      const response = await axios.put(
        `http://${nodeToPoperties.ip}:${serverToProperties.publishedPortWeb}/modalities/${serverFromProperties.serviceId}`,
        {
          AET: serverFromProperties.aet,
          AllowEcho: reqBody.allowEcho,
          AllowFind: reqBody.allowFind,
          AllowFindWorklist: false,
          AllowGet: reqBody.allowGet,
          AllowMove: reqBody.allowMove,
          AllowStorageCommitment: false,
          AllowStore: reqBody.allowStore,
          AllowTranscoding: false,
          Host: nodeFromPoperties.ip,
          Port: serverFromProperties.publishedPortDicom,
          Timeout: 0,
          UseDicomTls: false
        },
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
      log(`Error when adding a modality to ${reqBody.to}: ${err.message}`);
    }

    // Add the modality to the server from if the modality is not already present.
    if (isReverseMissing) {
      try {
        const response = await axios.put(
          `http://${nodeFromPoperties.ip}:${serverFromProperties.publishedPortWeb}/modalities/${serverToProperties.serviceId}`,
          {
            AET: serverToProperties.aet,
            AllowEcho: false,
            AllowFind: false,
            AllowFindWorklist: false,
            AllowGet: false,
            AllowMove: false,
            AllowStorageCommitment: false,
            AllowStore: false,
            AllowTranscoding: false,
            Host: nodeToPoperties.ip,
            Port: serverToProperties.publishedPortDicom,
            Timeout: 0,
            UseDicomTls: false
          },
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
        log(`Error when adding a modality to ${reqBody.from}: ${err.message}`);
      }
        
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
            `http://${relation.get('h_from').properties.ip}:${relation.get('n_from').properties.publishedPortWeb}/modalities/${relation.get('n_to').properties.serviceId}/echo`,
            { "CheckFind": false, "Timeout": 0 },
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
        RETURN m_from, m_to
        `,
        reqBody
      );
      if (modalities.records.length === 0) {
        throw new Error(`No link found in the database between ${reqBody.from} and ${reqBody.to}`);
      }
      // Check if the 'to' server is an Orthanc server.
      if (modalities.records[0].get('m_to').labels.includes("OrthancServer")) {
        // Get the host IP address of "to" server from the database.
        const host = await tx.run(`
          MATCH (m_to:OrthancServer {serviceId: $serviceId})-[:RUNNING]->(h_to:SwarmNode) 
          RETURN h_to
          `,
          modalities.records[0].get('m_to').properties
        );
        if (host.records.length === 0) {
          throw new Error(`No host found in the database for ${reqBody.to}`);
        }
        const hostIp = host.records[0].get('h_to').properties.ip;
        const publishedPortWeb = modalities.records[0].get('m_to').properties.publishedPortWeb;
        // Perform the delete request to the Orthanc server.
        try {
          await axios.delete(`http://${hostIp}:${publishedPortWeb}/modalities/${modalities.records[0].get('m_from').properties.serviceId}`, {
            auth: {
              username: 'admin',
              password: process.env.ADMIN_PASSWORD
            }
          });
        } catch (error) {
          throw new Error(`Request ( http://${hostIp}:${publishedPortWeb}/modalities/${modalities.records[0].get('m_from').properties.serviceId}  password ${process.env.ADMIN_PASSWORD}) to delete the modality to ${reqBody.to} failed: ${error.message}`);
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