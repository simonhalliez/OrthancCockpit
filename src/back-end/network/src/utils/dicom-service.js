const log = require('debug')('network-d');
const axios = require('axios');
const { DockerService } = require('./docker-service');

class DicomService {
  constructor(neo4jDriver) {
    this.neo4jDriver = neo4jDriver;
  }

  async addEdge(reqBody) {
    log('Adding edge:', reqBody);
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
      if (serverFrom.records)
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
    log('Info :', serverFromProperties);
    // Add the peer to the server 'from'.
    try {
      const response = await axios.put(
       `http://${nodeFromPoperties.ip}:${serverFromProperties.portWeb}/peers/${serverToProperties.orthancName}`,
      { Url: `http://${nodeToPoperties.ip}:${serverToProperties.portWeb}` },
      {
        auth: {
          username: 'admin',
          password: process.env.ADMIN_PASSWORD
        },
        headers: {
          'Content-Type': 'application/json'
        }
      });
      log(`A peer to ${reqBody.from} added successfully: ${response.data}`);
    } catch (err) {
      log(`Error when adding a peer to ${reqBody.from}: ${err.message}`);
    }

    // Add the peer to the server 'to'.
    try {
      const response = await axios.put(
        `http://${nodeToPoperties.ip}:${serverToProperties.portWeb}/peers/${serverFromProperties.orthancName}`,
        { Url: `http://${nodeFromPoperties.ip}:${serverFromProperties.portWeb}` },
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
      log(`Edge added successfully: ${response.data}`);
    } catch (err) {
      log(`Error when adding a peer to ${reqBody.to}: ${err.message}`);
    }
      
    // Add the modality to the server 'to'.
    try {
      const response = await axios.put(
        `http://${nodeToPoperties.ip}:${serverToProperties.portWeb}/modalities/${serverFromProperties.aet}`,
        {
          AET: serverFromProperties.aet,
          AllowEcho: reqBody.allowEcho,
          AllowFind: reqBody.allowFind,
          AllowFindWorklist: reqBody.allowFind,
          AllowGet: reqBody.allowGet,
          AllowMove: reqBody.allowMove,
          AllowStorageCommitment: reqBody.allowStore,
          AllowStore: reqBody.allowStore,
          AllowTranscoding: false,
          Host: nodeFromPoperties.ip,
          Port: serverFromProperties.portDicom,
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
      log(`Edge added successfully: ${response.data}`);
    } catch (err) {
      log(`Error when adding a modality to ${reqBody.to}: ${err.message}`);
    }

    // Add the modality to the server from if the modality is not already present.
    if (isReverseMissing) {
      try {
        const response = axios.put(
          `http://${nodeFromPoperties.ip}:${serverFromProperties.portWeb}/modalities/${serverToProperties.aet}`,
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
            Port: serverToProperties.portDicom,
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
        log(`Modality add to from server: ${response.data}`);
      } catch (err) {
        log(`Error when adding a modality to ${reqBody.from}: ${err.message}`);
      }
        
    }
  }

  async testDicomConnections() {
    let session = this.neo4jDriver.driver.session();
    await session.executeWrite( async (tx) => {
      const relationResult = await tx.run(
        'MATCH (n_from)-[c:CONNECTED_TO]->(n_to) ' +
        'MATCH (n_from)-[r1:RUNNING]->(h_from) ' + 
        'MATCH (n_to)-[r2:RUNNING]->(h_to) ' +
        'WHERE n_from.status = true AND n_to.status = true ' +
        'RETURN n_from,n_to,h_from,h_to',
      );
      for (const relation of relationResult.records) {
        try {
          // Perform the DICOM echo request
          await axios.post(
            `http://${relation.get('h_from').properties.ip}:${relation.get('n_from').properties.portWeb}/modalities/${relation.get('n_to').properties.aet}/echo`,
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
}

module.exports = { DicomService };