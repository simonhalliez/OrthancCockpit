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
    return await this.driver.executeQuery(
      'MATCH (n {aet: $aet}) ' +
      'SET n.orthancName = $orthancName, ' +
      'n.hostNameSwarm = $hostNameSwarm, ' +
      'n.portWeb = $portWeb, ' +
      'n.portDicom = $portDicom, ' +
      'n.status = $status, ' +
      'n.visX = $visX, ' +
      'n.visY = $visY ' +
      'RETURN n',
      reqBody
    )}

  async retrieveNetwork() {
    const network = { nodes: [], edges: [] };
    const resultNode = await this.driver.executeQuery(
      'MATCH (n) ' +
      'WHERE n.aet IS NOT NULL ' +
      'RETURN n'
    )
    network.nodes = resultNode.records.map(record => record.get('n').properties);
    const resultEdge = await this.driver.executeQuery(
      'MATCH (n)-[r:CONNECTED_TO]->(m) ' +
      'WHERE n.aet IS NOT NULL AND m.aet IS NOT NULL ' +
      'RETURN n,m,r',
    );
      
    network.edges = resultEdge.records.map(record => {
      return {
        from: record.get('n').properties.aet,
        to: record.get('m').properties.aet,
        status: record.get('r').properties.status,
        id: record.get('r').elementId
      };
    });
    return network;
  };

}

module.exports = { Neo4jDriver };