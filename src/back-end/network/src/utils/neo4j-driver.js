const neo4j = require('neo4j-driver');
const log = require('debug')('network-d');
const { decrypt } = require('./crypto');

/**
 * Service for interacting with the Neo4j database.
 * Provides methods to manage Orthanc servers, modalities, edges, and tags.
 */
class Neo4jDriver {
  /**
   * @param {string} DB_IP - IP address of the Neo4j database.
   * @param {string} PASSWORD - Password for the Neo4j user.
   */
  constructor(DB_IP, PASSWORD) {
    this.DB_IP = DB_IP;
    this.PASSWORD = PASSWORD;
    this.URI = `neo4j://${this.DB_IP}`;
    this.USER = 'neo4j';
    this.driver = null;
  }

  /**
   * Connects to the Neo4j database and creates a uniqueness constraint on Node.aet.
   * @returns {Promise<void>}
   */
  async connect() {
    try {
      this.driver = await neo4j.driver(this.URI, neo4j.auth.basic(this.USER, this.PASSWORD));
    } catch (err) {
      log(`Connection error\n${err}\nCause: ${err.cause}`);
      this.driver.close();
      return;
    }
    await this.driver.executeQuery(`
        CREATE CONSTRAINT unique_node_aet IF NOT EXISTS
        FOR (n:Node)
        REQUIRE n.aet IS UNIQUE
      `);
  }

  /**
   * Updates the position (visX, visY) of a node by UUID.
   * @param {object} reqBody - Contains uuid, visX, visY.
   * @returns {Promise<void>}
   */
  async updateNodePosition(reqBody) {
    return await this.driver.executeQuery(`
      MATCH (n {uuid: $uuid}) 
      SET n.visX = $visX, 
      n.visY = $visY`,
      reqBody
    )}

  /**
   * Formats an OrthancServer record from Neo4j.
   * @param {object} record - Neo4j record.
   * @returns {object} Formatted OrthancServer object.
   */
  formatOrthancServer(record) {
    return {
      ...record.get('n').properties,
      ip: record.get('s').properties.ip,
      uuid: record.get('n').properties.uuid,
      tags: record.get('tags'),
      users: record.get('users').map(user => {
        let password;
        // Keep only the first char of the password and replace the rest with asterisks
        if (user.password) {
          const decrypted = decrypt(user.password, process.env.ADMIN_PASSWORD);
          password = decrypted.length > 1
            ? decrypted[0] + '*'.repeat(decrypted.length - 1)
            : decrypted;
        } else {
          password = undefined;
        }
        return {
          ...user,
          password
        };
      })
    };
  }

  /**
   * Gets a single OrthancServer by UUID.
   * @param {string} uuid - UUID of the OrthancServer.
   * @returns {Promise<object>} Formatted OrthancServer object.
   * @throws {Error} If not found.
   */
  async getOrthancServer(uuid) {
    const result = await this.driver.executeQuery(
      `
        MATCH (n: OrthancServer {uuid: $uuid})-[r:RUNNING]->(s)
        OPTIONAL MATCH (tag)-[:TAG]->(n) 
        OPTIONAL MATCH (n)-[connection:HAS_USER]->(u:User)
        RETURN n, s, COLLECT(DISTINCT tag {.*}) AS tags, 
        COLLECT(DISTINCT u {.*, state: connection.state}) AS users
      `,
      { uuid }
    );
    
    if (result.records.length === 0) {
      throw new Error(`Orthanc server with UUID ${uuid} not found`);
    }
    return this.formatOrthancServer(result.records[0]);
  }

  /**
   * Gets all OrthancServers.
   * @returns {Promise<object[]>} Array of formatted OrthancServer objects.
   */
  async getOrthancServers() {
    const resultOrthancServer = await this.driver.executeQuery(`
      MATCH (n: OrthancServer)-[r:RUNNING]->(s)
      OPTIONAL MATCH (tag)-[:TAG]->(n) 
      OPTIONAL MATCH (n)-[connection:HAS_USER]->(u:User)
      RETURN n, s, COLLECT(DISTINCT tag {.*}) AS tags, 
      COLLECT(DISTINCT u {.*, state: connection.state}) AS users`
    );
    return resultOrthancServer.records.map(record => this.formatOrthancServer(record));
  }

  /**
   * Formats a Modality record from Neo4j.
   * @param {object} record - Neo4j record.
   * @returns {object} Formatted Modality object.
   */
  formatModality(record) {
    return {
      ...record.get('m').properties,
      tags: record.get('tags'),
      uuid: record.get('m').properties.uuid
    };
  }

  /**
   * Gets a single Modality by UUID.
   * @param {string} uuid - UUID of the Modality.
   * @returns {Promise<object>} Formatted Modality object.
   * @throws {Error} If not found.
   */
  async getModality(uuid) {
    const result = await this.driver.executeQuery(`
        MATCH (m: Modality {uuid: $uuid}) 
        OPTIONAL MATCH (tag)-[:TAG]->(m) 
        RETURN m, COLLECT(tag {.*}) AS tags`,
      { uuid }
    )
    if (result.records.length === 0) {
      throw new Error(`Modality with UUID ${uuid} not found`);
    }
    return this.formatModality(result.records[0]);
  }

