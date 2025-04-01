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

  addInitialSwarmNode() {
    // Retrieve the list of nodes in the swarm.
    const dockerNodesProcess = spawn('docker', [
      'node', 'ls', '--format', 'json'
    ]);
    let swarmNodes = [];
    dockerNodesProcess.stdout.on('data', async (data) => {
      swarmNodes = data.toString().split('\n').filter((line) => line !== '').map((jsonString) => JSON.parse(jsonString));
    })
    dockerNodesProcess.stderr.on('data', (data) => {
      throw new Error(`Error list docker nodes: ${data.toString()}`);
    });
    dockerNodesProcess.on('error', (error) => {
      throw new Error(`Error list docker nodes: ${error.message}`);
    });
    dockerNodesProcess.on('close', async (code) => {
      // Retrieve the IP address of each node in the swarm.
      for (const node of swarmNodes) {
        const dockerNodeIPProcess = spawn('docker', [
          'inspect', node.ID, '--format', '{{ .Status.Addr }}'
        ]);
        dockerNodeIPProcess.stdout.on('data', async (ipData) => {
          // Add the node to the database.
          await this.driver.executeQuery(`
              MERGE (n:SwarmNode {id: $id}) 
              SET n.ip = $ip, n.name = $name, n.status = $status, n.role = $role 
              RETURN n`,
              {
                id: node.ID,
                ip: ipData.toString().trim(),
                name: node.Hostname,
                status: node.Status,
                role: node.ManagerStatus
              }
            )
        })
        dockerNodeIPProcess.stderr.on('data', (ipError) => {
          throw new Error(`Error IP recover: ${ipError.toString()}`);
        });
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
      `${reqBody.portWeb}:80`,
      `${reqBody.portDicom}:4343`
    ]);
    
    child.stderr.on('data', (data) => {
      log(`stderr: ${data}`);
    });
    child.on('error', (error) => {
      log(`error: ${error.message}`);
    });
    child.on('close', (code) => {
      log(`child process exited with code ${code}`);
    });
  }

  async updateSwarmNodes() {
    const dockerEvents = spawn('docker', [
      'events',
      '--filter', 'scope=swarm',
      '--filter', 'type=node',
      '--format', 'json'
    ]);
    
    dockerEvents.stdout.on('data', (data) => {
      log(data.toString());
      const nodeEvent = JSON.parse(data);
      
    });
    dockerEvents.stderr.on('data', (data) => {
      log(`Error: ${data.toString()}`);
    });
    dockerEvents.on('error', (error) => {
      log(`Error: ${error.message}`);
    })
    dockerEvents.on('close', (code) => {
      log(`Docker events listener for swarm exited with code ${code}`);
    });
  }
}

module.exports = {
  Neo4jDriver
}
