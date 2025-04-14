const axios = require("axios");
const log = require('debug')('product-d')
const neo4j = require('neo4j-driver');
const { spawn } = require('child_process');

class Neo4jDriver {
  constructor(DB_IP, PASSWORD) {
    this.DB_IP = DB_IP;
    this.PASSWORD = PASSWORD;
    this.URI = `neo4j://${this.DB_IP}`;
    this.USER = 'neo4j';
    this.driver = null;
  }

  connect() {
    try {
      this.driver = neo4j.driver(this.URI, neo4j.auth.basic(this.USER, this.PASSWORD));
    } catch (err) {
      console.log(`Connection error\n${err}\nCause: ${err.cause}`);
      this.driver.close();
      return;
    }
  }

  addNodeInDB(nodeID) {
    // Retrieve the IP address of the node.
    const dockerNodeIPProcess = spawn('docker', [
      'inspect', nodeID, '--format', 'json'
    ]);
    let buffer = '';
    dockerNodeIPProcess.stdout.on('data', (nodeInspect) => {
      buffer += nodeInspect.toString();
    })
    dockerNodeIPProcess.on('close', async (error) => {
      // Add the node to the database.
      let node = JSON.parse(buffer.trim())[0];
      await this.driver.executeQuery(`
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
    dockerNodeIPProcess.stderr.on('data', (ipError) => {
      throw new Error(`Error IP recover of node ${nodeID}: ${ipError.toString()}`);
    });
  }

  addInitialSwarmNodes() {
    // Retrieve the list of nodes in the swarm.
    const dockerNodesProcess = spawn('docker', [
      'node', 'ls', '--format', 'json'
    ]);
    let buffer = '';
    dockerNodesProcess.stdout.on('data', async (data) => {
      buffer += data.toString();
    })
    dockerNodesProcess.stderr.on('data', (data) => {
      throw new Error(`Error list docker nodes: ${data.toString()}`);
    });
    dockerNodesProcess.on('error', (error) => {
      throw new Error(`Error list docker nodes: ${error.message}`);
    });
    dockerNodesProcess.on('close', async (code) => {
      let swarmNodes = buffer.split('\n').filter((line) => line !== '').map((jsonString) => JSON.parse(jsonString));
      // Add each node in the swarm.
      for (const node of swarmNodes) {
        this.addNodeInDB(node.ID);
      }
    });
  }

  async addOrthancServer(reqBody) {
    reqBody.visX = 0.0;
    reqBody.visY = 0.0;
    // Adding the Orthanc server to the database.
    let session = this.driver.session();
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
      tx.run(`
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

    // Create the Orthanc service for new server.
    const child = spawn('bash', [
      'orthancManager.sh',
      'new_server',
      reqBody.orthancName,
      reqBody.aet,
      reqBody.hostNameSwarm,
      `${reqBody.portWeb}:8042`,
      `${reqBody.portDicom}:${reqBody.portDicom}`
    ]);
    child.on('error', (error) => {
      log(`Error when creating an Orthanc service: ${error.message}`);
    });
    child.stderr.on('data', (data) => {
      log(`Error when creating an Orthanc service: ${data}`);
    });
    child.on('close', (code) => {
      if (code === 0) {
        log(`Orthanc service created successfully`);
      }
    });
  }

  async updateSwarmNodes() {
    log('Updating swarm nodes...');
    // Start the event listener for update of swarm nodes.
    const dockerEvents = spawn('docker', [
      'events',
      '--filter', 'scope=swarm',
      '--filter', 'type=node',
      '--format', 'json'
    ]);

    let buffer = '';
    
    dockerEvents.stdout.on('data', async (data) => {
      buffer += data.toString();

      const lines = buffer.split('\n');
  
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (line) {
          try {
            const nodeEvent = JSON.parse(line);
            if (nodeEvent.Actor.Attributes['state.new'] === 'ready') {
              this.addNodeInDB(nodeEvent.Actor.ID);
            }
            if (nodeEvent.Actor.Attributes['state.new'] === 'down') {
              await this.driver.executeQuery(`
                MATCH (n:SwarmNode {id: $id})
                DETACH DELETE n`,
                {
                  id: nodeEvent.Actor.ID,
                }
              );
              log(`Swarm node ${nodeEvent.Actor.ID} removed from the database`);
            }
            
          } catch (err) {
            log('Error in update node in swarm:', err.message);
          }
        }
      }
  
      // Keep the last (potentially incomplete) line in the buffer
      buffer = lines[lines.length - 1];
    });

    dockerEvents.stderr.on('data', (data) => {
      log(`Error: ${data.toString()}`);
    });
    dockerEvents.on('close', (code) => {
      log(`Docker events listener for swarm exited with code ${code}`);
      this.updateSwarmNodes();
    });
  }

  async addEdge(reqBody) {
    let serverFrom = null;
    let serverTo = null;
    let session = this.driver.session();
    await session.executeWrite( async (tx) => {
      // Check if the node exists in the database.
      serverFrom = await tx.run(
        'MATCH (n:OrthancServer {aet: $from})-[:RUNNING]->(h:SwarmNode)  RETURN n,h',
        reqBody
      );
      if (serverFrom.records.length === 0) {
        throw new Error(`No orthanc server found with AET ${reqBody.from}`);
      }
      if (serverFrom.records[0].get('n').properties.status === false) {
        throw new Error(`The orthanc server ${reqBody.from} is not running`);
      }
      // TODO Check the status of the server.
      if (serverFrom.records)
      serverTo = await tx.run(
        'MATCH (n:OrthancServer {aet: $to})-[:RUNNING]->(h:SwarmNode)  RETURN n,h',
        reqBody
      );
      if (serverTo.records.length === 0) {
        throw new Error(`No orthanc server found with AET ${reqBody.to}`);
      }
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
      )
    });
    await session.close();
    
    const serverFromProperties = serverFrom.records[0].get('n').properties;
    const serverToProperties = serverTo.records[0].get('n').properties;
    const nodeFromPoperties = serverFrom.records[0].get('h').properties;
    const nodeToPoperties = serverTo.records[0].get('h').properties;
    await axios.put(
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
      })
      .then(
        (response) => {
          log(`A peer to ${reqBody.from} added successfully: ${response.data}`);
        }
      )
      .catch((err) => {
        log(`Error when adding a peer to ${reqBody.from}: ${err.message}`);
    });
    await axios.put(
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
      })
      .then(
        (response) => {
          log(`Edge added successfully: ${response.data}`);
        }
      )
      .catch((err) => {
        log(`Error when adding a peer to ${reqBody.to}: ${err.message}`);
    });
    axios.put(
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
        LocalAet: serverFromProperties.aet,
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
      })
      .then(
        (response) => {
          log(`Edge added successfully: ${response.data}`);
        }
      )
      .catch((err) => {
        log(`Error when adding a modality to ${reqBody.to}: ${err.message}`);
    });
    
  }

  updateServerStatus() {
    const checkServiceStatus = () => {
      // Start the event listener for update of swarm nodes.
      const dockerEvents = spawn('docker', [
      'service', 'ls', 
      '--format', '{"name": "{{.Name}}", "replica": "{{.Replicas}}", "image": "{{.Image}}"}'
      ]);
    
      let buffer = '';
      
      dockerEvents.stdout.on('data', async (data) => {
      buffer += data.toString();
      });
    
      dockerEvents.stderr.on('data', (data) => {
      log(`Error on service listener: ${data.toString()}`);
      });
      dockerEvents.on('close', async (code) => {
      
      if (code === 0) {
        const services = buffer
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line.trim()))
        .filter((service) => service.image === 'jodogne/orthanc-plugins:1.12.6');
        

        const session = this.driver.session();
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
      } else {
        log(`Docker events listener for service status exited with code ${code}`);
      }
      });
    };

    // Execute the checkServiceStatus function every 30 seconds without blocking the code.
    setInterval(checkServiceStatus, 30000);
  }

  async deleteServer(reqBody) {
      // Create a promise to wait for the `docker service rm` command to complete
    const removeService = new Promise((resolve, reject) => {
      const dockerEvents = spawn('docker', [
        'service', 'rm',
        'orthancServers_' + reqBody.orthancName
      ]);

      dockerEvents.stderr.on('data', (data) => {
        log(`Error removing service ${reqBody.orthancName}: ${data}`);
      });

      dockerEvents.on('error', (error) => {
        reject(error); // Reject the promise if there's an error
      });

      dockerEvents.on('close', (code) => {
        if (code === 0) {
          log(`Service ${reqBody.orthancName} removed successfully.`);
          resolve(); // Resolve the promise when the command completes successfully
        } else {
          log(`Error removing service ${reqBody.orthancName}, exited with code ${code}`);
          reject(new Error(`Service removal failed with code ${code}`));
        }
      });
    });

    try {
      // Wait for the `docker service rm` command to complete
      await removeService;

      // Execute the Cypher query to delete the server from the database
      await this.driver.executeQuery(
        'MATCH (o:OrthancServer {orthancName: $orthancName}) ' +
        'DETACH DELETE o',
        {
          orthancName: reqBody.orthancName
        }
      );
      log(`Server ${reqBody.orthancName} deleted from the database.`);
    } catch (err) {
      log(`Error during server deletion: ${err.message}`);
    }
  }
}



module.exports = {
  Neo4jDriver
}
