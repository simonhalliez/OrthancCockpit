const log = require('debug')('network-d');
const { v4: uuidv4 } = require('uuid');
const { DicomService } = require('./dicom-service');

class ModalityService {
    constructor(neo4jDriver) {
        this.neo4jDriver = neo4jDriver;
    }
    async addModality(reqBody) {
        return await this.neo4jDriver.driver.executeQuery(`
            MERGE (m:Modality {uuid: $uuid}) 
            SET m.aet = $aet, 
            m.ip = $ip, 
            m.publishedPortDicom = $publishedPortDicom, 
            m.outputPortDicom = $outputPortDicom, 
            m.status = $status, 
            m.visX = $visX, 
            m.visY = $visY, 
            m.description = $description`,
            {...reqBody, uuid: uuidv4()}
        );
    }

    async editModality(reqBody) {
        let session =this.neo4jDriver.driver.session();
        await session.executeWrite( async (tx) => {
            // Update the modality node with the new properties in database
            await tx.run(`
                MATCH (m:Modality {uuid: $uuid}) 
                SET m.aet = $aet, 
                m.ip = $ip, 
                m.publishedPortDicom = $publishedPortDicom, 
                m.outputPortDicom = $outputPortDicom, 
                m.status = $status, 
                m.visX = $visX, 
                m.visY = $visY, 
                m.description = $description 
                RETURN m`,
                reqBody
            );
            // Update the modality node in the Orthanc server with the new properties
            await DicomService.updateConnectedOrthancServer(reqBody, reqBody.ip, tx)
        })
        await session.close();
        
    }
}

module.exports = { ModalityService };