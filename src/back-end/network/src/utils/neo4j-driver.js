const neo4j = require('neo4j-driver');
const log = require('debug')('network-d');

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

  async updateNodePosition(reqBody) {
    return await this.driver.executeQuery(`
      MATCH (n {uuid: $uuid}) 
      SET n.visX = $visX, 
      n.visY = $visY`,
      reqBody
    )}

  async retrieveNetwork() {
    const network = { nodes: {orthancServer: [], dicomModalities: []}, edges: [] };
    let session = this.driver.session();
    await session.executeRead( async (tx) => {
      const resultOrthancServer = await tx.run(
        'MATCH (n: OrthancServer)-[r:RUNNING]->(s:SwarmNode) ' +
        'RETURN n, s'
      )
      network.nodes.orthancServers = resultOrthancServer.records.map(record => ({
        ...record.get('n').properties,
        ip: record.get('s').properties.ip,
        uuid: record.get('n').properties.uuid,
      }));

      const resultModalities = await tx.run(
        'MATCH (m: Modality) ' +
        'RETURN m'
      )
      network.nodes.dicomModalities = resultModalities.records.map(record => ({
        ...record.get('m').properties,
        uuid: record.get('m').properties.uuid,
      }));
      const resultEdge = await tx.run(
        'MATCH (n)-[r:CONNECTED_TO]->(m) ' +
        'WHERE n.aet IS NOT NULL AND m.aet IS NOT NULL ' +
        'RETURN n,m,r',
      );
        
      network.edges = resultEdge.records.map(record => {
        const edgeProperties = record.get('r').properties;
        return {
        from: record.get('n').properties.aet,
        to: record.get('m').properties.aet,
        uuidFrom: record.get('n').properties.uuid,
        uuidTo: record.get('m').properties.uuid,
        id: record.get('r').elementId,
        ...edgeProperties
        };
      });


    });
    await session.close();
    return network;
  }


  static async recoverOrthancServerIp(serviceId, tx) {
    let hostResult = await tx.run(`
      MATCH (:OrthancServer {serviceId: $serviceId})-[:RUNNING]->(host:SwarmNode) 
      RETURN host
      `,
      {serviceId}
    );
    if (hostResult.records.length === 0) {
      throw new Error(`No host found in the database for ${serverId}`);
    }
    return hostResult.records[0].get('host').properties.ip;
  }

  static async recoverNodeIp(nodeElement, tx) {
    if (nodeElement.labels.includes("OrthancServer")) {
      return await this.recoverOrthancServerIp(nodeElement.properties.serviceId, tx);
    } else {
      return nodeElement.properties.ip;
    }
  }

}

module.exports = { Neo4jDriver };