const { encrypt, decrypt, createUserId } = require('./crypto');
const axios = require('axios');
const log = require('debug')('network-d');

class UserService {
  constructor(neo4jDriver, orthancService) {
    this.neo4jDriver = neo4jDriver;
    this.orthancService = orthancService;
  }

  async addUser(reqBody) {
    let userResult;
    // Encrypt the password before storing it in the database.
    const userId = createUserId(reqBody.username, reqBody.password, process.env.ADMIN_PASSWORD);
    reqBody.password = encrypt(reqBody.password, process.env.ADMIN_PASSWORD);
    userResult = await this.neo4jDriver.driver.executeQuery(`
      MATCH (o:OrthancServer {uuid: $uuid})
      MERGE (u:User {userId: $userId})
      MERGE (o)-[link:HAS_USER]->(u)
      SET link.state = "pending",
      u.username = $username,
      u.password = $password
      RETURN o`,
      {
        ...reqBody,
        userId
      });

    if (userResult.records.length === 0) {
      throw new Error(`No node found with uuid ${reqBody.uuid}`);
    }
    // After adding the user, we need to update the Orthanc server configuration.
    if (!userResult.records[0].get('o').labels.includes("Remote")) {
      await this. orthancService.editServer(userResult.records[0].get('o').properties);
    }
    return userId;
  }

  async removeUser(reqBody) {
    
    let userResult = await this.neo4jDriver.driver.executeQuery(`
      MATCH (o:OrthancServer {uuid: $uuid})-[r:HAS_USER]->(u:User {userId: $userId})
      DELETE r
      RETURN o`, reqBody);
    
    if (userResult.records.length === 0) {
      throw new Error(`User not found for node ${reqBody.uuid}`);
    }
    if (!userResult.records[0].get('o').labels.includes("Remote")) {
      await this.orthancService.editServer(userResult.records[0].get('o').properties);
    }
  }

  async updateUserState() {
    let session = this.neo4jDriver.driver.session();
    await session.executeWrite( async (tx) => {
        let userConnections = await tx.run(`
            MATCH (o:OrthancServer)-[r:HAS_USER]->(u:User)
            MATCH (o)-[:RUNNING]->(n) 
            RETURN o {.*} AS orthancServer, u {.*} AS user, n.ip as nodeIp`
        );

        for (const record of userConnections.records) {
            let orthancServer;
            let user;
            let nodeIp;
            let state = "pending";
            try {
                orthancServer = record.get('orthancServer');
                user = record.get('user');
                nodeIp = record.get('nodeIp');
                // Test the username and password by making a request to the Orthanc server
                await axios.get(`http://${nodeIp}:${orthancServer.publishedPortWeb}/system`, 
                    {
                        auth: {
                            username: user.username,
                            password: decrypt(user.password, process.env.ADMIN_PASSWORD)
                        },
                        timeout: 3000
                    }
                );
                state = 'valid';
                
            } catch (err) {
                state = 'invalid';
                log(`User ${user.username} on Orthanc server ${orthancServer.uuid} is invalid: ${err.message}`);
            }

            await tx.run(`
                MATCH (o:OrthancServer{uuid: $uuid})-[r:HAS_USER]->(u:User {username: $username, password: $password})
                SET r.state = $state
                RETURN u`,
                {
                    uuid: orthancServer.uuid,
                    username: user.username,
                    password: user.password,
                    state: state
                }
            );   
        }

    })
    await session.close();
  }

  static async getValidUsers(orthancServerUuid, tx) {
    let userConnections = await tx.run(`
      MATCH (o:OrthancServer {uuid: $uuid})-[r:HAS_USER]->(u:User)
      WHERE r.state = 'valid'
      RETURN u`,
      { uuid: orthancServerUuid }
    );
    if (userConnections.records.length === 0) {
      throw new Error(`No valid users found for Orthanc server with uuid ${orthancServerUuid}`);
    }
    return userConnections.records[0].get('u').properties;
  }
}

module.exports = { UserService };

