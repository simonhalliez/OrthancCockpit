const express = require('express');
const log = require('debug')('product-d');
const { Brole } = require('./utils/crud-wp');
const { Neo4jDriver } = require('./utils/neo4j-driver');
const { SwarmService } = require('./utils/swarm-service');
const { OrthancService } = require('./utils/orthanc-service');
const { DicomService } = require('./utils/dicom-service');

const app = express.Router();
const DB_IP = process.env.PUBLIC_IP_DB || 'localhost';
const PASSWORD = process.env.ADMIN_PASSWORD || 'password';

const neo4jDriver = new Neo4jDriver(DB_IP, PASSWORD);
neo4jDriver.connect();
const broleService = new Brole(neo4jDriver);
const swarmService = new SwarmService(neo4jDriver);
const orthancService = new OrthancService(neo4jDriver);
const dicomService = new DicomService(neo4jDriver);
swarmService.addInitialSwarmNodes();
swarmService.updateSwarmNodes();


app.post('/add_Orthanc_server', (req, res) => {
  return orthancService.addOrthancServer(req.body).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add Orthanc server',
      error: err.message
    });
  });
});

app.post('/add_edge', async (req, res) => {
  await orthancService.updateServerStatus();
  return dicomService.addEdge(req.body).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error when adding edge: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add edge',
      error: err.message
    });
  });
});

app.get('/network', (req, res) => {
  const network = neo4jDriver.retrieveNetwork()
  .then((result) => {
    log("Get network result");
    return res.status(200).json({
      status: 'ok',
      data: result
    });
  })
  .catch((err) => {
    log("Error: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve network',
      error: err.message
    });
  });
});

app.post('/update_node_position', (req, res) => {
  return neo4jDriver.updateNodePosition(req.body).then((result) => {
    return res.status(200).json({
      status: 'ok'
    });
  })
  .catch((err) => {
    log("Error: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update node position',
      error: err.message
    });
  });
});

app.get('/test', async (req, res) => {
  await orthancService.updateServerStatus();
  return dicomService.testDicomConnections()
  .then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  })
  .catch((err) => {
    log("Error: ", err);
    return res.status(500).json({
      status: err
    });
  });
});

app.post('/delete_node', (req, res) => {
  return orthancService.deleteServer(req.body).then(() => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error when adding edge: ", err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add edge',
      error: err.message
    });
  });
})

module.exports = app;