  /**
   * Gets all Modalities.
   * @returns {Promise<object[]>} Array of formatted Modality objects.
   */
  async getModalities() {
    const result = await this.driver.executeQuery(`
        MATCH (m: Modality) 
        OPTIONAL MATCH (tag)-[:TAG]->(m) 
        RETURN m, COLLECT(tag {.*}) AS tags`,
    )
    return result.records.map(record => this.formatModality(record));
  }

  /**
   * Formats an Edge record from Neo4j.
   * @param {object} record - Neo4j record.
   * @returns {object} Formatted Edge object.
   */
  formatEdge(record) {
    const edgeProperties = record.get('r').properties;
    return {
      from: record.get('n').properties.aet,
      to: record.get('m').properties.aet,
      uuidFrom: record.get('n').properties.uuid,
      uuidTo: record.get('m').properties.uuid,
      id: record.get('r').elementId,
      ...edgeProperties
    };
  }

  /**
   * Gets all edges (connections) between nodes.
   * @returns {Promise<object[]>} Array of formatted Edge objects.
   */
  async getEdges() {
    const resultEdge = await this.driver.executeQuery(
      'MATCH (n)-[r:CONNECTED_TO]->(m) ' +
      'WHERE n.aet IS NOT NULL AND m.aet IS NOT NULL ' +
      'RETURN n,m,r',
    );
    return resultEdge.records.map(record => this.formatEdge(record));
  }

  /**
   * Gets a single edge by its elementId.
   * @param {string} id - The elementId of the edge.
   * @returns {Promise<object>} Formatted Edge object.
   * @throws {Error} If not found.
   */
  async getEdge(id) {
    const result = await this.driver.executeQuery(`
      MATCH (n)-[r:CONNECTED_TO]->(m) 
      WHERE elementId(r) = $id
      RETURN n,m,r`,
      { id }
    );
    if (result.records.length === 0) {
      throw new Error(`Edge with ID ${id} not found`);
    }
    return this.formatEdge(result.records[0]);
  }

  /**
   * Gets all tags.
   * @returns {Promise<object[]>} Array of tag objects.
   */
  async getTags() {
    const res = await this.driver.executeQuery(`
      MATCH (tags:Tag)
      RETURN COLLECT(tags {.*}) AS tag`);
    return res.records[0].get('tag');
  }

  /**
   * Edits a tag's name and color.
   * @param {object} reqBody - Contains tagName, newName, newColor.
   * @returns {Promise<void>}
   */
  async editTag(reqBody) {
    return await this.driver.executeQuery(`
      MATCH (tag:Tag {name: $tagName})
      SET tag.name = $newName,
      tag.color = $newColor
      RETURN tag`,
      reqBody
    )
  }

  /**
   * Deletes a tag by name.
   * @param {string} tagName - Name of the tag to delete.
   * @returns {Promise<void>}
   */
  async deleteTag(tagName) {
    return await this.driver.executeQuery(`
      MATCH (tag:Tag {name: $tagName})
      DETACH DELETE tag`,
      { tagName }
    );
  }

  /**
   * Recovers the IP address of an OrthancServer by UUID within a transaction.
   * @param {string} uuid - UUID of the OrthancServer.
   * @param {object} tx - Neo4j transaction.
   * @returns {Promise<string>} IP address.
   * @throws {Error} If not found.
   */
  static async recoverOrthancServerIp(uuid, tx) {
    let hostResult = await tx.run(`
      MATCH (:OrthancServer {uuid : $uuid})-[:RUNNING]->(host) 
      RETURN host
      `,
      {uuid}
    );
    if (hostResult.records.length === 0) {
      throw new Error(`No host found in the database for ${uuid}`);
    }
    return hostResult.records[0].get('host').properties.ip;
  }

  /**
   * Recovers the IP address of a node (OrthancServer or Modality).
   * @param {object} nodeElement - Neo4j node element.
   * @param {object} tx - Neo4j transaction.
   * @returns {Promise<string>} IP address.
   */
  static async recoverNodeIp(nodeElement, tx) {
    if (nodeElement.labels.includes("OrthancServer")) {
      return await this.recoverOrthancServerIp(nodeElement.properties.uuid, tx);
    } else {
      return nodeElement.properties.ip;
    }
  }

  /**
   * Retrieves the full network (nodes and edges).
   * @returns {Promise<object>} Object with nodes and edges arrays.
   */
  async retrieveNetwork() {
    const network = { nodes: [], edges: [] };
    network.nodes = [...(await this.getOrthancServers()), ...(await this.getModalities())];
    network.edges = await this.getEdges();
    return network;
  }
}

module.exports = { Neo4jDriver };