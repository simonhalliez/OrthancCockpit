const express = require('express');
const neo4j = require('neo4j-driver');
const log = require('debug')('product-d');
const axios = require('axios');
const { spawn } = require('child_process');
const { Neo4jDriver } = require('./utils/crud-wp');



const app = express.Router();
const DB_IP = process.env.PUBLIC_IP_DB || 'localhost';
const PASSWORD = process.env.ADMIN_PASSWORD || 'password';

const neo4jDriver = new Neo4jDriver(DB_IP, PASSWORD);
neo4jDriver.connect();
neo4jDriver.addInitialSwarmNode();
neo4jDriver.updateSwarmNodes();

app.get('/reset', (req, res) => {
  return neo4jDriver.driver.executeQuery(
    'MATCH (p) DETACH DELETE p',
  ).then((result) => {
    log("Result of request");
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error");
    return res.status(500).json({
      status: err
    });
  });
});

app.post('/add_Orthanc_server', (req, res) => {
  return neo4jDriver.addOrthancServer(req.body).then(() => {
    log("Result of request");
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

app.post('/add_edge', (req, res) => {
  return neo4jDriver.driver.executeQuery(
    'MATCH (n1 {aet: $from}) ' +
    'MATCH (n2 {aet: $to})' +
    'MERGE (n1)-[r:CONNECTED_TO]->(n2)' +
    'SET r.status = $status ' +
    'RETURN n1,n2',
    {
      from: req.body.from,
      to: req.body.to,
      status: req.body.status
    },
  ).then((result) => {
    log("Result of request");
    log(result.records[0].get('n1').properties.aet);
    log(result.records[0].get('n2').properties.aet);
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    log("Error");
    return res.status(500).json({
      status: err
    });
  });
});

app.get('/network', (req, res) => {
  const network = { nodes: [], edges: [] };
  neo4jDriver.driver.executeQuery(
    'MATCH (n) ' +
    'WHERE n.aet IS NOT NULL ' +
    'RETURN n',
  ).then((resultNode) => {
    network.nodes = resultNode.records.map(record => record.get('n').properties);

    neo4jDriver.driver.executeQuery(
      'MATCH (n)-[r]->(m) ' +
      'WHERE n.aet IS NOT NULL AND m.aet IS NOT NULL ' +
      'RETURN n,m,r',
    ).then((resultEdge) => {
      
      network.edges = resultEdge.records.map(record => {
        return {
          from: record.get('n').properties.aet,
          to: record.get('m').properties.aet,
          status: record.get('r').properties.status,
          id: record.get('r').elementId
        };
      });
      return res.status(200).json({
        status: 'ok',
        data: network
      });
    });
  }).catch((err) => {
    log("Error: ", err);
    return res.status(500).json({
      status: err
    });
  });
});

app.post('/update_node', (req, res) => {
  return neo4jDriver.driver.executeQuery(
    'MATCH (n {aet: $aet}) ' +
    'SET n.orthancName = $orthancName, ' +
    'n.hostNameSwarm = $hostNameSwarm, ' +
    'n.portWeb = $portWeb, ' +
    'n.portDicom = $portDicom, ' +
    'n.status = $status, ' +
    'n.visX = $visX, ' +
    'n.visY = $visY ' +
    'RETURN n',
    {
      aet: req.body.aet,
      orthancName: req.body.orthancName,
      hostNameSwarm: req.body.hostNameSwarm,
      portWeb: req.body.portWeb,
      portDicom: req.body.portDicom,
      status: req.body.status,
      visX: req.body.visX,
      visY: req.body.visY
    },
  ).then((result) => {
    return res.status(200).json({
      status: 'ok'
    });
  }).catch((err) => {
    return res.status(500).json({
      status: err
    });
  });
});

app.get('/test', (req, res) => {
  neo4jDriver.addInitialSwarmNode();
  return res.status(200).json({
    status: 'ok'
  });
});

module.exports = app;
