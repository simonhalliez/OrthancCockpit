const { encrypt, decrypt } = require('./crypto');
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
    reqBody.password = encrypt(reqBody.password, process.env.ADMIN_PASSWORD);
    userResult = await this.neo4jDriver.driver.executeQuery(`
      MATCH (o:OrthancServer {uuid: $uuid})
      MERGE (u:User {username: $username})
      SET u.password = $password
      MERGE (o)-[link:HAS_USER]->(u)
      SET link.state = $state
      RETURN o`, reqBody);
    
    if (userResult.records.length === 0) {
      throw new Error(`No node found with uuid ${reqBody.uuid}`);
    }
    await this. orthancService.editServer(userResult.records[0].get('o').properties);
  }

  async removeUser(reqBody) {
    let userResult;
    userResult = await this.neo4jDriver.driver.executeQuery(`
      MATCH (o:OrthancServer {uuid: $uuid})-[r:HAS_USER]->(u:User {username: $username})
      DELETE r
      RETURN o`, reqBody);
    
    if (userResult.records.length === 0) {
      throw new Error(`No node found with uuid ${reqBody.uuid}`);
    }
    await this.orthancService.editServer(userResult.records[0].get('o').properties);
  }

  async updateUserState() {
    let session = this.neo4jDriver.driver.session();
    await session.executeWrite( async (tx) => {
        let userConnections = await tx.run(`
            MATCH (o:OrthancServer)-[r:HAS_USER]->(u:User)
            OPTIONAL MATCH (o)-[:RUNNING]->(n) 
            RETURN o {.*} AS orthancServer, u {.*} AS user, n.ip as nodeIp`
        );


        for (const record of userConnections.records) {
            let orthancServer = record.get('orthancServer');
            let user = record.get('user');
            let nodeIp = record.get('nodeIp');
            let state = "pending";

            try {
                // Test the username and password by making a request to the Orthanc server
                await axios.get(`http://${nodeIp}:${orthancServer.publishedPortWeb}/system`, 
                    {
                        auth: {
                            username: user.username,
                            password: decrypt(user.password, process.env.ADMIN_PASSWORD)
                        }
                    }
                );
                state = 'valid';
                
            } catch (err) {
                state = 'invalid';
            }

            await tx.run(`
                MATCH (o:OrthancServer{uuid: $uuid})-[r:HAS_USER]->(u:User {username: $username})
                SET r.state = $state
                RETURN u`,
                {
                    uuid: orthancServer.uuid,
                    username: user.username,
                    state: state
                }
            );   
        }

    })
    await session.close();
  }
}

module.exports = { UserService };

