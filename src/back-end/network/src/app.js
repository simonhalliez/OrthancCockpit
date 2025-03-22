const express = require('express');
const neo4j = require('neo4j-driver');
const log = require('debug')('product-d');
const app = express.Router();

function connectToNeo4j() {
  // URI examples: 'neo4j://localhost', 'neo4j+s://xxx.databases.neo4j.io'
  const URI = 'neo4j://192.168.129.92';
  const USER = 'neo4j';
  const PASSWORD = 'password';
  let driver;

  try {
    driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD));
  } catch (err) {
    console.log(`Connection error\n${err}\nCause: ${err.cause}`);
    driver.close();
    return;
  }
  return driver;
}
driver = connectToNeo4j();

app.get('/reset', (req, res) => {
  return driver.executeQuery(
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
  return driver.executeQuery(
    'MERGE (o:OrthancServer {aet: $aet}) ' +
    'SET o.orthancName = $orthancName, ' +
    'o.hostNameSwarm = $hostNameSwarm, ' +
    'o.portWeb = $portWeb, ' +
    'o.portDicom = $portDicom, ' +
    'o.status = $status, ' +
    'o.visX = $visX, ' +
    'o.visY = $visY ' +
    'RETURN o',
    {
      aet: req.body.AET,
      orthancName: req.body.ORTHANC_NAME,
      hostNameSwarm: req.body.HOST_NAME_SWARM,
      portWeb: req.body.PORTS_WEB,
      portDicom: req.body.PORTS_DICOM,
      status: false,
      visX: 0.0,
      visY: 0.0
    },
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

app.post('/add_edge', (req, res) => {
  return driver.executeQuery(
    'MATCH (n1 {aet: $from}) ' +
    'MATCH (n2 {aet: $to})' +
    'MERGE (n1)-[r:CONNECTED_TO]->(n2) ' +
    'SET r.status = $status ' +
    'RETURN r',
    {
      from: req.body.FROM,
      to: req.body.TO,
      status: req.body.STATUS
    },
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

app.get('/network', (req, res) => {
  const network = { nodes: [], edges: [] };
  driver.executeQuery(
    'MATCH (n) ' +
    'WHERE n.aet IS NOT NULL ' +
    'RETURN n',
  ).then((resultNode) => {
    network.nodes = resultNode.records.map(record => record.get('n').properties);

    driver.executeQuery(
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

module.exports = app;
