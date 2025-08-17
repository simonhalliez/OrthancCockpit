const log = require('debug')('network-d');
const { v4: uuidv4 } = require('uuid');
const { DicomService } = require('./dicom-service');

/**
 * Service for managing Modality nodes in the Neo4j database and synchronizing with Orthanc servers.
 */
class ModalityService {
    /**
     * @param {Neo4jDriver} neo4jDriver - The Neo4j driver instance.
     */
    constructor(neo4jDriver) {
        this.neo4jDriver = neo4jDriver;
    }

    /**
     * Adds a new Modality node to the database.
     * @param {object} reqBody - The modality properties (aet, ip, publishedPortDicom, description, etc.).
     * @returns {Promise<string>} The UUID of the newly created modality.
     */
    async addModality(reqBody) {
        let uuid = uuidv4();
        reqBody.visX = 0.0;
        reqBody.visY = 0.0;
        await this.neo4jDriver.driver.executeQuery(`
            MERGE (m:Modality:Node {uuid: $uuid}) 
            SET m.aet = $aet, 
            m.ip = $ip, 
            m.publishedPortDicom = $publishedPortDicom, 
            m.status = "pending", 
            m.visX = $visX, 
            m.visY = $visY, 
            m.description = $description`,
            {...reqBody, uuid: uuid}
        );
        return uuid;

    }

    /**
     * Edits an existing Modality node and updates its configuration on connected Orthanc servers.
     * @param {object} reqBody - The updated modality properties (must include uuid).
     * @returns {Promise<void>}
     */
    async editModality(reqBody) {
        let session =this.neo4jDriver.driver.session();
        await session.executeWrite( async (tx) => {
            // Update the modality node with the new properties in database
            await tx.run(`
                MATCH (m:Modality {uuid: $uuid}) 
                SET m.aet = $aet, 
                m.ip = $ip, 
                m.publishedPortDicom = $publishedPortDicom, 
                m.description = $description,
                m.status = "pending"
                RETURN m`,
                reqBody
            );
            // Update the modality node in the Orthanc server with the new properties
            await DicomService.updateConnectedOrthancServer(reqBody, reqBody.ip, tx)
        })
        await session.close();
        
    }

    /**
     * Updates the status of all Modality nodes based on their connections to Orthanc servers.
     * Sets status to 'up' if there is at least one active connection, otherwise sets to 'pending'.
     * @returns {Promise<void>}
     */
    async updateModalitiesStatus() {
        try {
            let session = this.neo4jDriver.driver.session();
            await session.executeWrite( async (tx) => {
                // Update the modality node with the new properties in database
                // Set status to 'up' where there is at least one active connection
                await tx.run(`
                    MATCH (o:OrthancServer)-[c:CONNECTED_TO]->(m:Modality) 
                    WHERE c.status = 'up'
                    SET m.status = 'up'
                    `
                );
                // Set status to 'down' where there are no active connections
                await tx.run(`
                    MATCH (m:Modality)
                    WHERE NOT EXISTS {
                        MATCH (:OrthancServer)-[c:CONNECTED_TO {status: 'up'}]->(m)
                    }
                    SET m.status = 'pending'
                `);
                
            })
            await session.close();
        } catch (error) {
            log('Error updating modalities status:', error);
        }
    }
}

module.exports = { ModalityService };